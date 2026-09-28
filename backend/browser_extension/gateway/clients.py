"""
Thin async clients for the three TrustLens modules.

Design rule: **a module being down must never take the whole verdict down.**
Each client returns a dict that always carries an "available" flag, so the
analyzer can build a partial verdict and say honestly which parts are missing.
That matters because these are three separate services on a laptop, one of them
not being started is the normal case during a demo, not an exception.
"""
from __future__ import annotations

import asyncio
import logging

import httpx

from config import settings

log = logging.getLogger(__name__)

# Live transcription progress, keyed by the reel's page URL.
#
# /analyze blocks while a reel is being listened to, so the badge has no other
# way to learn how far along it is. reel_audio.py reports progress here and the
# extension polls GET /progress, so a wait never looks like a hang.
PROGRESS: dict[str, dict] = {}


def set_progress(page_url: str, **fields) -> None:
    if not page_url:
        return
    PROGRESS[page_url] = {**PROGRESS.get(page_url, {}), **fields}


def get_progress(page_url: str) -> dict:
    return PROGRESS.get(page_url, {"state": "idle"})


def clear_progress(page_url: str) -> None:
    PROGRESS.pop(page_url, None)


# --------------------------------------------------------------------------- #
# Misinformation classifier  (D:\trustlens_post_checker, port 8001)
# --------------------------------------------------------------------------- #
# The same text gets classified again when you return to a reel, and a
# pre-checked reel was already classified in the background. Remember results.
_classify_cache: dict[str, dict] = {}
_account_cache: dict[str, dict] = {}


def _remember(cache: dict, key: str, value: dict) -> dict:
    if value.get("available"):
        if len(cache) > 500:
            cache.pop(next(iter(cache)))
        cache[key] = value
    return value


async def classify_text(text: str) -> dict:
    if text and text in _classify_cache:
        return dict(_classify_cache[text])
    return _remember(_classify_cache, text or "", await _classify_text(text))


async def predict_account(features: dict) -> dict:
    key = repr(sorted(features.items()))
    if key in _account_cache:
        return dict(_account_cache[key])
    return _remember(_account_cache, key, await _predict_account(features))


async def _classify_text(text: str) -> dict:
    """Send caption/transcript text to the post checker.

    Returns its full report on success. On failure returns
    {"available": False, "error": ...} rather than raising, so a missing
    classifier degrades the verdict instead of breaking it.
    """
    if not text or not text.strip():
        return {"available": False, "error": "no text to classify"}

    url = f"{settings.classifier_url}/check-text"
    try:
        async with httpx.AsyncClient(timeout=settings.fast_timeout) as client:
            r = await client.post(
                url,
                json={
                    "text": text,
                    # Network fact-check lookups add seconds per request and the
                    # extension runs on every post you scroll past. Off here.
                    "check_facts": False,
                    "resolve_links": False,
                },
            )
            r.raise_for_status()
            data = r.json()
            data["available"] = True
            return data
    except httpx.HTTPStatusError as exc:
        detail = _detail(exc)
        log.warning("Classifier returned %s: %s", exc.response.status_code, detail)
        return {"available": False, "error": detail}
    except Exception as exc:
        log.warning("Classifier unreachable at %s: %s", url, exc)
        return {
            "available": False,
            "error": f"Post checker not reachable on {settings.classifier_url}. "
                     f"Start it, then retry.",
        }


# --------------------------------------------------------------------------- #
# Fake follower / bot account model  (thin wrapper API, port 8002)
# --------------------------------------------------------------------------- #
async def _predict_account(features: dict) -> dict:
    """Classify one Instagram account from the 7 raw profile features."""
    url = f"{settings.follower_url}/predict-account"
    try:
        async with httpx.AsyncClient(timeout=settings.fast_timeout) as client:
            r = await client.post(url, json=features)
            r.raise_for_status()
            data = r.json()
            data["available"] = True
            return data
    except httpx.HTTPStatusError as exc:
        detail = _detail(exc)
        log.warning("Account model returned %s: %s", exc.response.status_code, detail)
        return {"available": False, "error": detail}
    except Exception as exc:
        log.warning("Account model unreachable at %s: %s", url, exc)
        return {
            "available": False,
            "error": f"Account model not reachable on {settings.follower_url}.",
        }


# --------------------------------------------------------------------------- #
# Health
# --------------------------------------------------------------------------- #
async def _probe(name: str, url: str) -> tuple[str, dict]:
    """Is the service at `url` actually the service we think it is?

    `status_code < 400`, not `< 500`. A 404 means that health path does not
    exist, so something else is answering on that port — which is not a
    hypothetical: the old external transcriber's port 8000 was the same port
    the main TrustLens website runs on, and with a `< 500` check the gateway
    reported "transcriber: up" off the website's own 404. Reporting a service as up because
    *something* answered is exactly the kind of false reassurance this
    codebase refuses to give anywhere else.
    """
    try:
        async with httpx.AsyncClient(timeout=4.0) as client:
            r = await client.get(url)
            return name, {"up": r.status_code < 400, "status_code": r.status_code}
    except Exception as exc:
        return name, {"up": False, "error": type(exc).__name__}


async def health_report() -> dict:
    """Ask the two model services at once whether they are up."""
    checks = await asyncio.gather(
        _probe("classifier", f"{settings.classifier_url}/health"),
        _probe("account_model", f"{settings.follower_url}/health"),
    )
    return dict(checks)


def _detail(exc: httpx.HTTPStatusError) -> str:
    """Prefer FastAPI's {"detail": ...} message over a bare status line."""
    try:
        body = exc.response.json()
        if isinstance(body, dict) and "detail" in body:
            return str(body["detail"])
    except Exception:
        pass
    return f"HTTP {exc.response.status_code}"
