"""
The number on the badge, computed by the website's own Trust Score engine.

The badge used to place every "clean" post inside a fixed 82-96 band and only
move it down for scam patterns, so almost every ordinary reel read 96 — a
number that didn't come from any model. This replaces it with
`backend/trust_score.py`, fed exactly the way the website's /analyze-live feeds
it, so the badge and the website compute the same thing the same way:

  Fake-account (Random Forest)  - the poster's own profile        base weight 25
  Engagement (rule-based)       - the poster's last 12 posts       base weight 20
  Misinformation (hybrid)       - THIS reel's caption, speech, bio  base weight 25
  Credential claims             - a doctor claim checked in the PMDC / US NPI
                                  registers; unscored if it can't be checked   base weight 10

Weights re-normalise over whichever modules actually ran (the website's rule),
so nothing is ever filled in with a guessed number.

One extra rule for posts: if the post itself carries hard scam patterns, the
colour the badge shows (from analyzer.py's red-flag ladder) can be more severe
than the account-level score. The number is then capped into that colour's
range, and the badge says so, so the number and the colour never disagree.
"""
from __future__ import annotations

import instagram_data  # noqa: F401  (puts backend/ on sys.path)

from credential_extractor import calculate_credential_confidence  # type: ignore
from engagement_analyzer import analyze_engagement  # type: ignore
from misinfo_assessment import assess_text, worst  # type: ignore
from trust_score import calculate_trust_score, verdict_for  # type: ignore

# The website's tiers (trust_score.verdict_for): 70+ Trusted, 40-69 Moderate
# Risk, under 40 High Risk. The badge's colours map onto them.
_LEVEL_FOR_TIER = {"Trusted": "clean", "Moderate Risk": "caution", "High Risk": "danger"}
# If the post's own content is more severe than the account-level score,
# the number is capped to the top of that colour's range.
_CAP = {"danger": 39.0, "warning": 54.0, "caution": 69.0}
_ORDER = ["unknown", "clean", "caution", "warning", "danger"]

MODULE_LABELS = {
    "fake_follower": "Account authenticity",
    "engagement": "Engagement",
    "misinformation": "This post's content",
    "credential": "Credential claims",
}


def misinformation(texts: list[tuple[str, str, dict]]) -> dict | None:
    """Apply the website's misinfo_assessment to each text (caption, speech,
    bio) separately and keep the riskiest, exactly like the site does for a
    bio and its captions. `texts` holds (source, text, classifier response)."""
    assessed = []
    for source, text, resp in texts:
        model = (resp or {}).get("model_result")
        if not text or not model:
            continue
        a = assess_text(text, lambda _t, m=model: m)
        if a.get("status") == "success":
            a["source"] = source
            assessed.append(a)
    return worst(assessed)


def engagement(profile: dict, eng: dict) -> dict | None:
    if not (profile.get("available") and eng.get("available")):
        return None
    return analyze_engagement(
        profile.get("followers") or 0, eng.get("avg_likes") or 0,
        eng.get("avg_comments") or 0, profile.get("posts") or 0,
        posts_analyzed=eng.get("posts_analyzed"))


def credential(profile: dict) -> dict | None:
    """The Credential Extractor on the poster's bio. Blocking (it may look the
    name up in the PMDC / US NPI doctor registers), so call it in a thread."""
    if not profile.get("available"):
        return None
    return calculate_credential_confidence(profile.get("biography") or "",
                                           bool(profile.get("is_verified")),
                                           full_name=profile.get("full_name") or "")


def trust_score(account: dict, profile: dict, eng: dict,
                misinfo: dict | None, ladder_level: str, cred: dict | None = None) -> dict | None:
    """The badge's score, or None when the account couldn't be checked (the
    engine needs the fake-account result, as the website does)."""
    if not account.get("available") or account.get("prob_fake") is None:
        return None
    bot_pct = round(float(account["prob_fake"]) * 100, 1)
    eng_result = engagement(profile, eng)
    ts = calculate_trust_score(
        bot_pct,
        eng_result.get("engagement_score") if eng_result else None,
        misinfo,
        cred,
    )
    score = float(ts["trust_score"])
    tier_level = _LEVEL_FOR_TIER.get(ts["verdict"], "caution")

    level = max(tier_level, ladder_level, key=_ORDER.index)
    capped_by = None
    if level != tier_level and level in _CAP and score > _CAP[level]:
        score = _CAP[level]
        capped_by = level
    verdict = verdict_for(score)[0]

    return {
        "score": score,
        "level": level,
        "verdict": verdict,
        "capped_by_content": capped_by,
        "uncapped_score": float(ts["trust_score"]),
        "weights_used": ts["weights_used"],
        "module_scores": ts["module_scores"],
        "engagement": eng_result,
        "credential": cred,
        "misinformation": misinfo,
        "bot_percentage": bot_pct,
    }
