"""
A thin REST wrapper around TrustLens's own fake-follower model.

WHY THIS WAS REWRITTEN
----------------------
The original version imported a Streamlit project at
`D:\\trustlens-fake-follower-detection` — a path that does not exist in this
repo — and used its XGBoost model (94.4%). That meant two different
fake-follower models could answer the same question: the extension using one,
the website using another, disagreeing about the same account.

This version imports `backend/fake_follower.py` instead: the trained Random
Forest (95.8% held-out accuracy) that the live site already runs on every scan. The extension
and the website now cannot disagree, because there is only one model.

Ali's XGBoost version is still in the repo at
`backend/archive/fake_follower_detection_ali/` — archived, not deleted.

Run:
    uvicorn follower_api:app --port 8002
"""
from __future__ import annotations

import os
import re
import sys
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

def _find_backend_dir() -> Path:
    """Walks up from this file looking for the TrustLens backend.

    Located by a file that is actually in it rather than by counting parent
    directories, so moving this folder (for example out of archive/) cannot
    silently break the import.
    """
    override = os.getenv("TRUSTLENS_BACKEND_DIR")
    if override:
        return Path(override)
    for parent in Path(__file__).resolve().parents:
        if (parent / "fake_follower.py").exists():
            return parent
    return Path(__file__).resolve().parents[1]


# Import the site's own model in place rather than copying it, so a retrain
# over there is picked up here with no drift between the two.
BACKEND_DIR = _find_backend_dir()
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

_IMPORT_ERROR: str | None = None
try:
    from fake_follower import analyze_fake_followers, name_features  # type: ignore
except Exception as exc:  # pragma: no cover - only hit on a broken install
    _IMPORT_ERROR = f"{type(exc).__name__}: {exc}"

app = FastAPI(title="TrustLens Fake-Follower API", version="2.0.0")
app.add_middleware(
    CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"],
)

# Bands match the live site's verdict tiers exactly (fake_follower.py), so the
# extension badge and the website verdict cannot tell different stories about
# the same account.
FAKE_BAND_AT = 0.70          # site: "High Risk — Likely Fake"
UNCERTAIN_BAND_AT = 0.40     # site: "Moderate Risk — Suspicious"


class AccountRequest(BaseModel):
    username: str = ""
    full_name: str = ""
    has_external_url: int = 0
    profile_pic: int = 1
    username_digit_ratio: float | None = None
    description_length: int = 0
    private: int = 0
    posts_count: int = 0
    followers_count: int = 0
    follows_count: int = 0


def username_digit_ratio(username: str) -> float:
    """Share of the username that is digits.

    Bot farms number their accounts ("sarah_8837462"), so a high ratio is a
    real signal. Kept here rather than imported so this wrapper does not
    depend on anything the live site does not already expose.
    """
    if not username:
        return 0.0
    digits = len(re.findall(r"\d", username))
    return round(digits / len(username), 4)


def _band(prob_fake: float) -> str:
    if prob_fake >= FAKE_BAND_AT:
        return "fake"
    if prob_fake >= UNCERTAIN_BAND_AT:
        return "uncertain"
    return "real"


@app.get("/health")
def health():
    return {
        "status": "degraded" if _IMPORT_ERROR else "ok",
        "model_loaded": _IMPORT_ERROR is None,
        "backend_dir": str(BACKEND_DIR),
        "model": "TrustLens Random Forest (same model as the live site)",
        "error": _IMPORT_ERROR,
    }


@app.post("/predict-account")
def predict(req: AccountRequest):
    if _IMPORT_ERROR:
        raise HTTPException(503, f"Fake-follower model unavailable. {_IMPORT_ERROR}")

    ratio = req.username_digit_ratio
    if ratio is None:
        ratio = username_digit_ratio(req.username or "")

    raw = {
        "profile_pic": int(req.profile_pic),
        "username_digit_ratio": float(ratio),
        "description_length": int(req.description_length),
        "private": int(req.private),
        "posts_count": int(req.posts_count),
        "followers_count": int(req.followers_count),
        "follows_count": int(req.follows_count),
    }

    # Same name-based inputs the website's scan passes, so the extension and
    # the site give the same account the same score.
    names = name_features(req.username, req.full_name)
    try:
        result = analyze_fake_followers(
            followers=raw["followers_count"],
            following=raw["follows_count"],
            posts=raw["posts_count"],
            has_profile_pic=raw["profile_pic"],
            bio_length=raw["description_length"],
            has_external_url=int(req.has_external_url),
            is_private=raw["private"],
            username_digit_ratio=raw["username_digit_ratio"],
            fullname_words=names["fullname_words"],
            fullname_digit_ratio=names["fullname_digit_ratio"],
            name_equals_username=names["name_equals_username"],
        )
    except Exception as exc:
        raise HTTPException(422, f"Prediction failed: {exc}") from exc

    prob_fake = float(result["bot_percentage"]) / 100.0

    return {
        "username": req.username,
        "label": int(result["prediction"]),
        "prob_fake": round(prob_fake, 4),
        "band": _band(prob_fake),
        "verdict": result["verdict"],
        # How far the model is from a coin flip, which is what "confidence"
        # means for a binary classifier. 0.5 -> 0.0, and 0.0 or 1.0 -> 1.0.
        "confidence": round(abs(prob_fake - 0.5) * 2, 4),
        "color": result["color"],
        "features_used": raw,
    }
