from __future__ import annotations
# --- CSV Export ---
def rows_to_csv(rows: list[PermitRow]) -> str:
    """Convert a list of PermitRow objects to CSV string."""
    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=CSV_HEADER, extrasaction="ignore")
    writer.writeheader()
    for row in rows:
        writer.writerow(row.to_dict())
    return output.getvalue()
"""
Utilities for fetching and parsing PPRBD permit reports and exposing a CLI interface.

This module is intentionally standalone so it can be invoked both from the Flask
application (via subprocess) and directly from the command line.
"""

import argparse
import csv
import datetime as dt
import io
import os
import re
import sys
from dataclasses import dataclass
from typing import Iterable, List, Sequence
import httpx

# --- Constants ---
DETAILS_BASE_URL = "https://www.pprbd.org/Permit/Details?permitNo={permit_id}"
LAST_MONTH_REPORT_ID = 46  # Permits issued last month (calendar)
WEEKLY_REPORT_ID = 45  # Permits issued last week
DAILY_REPORT_IDS = [40, 41, 42, 43, 44]  # Monday through Friday
REPORT_BASE_URL = "https://www.pprbd.org/File/Report?report={report_id}"
USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36"
)
CSV_HEADER = [
    "issue_date",
    "permit_id",
    "address",
    "city",
    "zip",
    "contractor",
    "project_code",
    "project_name",
    "details_url",
]
PROJECT_CODE_TARGET = "101"

# --- Classes ---
class PermitParseError(RuntimeError):
    """Raised when a report cannot be parsed into permit rows."""
    pass

@dataclass
class PermitRow:
    issue_date: dt.date
    permit_id: str
    address: str
    city: str
    zip: str
    contractor: str
    valuation: str
    project_code: str
    project_name: str
    details_url: str
    record_type: str = "permit"

    def to_dict(self) -> dict:
        return {
            "issue_date": self.issue_date.isoformat(),
            "permit_id": self.permit_id,
            "address": self.address,
            "city": self.city,
            "zip": self.zip,
            "contractor": self.contractor,
            "valuation": self.valuation,
            "project_code": self.project_code,
            "project_name": self.project_name,
            "details_url": self.details_url,
            "record_type": self.record_type,
        }

# --- CLI Parser ---
def build_cli_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Fetch and parse PPRBD Single-Family permit reports.",
        add_help=True,
    )
    parser.add_argument(
        "--files",
        nargs="+",
        help="One or more report files to parse (weekly or weekday text reports).",
    )
    parser.add_argument(
        "--stdin",
        action="store_true",
        help="Read report content from STDIN.",
    )
    parser.add_argument(
        "--fetch",
        action="store_true",
        help="Download the latest reports directly from pprbd.org.",
    )
    parser.add_argument(
        "--days",
        type=int,
        default=30,
        help="Limit results to permits issued in the last N days (default: 30).",
    )
    parser.add_argument(
        "--print",
        dest="print_csv",
        action="store_true",
        help="Print the resulting CSV to STDOUT.",
    )
    parser.add_argument(
        "--export",
        metavar="PATH",
        help="Write the CSV output to a file.",
    )
    parser.add_argument(
        "--project-code",
        default=PROJECT_CODE_TARGET,
        help="Project code to filter on (default: 101).",
    )
    parser.add_argument(
        "--homeowner-only",
        action="store_true",
        help="Return only permits where the contractor appears to be the homeowner (contractor contains 'owner').",
    )
    return parser

# --- CLI Entrypoint ---
def is_cli_invocation(argv: Sequence[str] | None = None) -> bool:
    argv = list(argv or sys.argv[1:])
    permit_flags = {
        "--files",
        "--stdin",
        "--fetch",
        "--export",
        "--print",
        "--project-code",
        "--days",
        "--help",
        "-h",
        "--homeowner-only",
    }
    return any(flag in argv for flag in permit_flags)

