"""
Tests for the login-gated scan pipeline and the account settings endpoints
added on 2026-09-26. Runs against a throwaway SQLite file, never the real
trustlens.db, and never calls RapidAPI. Run from backend/:
    .\\venv\\Scripts\\python.exe -m pytest tests -q
"""
import json
import os
import tempfile

# Must be set before database/auth are imported anywhere in this process.
_TMP_DB = os.path.join(tempfile.mkdtemp(prefix="trustlens_test_"), "test.db")
os.environ["DATABASE_URL"] = f"sqlite:///{_TMP_DB}"
os.environ.setdefault("JWT_SECRET", "test-secret-not-used-anywhere-real")

import pytest
from fastapi.testclient import TestClient

import main
from auth import create_token, hash_password
from database import SessionLocal, User, ScanHistory, Appeal

client = TestClient(main.app)
PASSWORD = "correct horse 42"


def _make_user(email, role="user"):
    db = SessionLocal()
    user = User(full_name="Test Person", email=email, password_hash=hash_password(PASSWORD),
                email_verified=True, role=role, is_active=True)
    db.add(user)
    db.commit()
    db.refresh(user)
    uid = user.id
    db.close()
    return uid


def _auth(uid):
    return {"Authorization": f"Bearer {create_token(uid)}"}


def _make_scan(uid, username="some.creator", corrected=None):
    db = SessionLocal()
    scan = ScanHistory(user_id=uid, username=username, full_name="Some Creator", trust_score=64.2,
                       verdict="Moderate Risk", color="yellow",
                       raw_result=json.dumps({"username": username, "trust_score": {"trust_score": 64.2}}),
                       corrected_trust_score=corrected, corrected_verdict="Trusted" if corrected else None)
    db.add(scan)
    db.commit()
    db.refresh(scan)
    sid = scan.id
    db.close()
    return sid


# --------------------------------------------------------------------------- #
# Scanning requires an account
# --------------------------------------------------------------------------- #
def test_scan_without_login_is_refused():
    r = client.post("/analyze-live", json={"username": "cristiano"})
    assert r.status_code == 401


def test_scan_with_a_bad_token_is_refused():
    r = client.post("/analyze-live", json={"username": "cristiano"},
                    headers={"Authorization": "Bearer not-a-real-token"})
    assert r.status_code == 401


# --------------------------------------------------------------------------- #
# Reopening a saved result from the Dashboard
# --------------------------------------------------------------------------- #
def test_owner_can_reopen_a_saved_result_with_its_correction():
    uid = _make_user("reopen@example.com")
    sid = _make_scan(uid, corrected=78.0)
    r = client.get(f"/scans/{sid}", headers=_auth(uid))
    assert r.status_code == 200
    body = r.json()
    assert body["username"] == "some.creator"
    assert body["scan_id"] == sid and body["scan_owned"] is True
    # The original score is kept; the correction is reported beside it.
    assert body["trust_score"]["trust_score"] == 64.2
    assert body["correction"] == {"trust_score": 78.0, "verdict": "Trusted"}


def test_someone_elses_scan_looks_like_it_does_not_exist():
    owner = _make_user("owner@example.com")
    other = _make_user("other@example.com")
    sid = _make_scan(owner)
    assert client.get(f"/scans/{sid}", headers=_auth(other)).status_code == 404
    assert client.get(f"/scans/{sid}").status_code == 401


# --------------------------------------------------------------------------- #
# Settings: name, password, delete
# --------------------------------------------------------------------------- #
def test_change_name():
    uid = _make_user("rename@example.com")
    r = client.patch("/me", json={"full_name": "  New Name  "}, headers=_auth(uid))
    assert r.status_code == 200 and r.json()["full_name"] == "New Name"
    assert client.patch("/me", json={"full_name": "   "}, headers=_auth(uid)).status_code == 400
    assert client.patch("/me", json={"full_name": "x" * 101}, headers=_auth(uid)).status_code == 400


def test_change_password_checks_current_and_strength():
    uid = _make_user("pw@example.com")
    h = _auth(uid)
    assert client.post("/me/password", json={"current_password": "wrong one 1", "new_password": "brandnew99"}, headers=h).status_code == 400
    assert client.post("/me/password", json={"current_password": PASSWORD, "new_password": "12345678"}, headers=h).status_code == 400
    assert client.post("/me/password", json={"current_password": PASSWORD, "new_password": PASSWORD}, headers=h).status_code == 400
    assert client.post("/me/password", json={"current_password": PASSWORD, "new_password": "brandnew99"}, headers=h).status_code == 200

    # The old password stops working and the new one works.
    assert client.post("/login", json={"email": "pw@example.com", "password": PASSWORD}).status_code == 401
    assert "token" in client.post("/login", json={"email": "pw@example.com", "password": "brandnew99"}).json()


def test_delete_account_removes_everything_tied_to_it():
    uid = _make_user("delete@example.com")
    sid = _make_scan(uid)
    db = SessionLocal()
    db.add(Appeal(scan_id=sid, user_id=uid, reason="x" * 30))
    db.commit()
    db.close()
    h = _auth(uid)

    assert client.request("DELETE", "/me", json={"password": "nope"}, headers=h).status_code == 400
    r = client.request("DELETE", "/me", json={"password": PASSWORD}, headers=h)
    assert r.status_code == 200

    db = SessionLocal()
    assert db.query(User).filter(User.id == uid).first() is None
    assert db.query(ScanHistory).filter(ScanHistory.user_id == uid).count() == 0
    assert db.query(Appeal).filter(Appeal.user_id == uid).count() == 0
    db.close()
    # The token they were holding is now worthless.
    assert client.get("/me", headers=h).status_code == 401


def test_admin_cannot_delete_their_own_account():
    uid = _make_user("admin-self@example.com", role="admin")
    r = client.request("DELETE", "/me", json={"password": PASSWORD}, headers=_auth(uid))
    assert r.status_code == 400
    db = SessionLocal()
    assert db.query(User).filter(User.id == uid).first() is not None
    db.close()
