# ============================================================
# TrustLens — Fake Follower Detection Module
# ============================================================

import pickle
import pandas as pd
import os

# Load the trained model from our paper implementation.
# Absolute path (relative to this file), not relative to whatever directory
# the server happens to be launched from — a relative path here would
# silently fall back to the much cruder rule_based_detection() below with
# no warning if the server were ever started from anywhere else.
MODEL_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "fake_follower_model.pkl")

# The exact feature order the model is trained on. `train_fake_follower.py`
# imports this same list, so training and prediction can never drift apart.
#
# That sharing is not decoration. The previous model was trained in a notebook
# on StandardScaler-scaled features, but only the model was ever saved — not
# the scaler — while this file fed it raw values. Its learned split points sat
# around -0.85 to 4.4 (z-score range) while real follower counts run into the
# millions, so every account fell down the same branch and the module returned
# "genuine" for literally every profile it was ever given. It scored 50% on a
# balanced 696-account set: pure chance, silently, for as long as it was wired
# up. One shared definition is what stops that happening again.
FEATURE_NAMES = [
    "profile pic",
    "nums/length username",
    "fullname words",
    "nums/length fullname",
    "name==username",
    "description length",
    "external URL",
    "private",
    "#posts",
    "#followers",
    "#follows",
    "follower_follow_ratio",
    "posts_per_follower",
    "has_bio",
    "engagement_score",
    "suspicious_username",
]


def build_features(followers, following, posts, has_profile_pic, bio_length,
                   has_external_url, is_private, username_digit_ratio=0.0,
                   fullname_words=1, fullname_digit_ratio=0.0,
                   name_equals_username=0, suspicious_username=0):
    """Builds one row of model input, in FEATURE_NAMES order.

    Used by both the live prediction path and the training script, so the two
    cannot disagree about what a feature means or where it sits.
    """
    follower_follow_ratio = followers / (following + 1)
    posts_per_follower = posts / (followers + 1)
    has_bio = 1 if bio_length > 0 else 0
    engagement_score_raw = (posts * 0.4 + followers * 0.4 + following * 0.2) / 1000

    return [
        has_profile_pic,
        username_digit_ratio,
        fullname_words,
        fullname_digit_ratio,
        name_equals_username,
        bio_length,
        has_external_url,
        is_private,
        posts,
        followers,
        following,
        follower_follow_ratio,
        posts_per_follower,
        has_bio,
        engagement_score_raw,
        suspicious_username,
    ]


# Loaded once on first use rather than re-read from disk on every single
# prediction, which is what this module used to do.
_MODEL = None


def _load_model():
    global _MODEL
    if _MODEL is None and os.path.exists(MODEL_PATH):
        with open(MODEL_PATH, "rb") as f:
            _MODEL = pickle.load(f)
    return _MODEL


def name_features(username, full_name):
    """The four name-based inputs the model was trained on, computed the way
    the training dataset defines them. The live site used to leave these at
    fixed defaults even though every scan already has the username and full
    name, so the model was being asked to judge with inputs it never saw in
    training.
    """
    u = username or ""
    f = (full_name or "").strip()
    return {
        "username_digit_ratio": round(sum(c.isdigit() for c in u) / len(u), 4) if u else 0.0,
        "fullname_words": len(f.split()),
        "fullname_digit_ratio": round(sum(c.isdigit() for c in f) / len(f), 4) if f else 0.0,
        "name_equals_username": 1 if f and f.lower() == u.lower() else 0,
    }


def analyze_fake_followers(followers, following, posts,
                           has_profile_pic, bio_length,
                           has_external_url, is_private,
                           username_digit_ratio=0.0,
                           fullname_words=1, fullname_digit_ratio=0.0,
                           name_equals_username=0):
    # WHAT THIS MEASURES: the probability that THIS account is itself a fake
    # or spam account, judged from its own profile. It does not look at the
    # account's followers. Name-based inputs default to neutral values for
    # callers that don't have them; see name_features().
    row = build_features(
        followers, following, posts, has_profile_pic, bio_length,
        has_external_url, is_private, username_digit_ratio,
        fullname_words, fullname_digit_ratio, name_equals_username,
    )
    # Named columns, exactly as the model was trained — a bare array works
    # but makes scikit-learn warn on every single prediction.
    features = pd.DataFrame([row], columns=FEATURE_NAMES)

    # Read back off the shared builder rather than recomputing, so the values
    # reported to the caller are exactly the ones the model was given.
    follower_follow_ratio = row[FEATURE_NAMES.index("follower_follow_ratio")]
    posts_per_follower = row[FEATURE_NAMES.index("posts_per_follower")]
    has_bio = row[FEATURE_NAMES.index("has_bio")]

    model = _load_model()
    if model is not None:
        prediction    = model.predict(features)[0]
        probability   = model.predict_proba(features)[0]
        bot_prob      = float(probability[1])
    else:
        # Rule-based fallback when model file not present
        bot_prob = rule_based_detection(
            followers, following, posts,
            has_profile_pic, bio_length,
            follower_follow_ratio
        )
        prediction = 1 if bot_prob > 0.5 else 0

    bot_percentage = round(bot_prob * 100, 1)

    # ---- Verdict ----
    if bot_percentage >= 70:
        verdict = "High Risk — Likely Fake"
        color   = "red"
    elif bot_percentage >= 40:
        verdict = "Moderate Risk — Suspicious"
        color   = "yellow"
    else:
        verdict = "Low Risk — Likely Genuine"
        color   = "green"

    return {
        "bot_percentage":        bot_percentage,
        "verdict":               verdict,
        "color":                 color,
        "follower_follow_ratio": round(follower_follow_ratio, 2),
        "posts_per_follower":    round(posts_per_follower, 4),
        "has_bio":               bool(has_bio),
        "prediction":            int(prediction)
    }


def rule_based_detection(followers, following, posts,
                          has_profile_pic, bio_length,
                          follower_follow_ratio):
    score = 0.0

    if not has_profile_pic:
        score += 0.30
    if bio_length == 0:
        score += 0.20
    if follower_follow_ratio < 0.1:
        score += 0.25
    if posts == 0:
        score += 0.15
    if following > 2000 and followers < 100:
        score += 0.10

    return min(score, 1.0)