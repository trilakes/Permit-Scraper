Local dev quick start

- Start: open `app.py` and click the Python Run button in the editor title (triangle) to run in the integrated terminal using the venv and `.env`.
- Stop: focus the terminal running the server and press Ctrl+C once.

Notes
- `app.py` disables the Flask reloader to ensure Ctrl+C stops the single process on Windows.
- If a port error occurs, free the port 5050 or change `PORT` in `.env`.
- Avoid using the Code Runner play button; it is disabled from overriding Python runs.

Permit fetcher
- CLI: `python app.py --fetch --days 30 --print` downloads the latest PPRBD monthly + weekly + weekday reports and prints CSV (`issue_date,permit_id,address,city,zip,contractor,valuation,...`) to stdout. Use `--files path1 path2` or `--stdin` to ingest saved reports; add `--export permits.csv` to write to disk. Adjust the window with `--days 45`, `--days 60`, etc.
- Add `--homeowner-only` (or JSON `{"homeowner_only": true}`) to limit results to permits where the contractor string includes "owner".
- API: POST `/api/permits` with `{"mode":"files"|"stdin"|"fetch","days":30,"want_csv":true,"want_rows":true}`. On success, returns `rows`, `csv_url`, `row_count`. Exit code 2 from the CLI maps to message "Live fetch unavailable; upload a report file or paste its text."
- Front-end panel (Fetch permits) prioritizes uploads -> pasted text -> live fetch. Results appear in a neon-styled table with Date / Address / Contractor / Valuation columns, a CSV download link, a 30/60 day range selector, and a "Homeowner permits only" toggle.