def run_cli(argv: Sequence[str] | None = None) -> int:
    parser = build_cli_parser()
    args = parser.parse_args(argv)
    try:
        permit_rows = collect_permit_rows(
            files=args.files or [],
            use_stdin=args.stdin,
            fetch_remote=args.fetch,
            days=args.days,
            project_code=args.project_code,
            homeowner_only=args.homeowner_only,
        )
        dict_rows = [row.to_dict() for row in permit_rows]
        header = CSV_HEADER
    except PermitParseError as exc:
        sys.stderr.write(f"{exc}\n")
        return 1
    except httpx.HTTPStatusError as exc:
        sys.stderr.write(f"Failed to fetch report (HTTP {exc.response.status_code}): {exc}\n")
        return 1
    except httpx.ConnectError as exc:
        sys.stderr.write("Unable to reach pprbd.org (network/SSL issue).\n")
        return 2
    except httpx.RequestError as exc:
        sys.stderr.write(f"Network error while fetching reports: {exc}\n")
        return 2

    if args.print_csv:
        output = io.StringIO()
        writer = csv.DictWriter(output, fieldnames=header, extrasaction="ignore")
        writer.writeheader()
        for row in dict_rows:
            writer.writerow(row)
        sys.stdout.write(output.getvalue())

    if args.export:
        with open(args.export, "w", encoding="utf-8", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=header, extrasaction="ignore")
            writer.writeheader()
            for row in dict_rows:
                writer.writerow(row)

    return 0

# --- Main Logic ---
def collect_permit_rows(
    files: Iterable[str],
    use_stdin: bool,
    fetch_remote: bool,
    days: int,
    project_code: str = PROJECT_CODE_TARGET,
    homeowner_only: bool = False,
    stdin_text: str | None = None,
) -> List[PermitRow]:
    texts: list[tuple[str, str]] = []

    if fetch_remote:
        texts.extend(fetch_latest_reports())

    for path in files:
        if not os.path.exists(path):
            raise PermitParseError(f"File not found: {path}")
        with open(path, "rb") as fh:
            raw_bytes = fh.read()
        decoded = _decode_report_bytes(raw_bytes)
        texts.append((decoded, f"file://{os.path.abspath(path)}"))

    if use_stdin:
        if stdin_text is not None:
            stdin_content = stdin_text
        else:
            stdin_content = sys.stdin.read()
        if stdin_content.strip():
            texts.append((stdin_content, "stdin"))

    if not texts:
        raise PermitParseError("No report content provided.")

    cutoff = dt.date.today() - dt.timedelta(days=days)
    rows: dict[str, PermitRow] = {}

    for content, source in texts:
        for row in parse_report_text(content, project_code=project_code):
            if homeowner_only and "OWNER" not in row.contractor.upper():
                continue
            if row.issue_date < cutoff:
                continue
            existing = rows.get(row.permit_id)
            if existing is None or existing.issue_date < row.issue_date:
                rows[row.permit_id] = row

    sorted_rows = sorted(
        rows.values(),
        key=lambda r: (r.issue_date, r.permit_id),
        reverse=True,
    )
    return sorted_rows

def fetch_latest_reports() -> list[tuple[str, str]]:
    report_ids = [LAST_MONTH_REPORT_ID, WEEKLY_REPORT_ID, *DAILY_REPORT_IDS]
    client = httpx.Client(timeout=30.0)
    texts: list[tuple[str, str]] = []
    try:
        for report_id in report_ids:
            url = REPORT_BASE_URL.format(report_id=report_id)
            response = client.get(url, headers={"User-Agent": USER_AGENT})
            response.raise_for_status()
            texts.append((response.text, url))
    finally:
        client.close()
    return texts

