import os
import json
import time
import math
import threading
from datetime import datetime
from typing import List, Dict, Any, Optional


def _now_iso() -> str:
    return datetime.utcnow().isoformat()


def _ensure_dir(path: str) -> None:
    os.makedirs(path, exist_ok=True)


def _cosine_sim(a: List[float], b: List[float]) -> float:
    # Avoid numpy to keep dependencies minimal
    if not a or not b or len(a) != len(b):
        return 0.0
    dot = 0.0
    na = 0.0
    nb = 0.0
    for i in range(len(a)):
        ai = a[i]
        bi = b[i]
        dot += ai * bi
        na += ai * ai
        nb += bi * bi
    if na <= 0.0 or nb <= 0.0:
        return 0.0
    return dot / math.sqrt(na * nb)


class MemoryManager:
    """Persistent, retrieval-augmented conversation memory per session.

    Stores per-session JSON files that include:
    - messages: chronological messages with role/content/timestamp
    - user_memory: list of {text, embedding, timestamp} for user messages
    - summary: rolling summary string

    Provides retrieval with cosine similarity and optional summarization via OpenAI.
    """

    def __init__(self, base_dir: str, embeddings_model: str, client=None, top_k: int = 5,
                 summarize_every_n: int = 25, summary_max_chars: int = 4000):
        self.base_dir = base_dir
        self.sessions_dir = os.path.join(self.base_dir, "sessions")
        _ensure_dir(self.sessions_dir)
        self.embeddings_model = embeddings_model
        self.client = client
        self.top_k = top_k
        self.summarize_every_n = summarize_every_n
        self.summary_max_chars = summary_max_chars
        self._locks: Dict[str, threading.Lock] = {}

    def _lock_for(self, session_id: str) -> threading.Lock:
        if session_id not in self._locks:
            self._locks[session_id] = threading.Lock()
        return self._locks[session_id]

    def _session_path(self, session_id: str) -> str:
        return os.path.join(self.sessions_dir, f"{session_id}.json")

    def _load(self, session_id: str) -> Dict[str, Any]:
        path = self._session_path(session_id)
        if not os.path.exists(path):
            return {
                "session_id": session_id,
                "created_at": _now_iso(),
                "updated_at": _now_iso(),
                "messages": [],
                "user_memory": [],
                "summary": ""
            }
        with open(path, "r", encoding="utf-8") as f:
            try:
                return json.load(f)
            except Exception:
                # Corrupt file fallback
                return {
                    "session_id": session_id,
                    "created_at": _now_iso(),
                    "updated_at": _now_iso(),
                    "messages": [],
                    "user_memory": [],
                    "summary": ""
                }

    def _save(self, session_id: str, data: Dict[str, Any]) -> None:
        data["updated_at"] = _now_iso()
        path = self._session_path(session_id)
        tmp_path = path + ".tmp"
        with open(tmp_path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        os.replace(tmp_path, path)

    def add_message(self, session_id: str, role: str, content: str, embed_user: bool = True) -> None:
        if not session_id or not content:
            return
        with self._lock_for(session_id):
            state = self._load(session_id)
            state["messages"].append({
                "role": role,
                "content": content,
                "timestamp": _now_iso()
            })
            # Only embed user messages to limit cost
            if embed_user and role == "user" and self.client:
                try:
                    emb = self.client.embeddings.create(
                        model=self.embeddings_model,
                        input=content
                    )
                    vec = emb.data[0].embedding if getattr(emb, "data", None) else None
                except Exception:
                    vec = None
                state["user_memory"].append({
                    "text": content,
                    "embedding": vec,
                    "timestamp": _now_iso()
                })
            self._save(session_id, state)

    def get_relevant_context(self, session_id: str, query_text: str, top_k: Optional[int] = None) -> Dict[str, Any]:
        """Return summary and top similar user memories for the given query_text."""
        k = top_k or self.top_k
        with self._lock_for(session_id):
            state = self._load(session_id)
        summary = (state.get("summary") or "").strip()
        items = state.get("user_memory") or []
        results: List[Dict[str, Any]] = []
        if not items or not self.client:
            return {"summary": summary, "snippets": results}

        try:
            q = self.client.embeddings.create(model=self.embeddings_model, input=query_text)
            qvec = q.data[0].embedding if getattr(q, "data", None) else None
        except Exception:
            qvec = None

        if not qvec:
            return {"summary": summary, "snippets": results}

        scored = []
        for it in items:
            vec = it.get("embedding")
            if not vec:
                continue
            sim = _cosine_sim(qvec, vec)
            if sim > 0:
                scored.append((sim, it))

        scored.sort(key=lambda x: x[0], reverse=True)
        for sim, it in scored[:k]:
            results.append({
                "text": it.get("text", ""),
                "timestamp": it.get("timestamp"),
                "score": sim
            })
        return {"summary": summary, "snippets": results}

    def maybe_update_summary(self, session_id: str, model_name: str) -> None:
        """Periodically create/update a rolling summary using the chat model.

        Summarize after every N messages to keep a compact memory that grows slowly.
        """
        if not self.client:
            return
        with self._lock_for(session_id):
            state = self._load(session_id)
            msgs = state.get("messages", [])
            if len(msgs) % self.summarize_every_n != 0:
                return

        # Build a short prompt for summarization
        sys_prompt = (
            "You are a summarizer that writes a concise rolling memory of a user's long-term preferences, "
            "facts, goals, and ongoing tasks. Keep it under " f"{self.summary_max_chars} characters. "
            "Do NOT include assistant wording; only extract durable facts and plans."
        )

        # Take the most recent window of messages to summarize
        with self._lock_for(session_id):
            state = self._load(session_id)
            recent = state.get("messages", [])[-(self.summarize_every_n * 2):]
            prev_summary = state.get("summary", "")

        # Compose content
        history_text = []
        if prev_summary:
            history_text.append(f"Previous summary:\n{prev_summary}\n---")
        for m in recent:
            r = m.get("role")
            c = (m.get("content") or "").strip()
            if not c:
                continue
            history_text.append(f"{r}: {c}")
        joined = "\n".join(history_text)

        try:
            completion = self.client.chat.completions.create(
                model=model_name,
                messages=[
                    {"role": "system", "content": sys_prompt},
                    {"role": "user", "content": f"Summarize this conversation into durable memory.\n\n{joined}"}
                ],
                temperature=0.2,
                max_tokens=512
            )
            if completion and completion.choices:
                new_summary = (completion.choices[0].message.content or "").strip()
            else:
                new_summary = prev_summary
        except Exception:
            new_summary = prev_summary

        if new_summary:
            new_summary = new_summary[: self.summary_max_chars]
            with self._lock_for(session_id):
                state = self._load(session_id)
                state["summary"] = new_summary
                self._save(session_id, state)
