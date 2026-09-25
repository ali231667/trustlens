# ============================================================
# TrustLens — Database Setup
# ============================================================
#
# Uses SQLite by default: one file (trustlens.db) next to this script,
# no server or install needed. Set DATABASE_URL in .env to point at
# PostgreSQL instead — nothing else in this file would need to change.

import os
from datetime import datetime

from sqlalchemy import create_engine, Column, Integer, String, Float, Boolean, DateTime, Text, ForeignKey
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


def init_db():
    Base.metadata.create_all(bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
