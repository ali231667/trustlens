# ============================================================
# TrustLens — Trust Score Engine
# ============================================================
#
# Every point of weight always goes to a real, computed signal — never a
# flat placeholder number. Fake Follower and Engagement always have real
# data (every account has followers/engagement numbers), so they're always
# in play. Misinformation and Credential only join in when there's actually
# something to check for that specific profile (bio/caption text, or a
# credential claim). Whatever DOES apply splits 100% of the weight between
# them, proportional to their original relative importance from the scope
# document (25 : 20 : 25 : 10) — so the math always uses only real numbers,
# and always sums to exactly 100%.

# Relative importance from the scope document's weight table, for the four
# modules currently built. (Deepfake 10% and Follower Spike Detection 10%
# are in the scope doc's table too, but neither is a real module yet —
# not "missing weight", just not part of this calculation at all.)
BASE_WEIGHTS = {
    "fake_follower": 25,
    "engagement":    20,
    "misinformation": 25,
    "credential":    10,
}


def verdict_for(score):
    """The verdict tiers, in one place. Used by live scans below and by the
    admin panel when an upheld dispute sets a corrected score — both must
    land on exactly the same boundaries, or a corrected 69.5 could be called
    "Trusted" in one place and "Moderate Risk" in another. The landing
    page's score key (frontend Landing.jsx, SCORE_BANDS) mirrors these."""
    if score >= 70:
        return ("Trusted", "green", "✅",
                "This account appears authentic and credible")
    if score >= 40:
        return ("Moderate Risk", "yellow", "🟡",
                "Some suspicious signals detected — verify before trusting")
    return ("High Risk", "red", "🔴",
            "Multiple fraud signals detected - do not trust this account")


def calculate_trust_score(bot_percentage, engagement_score, misinfo_result=None, credential_result=None):

    # ---- Convert bot percentage to a 0-100 score ----
    # High bot percentage = low score
    fake_follower_score = max(0, 100 - bot_percentage)

    # Misinformation check only produces a usable score when there was bio
    # or caption text to classify.
    misinfo_status = (misinfo_result or {}).get("status")
    misinfo_applicable = misinfo_status == "success"
    misinfo_score = None
    if misinfo_applicable:
        risk_score = (misinfo_result or {}).get("risk_score") or 0
        misinfo_score = max(0, 100 - risk_score)

    # Credential Extractor only produces a usable score when the bio
    # actually claims a credential ("Dr.", "CFA", etc.). confidence_score is
    # already 0-100 with higher = more credible, so no inversion needed
    # (unlike misinfo's risk_score, which runs the opposite direction).
    credential_score = (credential_result or {}).get("confidence_score")
    credential_applicable = credential_score is not None

    # ---- Which modules are in play for this specific scan ----
    # Engagement is None when no posts could be read — left out rather than
    # scored as zero, the same rule misinformation follows with no text.
    scores = {"fake_follower": fake_follower_score}
    if engagement_score is not None:
        scores["engagement"] = engagement_score
    if misinfo_applicable:
        scores["misinformation"] = misinfo_score
    if credential_applicable:
        scores["credential"] = credential_score

    # ---- Redistribute weight proportionally among only what applied ----
    # Rounding each share independently (e.g. 31.25, 25.0, 31.25, 12.5) can
    # land on 99.99 or 100.01 instead of exactly 100 — fine for the actual
    # math (which uses the unrounded fractions below), but would look like
    # a bug if a panelist adds up the displayed percentages by hand. So the
    # last module's displayed share absorbs the rounding remainder, and the
    # displayed numbers always sum to exactly 100.0.
    total_base_weight = sum(BASE_WEIGHTS[m] for m in scores)
    modules = list(scores.keys())
    weights_used = {}
    running_total = 0.0
    for m in modules[:-1]:
        share = round(BASE_WEIGHTS[m] / total_base_weight * 100, 2)
        weights_used[m] = share
        running_total += share
    weights_used[modules[-1]] = round(100 - running_total, 2)

    weighted_score = sum(scores[m] * (BASE_WEIGHTS[m] / total_base_weight) for m in scores)
    final_score = round(weighted_score, 1)

    # ---- Kill Switch: the account itself looks fake ----
    # bot_percentage is the fake-account model's probability that THIS
    # account is a fake/spam account (not a share of its followers). At 85%+
    # nothing else about it can be trusted, so the score is capped.
    if bot_percentage >= 85:
        final_score = max(final_score, 0)
        final_score = min(final_score, 15)

    verdict, color, emoji, description = verdict_for(final_score)

    return {
           "trust_score": final_score,
           "verdict": verdict,
           "color": color,
           "emoji": emoji,
           "description": description,
           "weights_used": weights_used,   # e.g. {"fake_follower": 31.25, "engagement": 25, ...} — always sums to 100
           "module_scores": scores,        # the real 0-100 score each applicable module contributed
       }
