# ============================================================
# TrustLens — Main FastAPI Backend
# ============================================================

import sys
import os
import json
from datetime import datetime, timedelta
from concurrent.futures import ThreadPoolExecutor
sys.path.append(os.path.join(os.path.dirname(__file__), "misinfo_classifier", "api"))
from model_loader import classify_text

from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from fake_follower import analyze_fake_followers
from engagement_analyzer import analyze_engagement, analyze_comment_authenticity
from trust_score import calculate_trust_score
from data_ingestion import fetch_instagram_profile, fetch_engagement_data, fetch_post_comments
from credential_extractor import calculate_credential_confidence
from database import init_db, get_db, ScanHistory, User, VerificationCode
from auth import (
    hash_password, verify_password, create_token, get_current_user, get_current_user_optional,
    EMAIL_RE, MAX_PASSWORD_BYTES, password_strength_error,
    generate_verification_code, VERIFICATION_CODE_EXPIRES_MINUTES,
)
from email_service import send_verification_code, email_configured

app = FastAPI(
    title="TrustLens API",
    description="AI-Powered Influencer Authenticity Detection",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

init_db()

@app.get("/")
def home():
    return {
        "message": "TrustLens API is running",
        "version": "1.0.0",
        "status": "active"
    }

@app.post("/analyze")
def analyze_profile(data: dict):
    username        = data.get("username", "unknown")
    followers       = data.get("followers", 0)
    following       = data.get("following", 0)
    posts           = data.get("posts", 0)
    likes_avg       = data.get("likes_avg", 0)
    comments_avg    = data.get("comments_avg", 0)
    has_profile_pic = data.get("has_profile_pic", 1)
    bio_length      = data.get("bio_length", 0)
    has_external_url= data.get("has_external_url", 0)
    is_private      = data.get("is_private", 0)

    fake_result = analyze_fake_followers(
        followers, following, posts,
        has_profile_pic, bio_length, has_external_url, is_private
    )

    engagement_result = analyze_engagement(
        followers, likes_avg, comments_avg, posts
    )

    trust_result = calculate_trust_score(
        fake_result["bot_percentage"],
        engagement_result["engagement_score"]
    )

    return {
        "username": username,
        "fake_follower_analysis": fake_result,
        "engagement_analysis": engagement_result,
        "trust_score": trust_result
    }

@app.post("/analyze-live")
def analyze_profile_live(
    data: dict,
    db: Session = Depends(get_db),
    current_user: User | None = Depends(get_current_user_optional),
):
    username = data.get("username")

    if not username:
        return {"error": "Please provide a username"}

    # Profile and engagement data don't depend on each other, so fetch both
    # RapidAPI calls at the same time instead of waiting for one then the
    # other — this alone cuts a meaningful chunk off total scan time.
    with ThreadPoolExecutor(max_workers=2) as pool:
        profile_future = pool.submit(fetch_instagram_profile, username)
        engagement_future = pool.submit(fetch_engagement_data, username)

        try:
            profile = profile_future.result()
        except Exception as e:
            return {"error": f"Could not fetch Instagram data: {str(e)}"}

        try:
            engagement_data = engagement_future.result()
        except Exception as e:
            return {"error": f"Could not fetch engagement data: {str(e)}"}

    fake_result = analyze_fake_followers(
        profile["followers"], profile["following"], profile["posts"],
        profile["has_profile_pic"], profile["bio_length"],
        profile["has_external_url"], profile["is_private"]
    )

    engagement_result = analyze_engagement(
        profile["followers"],
        engagement_data["avg_likes"],
        engagement_data["avg_comments"],
        profile["posts"]
    )

    # ---- Comment Authenticity Check (uses most recent post) ----
    comment_authenticity = {
        "verdict": "No posts available",
        "comment_diversity_score": None,
        "campaign_keyword_detected": False
    }
    try:
        post_codes = engagement_data.get("post_codes", [])
        if post_codes:
            comments = fetch_post_comments(post_codes[0])
            comment_authenticity = analyze_comment_authenticity(comments)
    except Exception:
        pass

    # ---- Credential Extraction & Confidence Scoring ----
    credential_result = calculate_credential_confidence(
        profile.get("biography", ""), profile["is_verified"]
    )

    # ---- Misinformation Classification (bio + post captions) ----
    # Scope document: "processes two sources of input: written post captions
    # extracted directly from the profile, and Whisper-transcribed text from
    # video reels." Bio-only was a known, documented gap — now every fetched
    # caption is checked too. One flagged caption is enough to matter, so the
    # single worst (highest-risk) result across bio + captions is what feeds
    # the Trust Score; every individual result is kept for the Details page.
    misinfo_sources = []

    bio_text = profile.get("biography", "")
    if bio_text and bio_text.strip():
        try:
            r = classify_text(bio_text)
            r["source"] = "bio"
            r["text_preview"] = bio_text[:80]
            misinfo_sources.append(r)
        except Exception as e:
            misinfo_sources.append({"status": "error", "message": str(e), "source": "bio"})

    for caption in engagement_data.get("post_captions", []):
        try:
            r = classify_text(caption)
            r["source"] = "caption"
            r["text_preview"] = caption[:80]
            misinfo_sources.append(r)
        except Exception:
            pass  # one bad caption shouldn't break the whole scan

    successful = [r for r in misinfo_sources if r.get("status") == "success"]
    if successful:
        misinfo_result = max(successful, key=lambda r: r["risk_score"])
    else:
        misinfo_result = {
            "status": "skipped",
            "message": "No bio or caption text was available to classify",
        }

    trust_result = calculate_trust_score(
        fake_result["bot_percentage"],
        engagement_result["engagement_score"],
        misinfo_result,
        credential_result
    )

    result = {
        "username": profile["username"],
        "full_name": profile["full_name"],
        "is_verified": profile["is_verified"],
        "raw_profile_data": profile,
        "engagement_data": engagement_data,
        "fake_follower_analysis": fake_result,
        "engagement_analysis": engagement_result,
        "comment_authenticity": comment_authenticity,
        "credential_analysis": credential_result,
        "misinformation_analysis": misinfo_result,
        "misinformation_sources": misinfo_sources,
        "trust_score": trust_result
    }

    # ---- Save this scan to history ----
    # A DB hiccup should never break a scan that already succeeded, so this
    # is best-effort: log it and move on rather than failing the request.
    try:
        db.add(ScanHistory(
            user_id=current_user.id if current_user else None,
            username=result["username"],
            full_name=result["full_name"],
            is_verified=result["is_verified"],
            followers=profile.get("followers"),
            trust_score=trust_result["trust_score"],
            verdict=trust_result["verdict"],
            color=trust_result["color"],
            bot_percentage=fake_result.get("bot_percentage"),
            engagement_score=engagement_result.get("engagement_score"),
            misinformation_flag=misinfo_result.get("misinformation_flag"),
            raw_result=json.dumps(result),
        ))
        db.commit()
    except Exception as e:
        db.rollback()
        print(f"Warning: could not save scan history: {e}")

    return result


@app.post("/test-misinfo")
def test_misinfo(data: dict):
    text = data.get("text", "")
    return classify_text(text)


def _send_verification_code(db: Session, user: User) -> None:
    """Shared by /signup and /login: generates a code, saves it, emails it.
    Raises HTTPException on failure so callers don't need to repeat that."""
    if not email_configured():
        raise HTTPException(
            503,
            "Email verification isn't fully set up yet — the app's Gmail sender "
            "(GMAIL_ADDRESS / GMAIL_APP_PASSWORD) hasn't been configured in backend/.env."
        )

    code = generate_verification_code()
    db.add(VerificationCode(
        user_id=user.id,
        code=code,
        expires_at=datetime.utcnow() + timedelta(minutes=VERIFICATION_CODE_EXPIRES_MINUTES),
    ))
    db.commit()

    try:
        send_verification_code(user.email, code)
    except Exception as e:
        raise HTTPException(500, f"Could not send the verification email: {e}")


@app.post("/signup")
def signup(data: dict, db: Session = Depends(get_db)):
    """Creates the account, then emails a one-time code to prove the email
    is real. No token yet — /verify-email finishes the job. This is what
    catches a made-up/nonexistent email at signup: the code can never
    arrive, so the account can never be verified or used."""
    full_name = (data.get("full_name") or "").strip()
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    if not full_name:
        raise HTTPException(400, "Please enter your name")
    if len(full_name) > 100:
        raise HTTPException(400, "Name is too long")
    if not EMAIL_RE.match(email):
        raise HTTPException(400, "Please enter a valid email address")
    if len(email) > 254:  # RFC 5321 max email length
        raise HTTPException(400, "Email address is too long")
    if len(password.encode("utf-8")) > MAX_PASSWORD_BYTES:
        raise HTTPException(400, f"Password must be {MAX_PASSWORD_BYTES} characters or fewer")
    strength_error = password_strength_error(password)
    if strength_error:
        raise HTTPException(400, strength_error)

    if db.query(User).filter(User.email == email).first():
        raise HTTPException(400, "An account with this email already exists")

    user = User(full_name=full_name, email=email, password_hash=hash_password(password), email_verified=False)
    db.add(user)
    db.commit()
    db.refresh(user)

    _send_verification_code(db, user)

    return {
        "requires_verification": True,
        "email": user.email,
        "message": f"We emailed a 6-digit code to {user.email} to confirm it's real. It expires in {VERIFICATION_CODE_EXPIRES_MINUTES} minutes.",
    }


@app.post("/login")
def login(data: dict, db: Session = Depends(get_db)):
    """Password-only login — no code required once the email has already
    been verified once (that's the whole point of doing it at signup
    instead of every login). If an account somehow never got verified
    (e.g. the user closed the tab during signup), this resends a fresh
    code instead of leaving them stuck."""
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    user = db.query(User).filter(User.email == email).first()
    if not user or not verify_password(password, user.password_hash):
        raise HTTPException(401, "Incorrect email or password")

    if not user.email_verified:
        _send_verification_code(db, user)
        return {
            "requires_verification": True,
            "email": user.email,
            "message": f"This account was never verified. We emailed a new 6-digit code to {user.email}.",
        }

    token = create_token(user.id)
    return {"token": token, "user": {"id": user.id, "full_name": user.full_name, "email": user.email}}


@app.post("/verify-email")
def verify_email(data: dict, db: Session = Depends(get_db)):
    """Checks the emailed code. On success, marks the account verified
    (permanently — future logins never need a code again) and logs the
    user in immediately, same response shape /login uses."""
    email = (data.get("email") or "").strip().lower()
    code = (data.get("code") or "").strip()

    user = db.query(User).filter(User.email == email).first()
    # Same "don't leak which part was wrong" principle as password login.
    generic_error = HTTPException(401, "Incorrect or expired code")
    if not user:
        raise generic_error

    verification_code = (
        db.query(VerificationCode)
        .filter(VerificationCode.user_id == user.id, VerificationCode.code == code, VerificationCode.used == False)
        .order_by(VerificationCode.created_at.desc())
        .first()
    )
    if not verification_code or verification_code.expires_at < datetime.utcnow():
        raise generic_error

    verification_code.used = True
    user.email_verified = True
    db.commit()

    token = create_token(user.id)
    return {"token": token, "user": {"id": user.id, "full_name": user.full_name, "email": user.email}}


@app.get("/me")
def me(current_user: User = Depends(get_current_user)):
    return {"id": current_user.id, "full_name": current_user.full_name, "email": current_user.email}


@app.get("/scans")
def get_scan_history(
    limit: int = 20,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Real scan history for the Dashboard page — only this user's own scans, most recent first."""
    scans = (
        db.query(ScanHistory)
        .filter(ScanHistory.user_id == current_user.id)
        .order_by(ScanHistory.scanned_at.desc())
        .limit(limit)
        .all()
    )
    return [
        {
            "id": s.id,
            "username": s.username,
            "full_name": s.full_name,
            "is_verified": s.is_verified,
            "followers": s.followers,
            "trust_score": s.trust_score,
            "verdict": s.verdict,
            "color": s.color,
            "bot_percentage": s.bot_percentage,
            "engagement_score": s.engagement_score,
            "misinformation_flag": s.misinformation_flag,
            "scanned_at": s.scanned_at.isoformat() if s.scanned_at else None,
        }
        for s in scans
    ]