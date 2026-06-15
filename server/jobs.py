"""In-memory job registry for long-running render operations."""
import secrets
import threading

_JOBS = {}   # job_id -> {"status": "running|done|error", "done": int, "total": int, "result": dict | None, "error": str | None, "sessionId": str}
_LOCK = threading.Lock()
_MAX = 50

def create(session_id, total):
    """Create a new job. Returns job_id."""
    jid = "j" + secrets.token_hex(8)
    with _LOCK:
        if len(_JOBS) > _MAX:   # drop oldest finished jobs
            to_drop = [k for k, v in _JOBS.items() if v["status"] != "running"][: len(_JOBS) - _MAX]
            for k in to_drop:
                _JOBS.pop(k, None)
        _JOBS[jid] = {"status": "running", "done": 0, "total": total, "result": None, "error": None, "sessionId": session_id}
    return jid

def update(jid, **patch):
    """Update job state with the given patches."""
    with _LOCK:
        if jid in _JOBS:
            _JOBS[jid].update(patch)

def get(jid):
    """Fetch a job by ID. Returns dict or None."""
    with _LOCK:
        return dict(_JOBS[jid]) if jid in _JOBS else None

def find_active(session_id):
    """Find the most recently created running job for a session. Returns dict with 'id' key or None."""
    with _LOCK:
        match = None
        for k, v in _JOBS.items():
            if v["sessionId"] == session_id and v["status"] == "running":
                match = (k, v)
        if match:
            return dict(match[1], id=match[0])
    return None
