# ============================================================
# TrustLens — Database Setup
# ============================================================
#
# Uses SQLite by default: one file (trustlens.db) next to this script,
# no server or install needed. Set DATABASE_URL in .env to point at
# PostgreSQL instead — nothing else in this file would need to change.

import os
from datetime import datetime

from sqlalchemy import (
    create_engine, inspect, text,
    Column, Integer, String, Float, Boolean, DateTime, Text, ForeignKey,
)
from sqlalchemy.orm import sessionmaker, declarative_base

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./trustlens.db")

connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
engine = create_engine(DATABASE_URL, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    full_name = Column(String)
    email = Column(String, unique=True, index=True)
    password_hash = Column(String)
    email_verified = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    # "user" or "admin". There is deliberately no endpoint that lets anyone
    # make themselves an admin — the first admin is created from the command
    # line (make_admin.py), and after that only an existing admin can grant it.
    role = Column(String, default="user")
    # False = suspended by an admin. Suspended accounts cannot log in and any
    # token they already hold stops working on its next request.
    is_active = Column(Boolean, default=True)
    last_login_at = Column(DateTime, nullable=True)


class VerificationCode(Base):
    """A one-time email verification code. Sent once at signup (proves the
    email is real and reachable) and can be resent at login if an account
    was never verified. Stored in the DB (not memory) so it survives a
    server restart/reload — this backend reloads often during development."""
    __tablename__ = "verification_codes"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)
    code = Column(String)           # 6-digit numeric code, as a string
    created_at = Column(DateTime, default=datetime.utcnow)
    expires_at = Column(DateTime)
    used = Column(Boolean, default=False)


class ScanHistory(Base):
    __tablename__ = "scan_history"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    username = Column(String, index=True)
    full_name = Column(String, nullable=True)
    is_verified = Column(Boolean, default=False)

    followers = Column(Integer, nullable=True)
    trust_score = Column(Float)
    verdict = Column(String)
    color = Column(String)

    bot_percentage = Column(Float, nullable=True)
    engagement_score = Column(Float, nullable=True)
    misinformation_flag = Column(Boolean, nullable=True)
    deepfake_band = Column(String, nullable=True)       # real | fake | uncertain | not_applicable | error
    deepfake_image_risk = Column(Integer, nullable=True)

    raw_result = Column(Text)  # full /analyze-live JSON response, for the Results page to reuse
    scanned_at = Column(DateTime, default=datetime.utcnow)

    # Set only when an admin upholds a dispute. The original score above is
    # never overwritten, so there is always a record of what the models said
    # versus what a human decided — that difference is the retraining signal.
    corrected_trust_score = Column(Float, nullable=True)
    corrected_verdict = Column(String, nullable=True)


class Appeal(Base):
    """A user disputing a score. Scope document §7: "an appeal mechanism
    allows submission of evidence for admin review within 48 hours. Corrected
    scores feed back into model retraining." """
    __tablename__ = "appeals"

    id = Column(Integer, primary_key=True, index=True)
    scan_id = Column(Integer, ForeignKey("scan_history.id"), index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)

    reason = Column(Text)
    evidence_url = Column(String, nullable=True)

    status = Column(String, default="pending", index=True)   # pending | upheld | rejected
    created_at = Column(DateTime, default=datetime.utcnow)

    resolved_at = Column(DateTime, nullable=True)
    resolved_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    admin_note = Column(Text, nullable=True)
    corrected_trust_score = Column(Float, nullable=True)
    # Which part of the pipeline the admin judged to be wrong. This is what
    # makes an upheld dispute useful for retraining rather than just a
    # changed number: it says which model the case should go back to.
    module_at_fault = Column(String, nullable=True)


class AuditLog(Base):
    """Every admin action, recorded. Scope document lists audit logs among
    the things the database holds; this is also simply how a real admin
    panel stays accountable — a suspension or a changed score always has a
    who, a when and a why attached."""
    __tablename__ = "audit_log"

    id = Column(Integer, primary_key=True, index=True)
    admin_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    action = Column(String, index=True)          # e.g. "user.suspend", "appeal.resolve"
    target_type = Column(String, nullable=True)  # "user" | "appeal" | "export"
    target_id = Column(Integer, nullable=True)
    details = Column(Text, nullable=True)        # JSON
    created_at = Column(DateTime, default=datetime.utcnow, index=True)


# Columns added to tables that already exist on people's machines.
# create_all() only creates *missing tables*; it never alters an existing one,
# so without this an existing trustlens.db would crash on the first query
# that touches a new column. ADD COLUMN is non-destructive — existing rows
# keep every value they had and simply get the default for the new column.
_ADDED_COLUMNS = {
    "users": {
        "role": "VARCHAR DEFAULT 'user'",
        "is_active": "BOOLEAN DEFAULT TRUE",
        "last_login_at": "TIMESTAMP",
    },
    "scan_history": {
        "corrected_trust_score": "FLOAT",
        "corrected_verdict": "VARCHAR",
    },
}


def _add_missing_columns():
    inspector = inspect(engine)
    with engine.begin() as conn:
        for table, columns in _ADDED_COLUMNS.items():
            if not inspector.has_table(table):
                continue
            existing = {c["name"] for c in inspector.get_columns(table)}
            for name, ddl in columns.items():
                if name not in existing:
                    conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {name} {ddl}"))


def init_db():
    Base.metadata.create_all(bind=engine)
    _add_missing_columns()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
