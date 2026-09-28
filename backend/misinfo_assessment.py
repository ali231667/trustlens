# ============================================================
# TrustLens — Misinformation assessment (AI classifier + rule check)
# ============================================================
#
# WHY THIS EXISTS
# ---------------
# The XLM-RoBERTa classifier's "financial_scam" class was trained on an SMS
# spam dataset used as a stand-in (no public Instagram-scam dataset exists).
# SMS spam is mostly advertising, so the class learned "promotional wording
# = scam". Measured on real scans (2026-09-25): "Follow @x to learn how to
# build an expert brand" -> financial_scam 99%; an earphones advert ->
# financial_scam 100%; a bio that only says "Biz inquiries: <email>" -> 85%.
# On 20 ordinary creator captions it raised 8 false alarms, and because the
# worst of ~13 texts decides the module score, one false alarm was enough to
# zero the whole misinformation score for almost any creator who promotes
# anything.
#
# THE RULE
# --------
# - A "financial_scam" label only counts when a hard red flag backs it up
#   (guaranteed returns, impossible claims, disguised links, ...). Without
#   one, that single class's probability is set aside and the text is judged
#   on the remaining classes.
# - A hard red flag counts even when the model says "credible", because the
#   model also misses concrete scam wording ("guaranteed 50% monthly
#   returns" -> credible, risk 3).
# - The other classes (health, political, clickbait, Urdu) are used as the
#   model gives them. The proxy-data problem was measured in the financial
#   class specifically; nothing was changed without evidence.
#
# The browser extension already judged captions this way (red flags lead,
# the category only corroborates). The website now uses the same rules, from
# the same red_flags.py, so the two can't disagree about the same caption.
#
# HONESTY: the red flags are hand-written regular expressions, NOT AI. This
# module is a hybrid — AI classifier + rule-based corroboration — and must
# be described that way.

from red_flags import detect_red_flags

# The one class trained on proxy data and measured to over-fire.
UNRELIABLE_ALONE = "financial_scam"

# How often each label was actually right when the model gave it, measured on
# the held-out test set (precision column of the classification report in
# CLAUDE.md / misinfo_classifier/README.md). Without a red flag to back it, a
# label counts only as much as it has been shown to be right. Measured case
# that prompted this: "The official Instagram account of the Baltimore
# Ravens." was labelled political_propaganda at 95% and scored 5/100.
LABEL_PRECISION = {
    "health_misinformation": 0.89,
    "political_propaganda": 0.49,
    "sensational_clickbait": 0.60,
    "urdu_misinformation": 0.44,
}

# A hard red flag is a concrete scam signature, not a style of writing, so a
# text carrying one is scored as clearly risky even if the model disagreed.
HARD_FLAG_RISK_FLOOR = 85


def assess_text(text, classify):
    """Assess one bio or caption.

    `classify` is the model's classify_text (passed in so this logic can be
    tested without loading a 1 GB model). Returns the model's own verdict
    plus the verdict actually used for scoring, and why they differ.
    """
    model = classify(text)
    if model.get("status") != "success":
        return model

    probs = dict(model.get("category_scores") or {})
    model_category = model.get("primary_category")
    model_risk = model.get("risk_score")

    hard = [f for f in detect_red_flags(text) if f["severity"] == "high"]
    flags = [{"type": f["type"], "title": f["title"], "severity": f["severity"]} for f in hard]

    if hard:
        types = {f["type"] for f in hard}
        if "health_claim" in types:
            category = "health_misinformation"
        elif model_category != "credible":
            category = model_category
        else:
            category = "scam_pattern"
        risk = max(model_risk or 0, HARD_FLAG_RISK_FLOOR)
        note = "Counted: " + ", ".join(f["title"].lower() for f in hard) + "."
        corroborated = True
    else:
        # Set the unreliable class aside and judge the text on the rest.
        remaining = {k: v for k, v in probs.items() if k != UNRELIABLE_ALONE}
        category = max(remaining, key=remaining.get) if remaining else "credible"
        risk = round(100 * sum(p * LABEL_PRECISION.get(c, 1.0)
                               for c, p in probs.items()
                               if c not in ("credible", UNRELIABLE_ALONE)))
        risk = max(0, min(100, risk))
        corroborated = False
        if model_category == UNRELIABLE_ALONE:
            note = ("The AI labelled this 'financial scam', but no concrete scam pattern was "
                    "found, so it wasn't counted — that label is unreliable on promotional captions.")
        elif model_category in LABEL_PRECISION and LABEL_PRECISION[model_category] < 0.8:
            label = model_category.replace("_", " ")
            note = (f"The AI labelled this '{label}', a label that was right "
                    f"{round(LABEL_PRECISION[model_category] * 100)}% of the time on test data. "
                    f"With no concrete red flag behind it, it counts only that much.")
        else:
            note = None

    return {
        "status": "success",
        "input_type": model.get("input_type", "caption"),
        # What the score actually uses.
        "misinformation_flag": category != "credible",
        "primary_category": category,
        "confidence": round(probs.get(category, model.get("confidence", 0)), 4) if category in probs else model.get("confidence"),
        "risk_score": risk,
        # What the model said on its own, kept for transparency.
        "model_category": model_category,
        "model_risk_score": model_risk,
        "category_scores": probs,
        "red_flags": flags,
        "corroborated": corroborated,
        "note": note,
    }


def worst(assessments):
    """The single riskiest text decides the module score — one scam caption
    is enough to matter. Safe now that uncorroborated promo labels no longer
    count."""
    ok = [a for a in assessments if a.get("status") == "success"]
    return max(ok, key=lambda a: a["risk_score"]) if ok else None