def parse_report_text(text: str, project_code: str = PROJECT_CODE_TARGET) -> list[PermitRow]:
    if not text or "Project Code:" not in text:
        raise PermitParseError("Provided report does not contain recognizable permit data.")

    lines = text.splitlines()
    rows: list[PermitRow] = []
    current_code: str | None = None
    current_entry: list[str] | None = None

    permit_line_re = re.compile(
        r"^(?P<permit>\S+)\s+\S+\s+(?P<date>\d{2}-[A-Za-z]{3}-\d{4})\s+ADDRESS:\s+(?P<addr>.+?)$"
    )

    for raw_line in lines:
        line = raw_line.rstrip()

        if line.startswith("Project Code:"):
            match = re.search(r"Project Code:\s*(\d+)", line)
            current_code = match.group(1) if match else None
            current_entry = None
            continue

        if current_code != project_code:
            continue

        if not line.strip():
            continue

        if permit_line_re.match(line):
            if current_entry:
                maybe_row = _entry_to_row(current_entry, project_code)
                if maybe_row:
                    rows.append(maybe_row)
            current_entry = [line]
        elif current_entry is not None:
            current_entry.append(line)

    if current_entry:
        maybe_row = _entry_to_row(current_entry, project_code)
        if maybe_row:
            rows.append(maybe_row)

    return rows

def _decode_report_bytes(data: bytes) -> str:
    for encoding in ("utf-8", "utf-16", "utf-16le", "utf-16be", "windows-1252"):
        try:
            return data.decode(encoding)
        except UnicodeDecodeError:
            continue
    return data.decode("latin-1", errors="ignore")

def _entry_to_row(entry_lines: list[str], project_code: str) -> PermitRow | None:
    if not entry_lines:
        return None

    permit_line = entry_lines[0]
    permit_line_re = re.compile(
        r"^(?P<permit>\S+)\s+\S+\s+(?P<date>\d{2}-[A-Za-z]{3}-\d{4})\s+ADDRESS:\s+(?P<rest>.+)$"
    )
    match = permit_line_re.match(permit_line)
    if not match:
        return None

    permit_id = match.group("permit")
    date_str = match.group("date")
    rest = match.group("rest").rstrip()

    addr_match = re.match(r"(?P<address>.+?)\s{2,}(?P<cityzip>.+)$", rest)
    if addr_match:
        address = addr_match.group("address").strip()
        cityzip = addr_match.group("cityzip").strip()
    else:
        address = rest
        cityzip = ""

    city = ""
    zip_code = ""
    if cityzip:
        parts = cityzip.rsplit(" ", 1)
        if len(parts) == 2 and parts[1].isdigit():
            city, zip_code = parts[0].strip(), parts[1].strip()
        else:
            city = cityzip.strip()
            zip_code = ""

    project_name = ""
    contractor = ""
    valuation = ""

    for line in entry_lines[1:]:
        if "Project:" in line and "Contr:" in line:
            proj_match = re.search(r"Project:\s*(.*?)\s{2,}Contr:\s*(.+)$", line)
            if proj_match:
                project_name = proj_match.group(1).strip()
                contractor = proj_match.group(2).strip().rstrip(".")
                continue
        if line.strip().startswith("Contr:") and not contractor:
            contractor = line.split("Contr:", 1)[1].strip()
        if "COST:" in line and not valuation:
            cost_match = re.search(r"COST:\s*\$?\s*([\d,]+(?:\.\d{2})?)", line)
            if cost_match:
                amount = cost_match.group(1).strip().replace(" ", "")
                valuation = f"${amount}"

    if not contractor:
        contractor = "UNKNOWN"
    if not valuation:
        valuation = ""

    try:
        issue_date = dt.datetime.strptime(date_str, "%d-%b-%Y").date()
    except ValueError:
        return None

    details_url = DETAILS_BASE_URL.format(permit_id=permit_id)

    return PermitRow(
        issue_date=issue_date,
        permit_id=permit_id,
        address=address,
        city=city,
        zip=zip_code,
        contractor=contractor,
        valuation=valuation,
        project_code=project_code,
        project_name=project_name or "UNKNOWN",
        details_url=details_url,
    )
