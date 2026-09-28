"""
Tests for the modules that feed the Trust Score.

Each group pins down a flaw found in the 2026-09-25 audit on real scans, so
it can't quietly come back. Run from backend/:
    .\\venv\\Scripts\\python.exe -m pytest tests -q
"""
import warnings

import pytest

warnings.filterwarnings("ignore")

from credential_extractor import extract_credential_claims, calculate_credential_confidence
from engagement_analyzer import analyze_engagement
from fake_follower import analyze_fake_followers, name_features
from misinfo_assessment import assess_text, worst, HARD_FLAG_RISK_FLOOR
from trust_score import calculate_trust_score


# --------------------------------------------------------------------------- #
# Credential Extractor
# --------------------------------------------------------------------------- #
@pytest.mark.parametrize("bio", [
    "Food blogger | Mall Rd, Lahore",          # used to be "Registered Dietitian"
    "Md. Usman | Travel + photography",        # used to be "MD" (Md. = Muhammad)
    "Shop at 23 Main Blvd | Jail Rd branch",   # used to be "Registered Dietitian"
    "Creator. Dreamer. MD of my own startup",  # used to be "MD" (Managing Director)
    "DM for collabs | 3rd year student",
    "Visit us on University Dr",               # Dr = Drive, not doctor
])
def test_bios_without_credentials_claim_nothing(bio):
    assert extract_credential_claims(bio) == []
    assert calculate_credential_confidence(bio)["confidence_score"] is None


@pytest.mark.parametrize("bio,claim", [
    ("Dr. Sara Khan, MD | Cardiologist", "MD"),
    ("Dr Ahmed | Family physician", "Doctor"),
    ("Ayesha Malik, RD | Nutrition tips", "Registered Dietitian"),
    ("Registered Dietitian helping busy mums", "Registered Dietitian"),
    ("MBBS, FCPS | Lahore General", "MBBS"),
    ("PhD in Economics", "PhD"),
    ("CFA charterholder, markets explained", "CFA"),
    ("Certified Personal Trainer 🏋️", "Certified Personal Trainer"),
    ("Prof. of Physics at NUST", "Professor"),
    ("Licensed Therapist (LPC)", "Licensed Therapist"),
])
def test_real_credential_claims_are_still_found(bio, claim):
    assert claim in extract_credential_claims(bio)


# --------------------------------------------------------------------------- #
# Engagement Analyzer
# --------------------------------------------------------------------------- #
def test_no_posts_is_not_measured_rather_than_suspicious():
    r = analyze_engagement(69000, 0, 0, 300, posts_analyzed=0)
    assert r["engagement_score"] is None
    assert r["status"] == "Not measured"
    assert r["measured"] is False


def test_no_cliff_at_band_boundaries():
    """0.74% vs 0.75% on a 500k account used to be 20 vs 50."""
    for low, high in [(0.74, 0.75), (1.49, 1.50), (2.24, 2.25)]:
        a = analyze_engagement(500_000, low / 100 * 500_000, 0, 50)["engagement_score"]
        b = analyze_engagement(500_000, high / 100 * 500_000, 0, 50)["engagement_score"]
        assert abs(b - a) < 1.5, (low, high, a, b)


def test_curve_matches_old_scores_at_band_middles():
    """Scores don't shift on average — the curve passes through the old
    step values at the middle of each old band."""
    bench = 1.5  # Macro tier
    for ratio, old in [(0.25, 20), (0.75, 50), (1.25, 75), (2.0, 90)]:
        likes = ratio * bench / 100 * 500_000
        assert analyze_engagement(500_000, likes, 0, 50)["engagement_score"] == pytest.approx(old, abs=0.5)


def test_engagement_score_never_goes_down_as_rate_goes_up():
    scores = [analyze_engagement(500_000, r / 100 * 500_000, 0, 50)["engagement_score"]
              for r in [x / 20 for x in range(0, 100)]]
    assert scores == sorted(scores)


# --------------------------------------------------------------------------- #
# Trust Score engine
# --------------------------------------------------------------------------- #
def test_unmeasured_engagement_is_left_out_not_zeroed():
    r = calculate_trust_score(2.0, None)
    assert "engagement" not in r["weights_used"]
    assert sum(r["weights_used"].values()) == pytest.approx(100.0)
    assert r["verdict"] == "Trusted"


def test_weights_always_sum_to_100():
    mis = {"status": "success", "risk_score": 10}
    cred = {"confidence_score": 60}
    for eng in (None, 50):
        for m in (None, mis):
            for c in (None, cred):
                w = calculate_trust_score(5, eng, m, c)["weights_used"]
                assert sum(w.values()) == pytest.approx(100.0)


# --------------------------------------------------------------------------- #
# Misinformation: AI classifier cross-checked with red flags
# --------------------------------------------------------------------------- #
def fake_model(category, credible, financial=0.0, other=None):
    """Stand-in for classify_text, so the rule is tested without the 1 GB model."""
    scores = {
        "credible": credible, "health_misinformation": 0.0, "political_propaganda": 0.0,
        "financial_scam": financial, "sensational_clickbait": 0.0, "urdu_misinformation": 0.0,
    }
    scores.update(other or {})
    top = max(scores, key=scores.get)
    return lambda _text: {
        "status": "success", "primary_category": top, "confidence": scores[top],
        "category_scores": scores, "risk_score": round(100 * (1 - credible)),
        "misinformation_flag": top != "credible",
    }


def test_promo_caption_labelled_scam_without_red_flag_is_not_counted():
    """The real false alarm: 'Follow @x to learn how to build an expert brand'
    was financial_scam 99%."""
    r = assess_text("Follow @theozairjk to learn how to build an expert brand 🚀",
                    fake_model("financial_scam", credible=0.01, financial=0.98))
    assert r["misinformation_flag"] is False
    assert r["risk_score"] <= 5
    assert r["model_category"] == "financial_scam"   # still shown, for transparency
    assert "wasn't counted" in r["note"]


def test_scam_with_hard_red_flag_is_counted():
    r = assess_text("GUARANTEED 300% profit in 7 days, only 3 slots left",
                    fake_model("financial_scam", credible=0.0, financial=1.0))
    assert r["misinformation_flag"] is True
    assert r["risk_score"] >= HARD_FLAG_RISK_FLOOR
    assert r["corroborated"] is True


def test_red_flag_catches_what_the_model_missed():
    """'Invest in my forex scheme, guaranteed 50% monthly returns' -> model said credible."""
    r = assess_text("Invest in my forex scheme, guaranteed 50% monthly returns, zero risk",
                    fake_model("credible", credible=0.97, financial=0.01))
    assert r["misinformation_flag"] is True
    assert r["risk_score"] >= HARD_FLAG_RISK_FLOOR


def test_health_claim_is_reported_as_health_misinformation():
    r = assess_text("This one herb cures diabetes permanently",
                    fake_model("credible", credible=0.53))
    assert r["primary_category"] == "health_misinformation"
    assert r["misinformation_flag"] is True


def test_uncorroborated_labels_count_only_as_much_as_they_are_right():
    """Without a red flag, a label is weighted by its measured held-out
    precision (political propaganda: 0.49). Real case: a sports team's bio
    'The official Instagram account of the Baltimore Ravens.' came back
    political_propaganda 95% and was scored as near-certain misinformation."""
    r = assess_text("Some political claim",
                    fake_model("political_propaganda", credible=0.2,
                               other={"political_propaganda": 0.8}))
    assert r["primary_category"] == "political_propaganda"
    assert r["risk_score"] == round(80 * 0.49)
    assert "49%" in r["note"]


def test_reliable_label_still_counts_almost_fully():
    r = assess_text("Some health claim",
                    fake_model("health_misinformation", credible=0.1,
                               other={"health_misinformation": 0.9}))
    assert r["risk_score"] == round(90 * 0.89)


def test_worst_text_decides():
    a = {"status": "success", "risk_score": 10}
    b = {"status": "success", "risk_score": 90}
    assert worst([a, b, {"status": "error"}]) is b
    assert worst([{"status": "error"}]) is None


# --------------------------------------------------------------------------- #
# Fake-account model: name inputs
# --------------------------------------------------------------------------- #
def test_name_features_match_the_training_definitions():
    f = name_features("sarah_88374621", "Sarah")
    assert f["username_digit_ratio"] == pytest.approx(8 / 14, abs=1e-3)
    assert f["fullname_words"] == 1
    assert f["name_equals_username"] == 0
    assert name_features("cristiano", "Cristiano")["name_equals_username"] == 1
    assert name_features("", "")["fullname_words"] == 0


def test_model_still_separates_real_creators_from_bots_with_name_inputs():
    creator = analyze_fake_followers(500000, 600, 1200, 1, 90, 1, 0,
                                     **name_features("lahore_foodie", "Lahore Foodie"))
    bot = analyze_fake_followers(12, 4200, 0, 0, 0, 0, 0,
                                 **name_features("user8837462", ""))
    assert creator["bot_percentage"] < 20
    assert bot["bot_percentage"] > 80


# --------------------------------------------------------------------------- #
# Credential Extractor: registry cross-check (no network — registers faked)
# --------------------------------------------------------------------------- #
import credential_extractor as ce


def _registers(monkeypatch, pmdc=None, npi=None, down=False):
    def fake(results):
        def lookup(name):
            if down:
                raise ConnectionError("register down")
            return [dict(r) for r in (results or {}).get(name, [])]
        return lookup
    monkeypatch.setattr(ce, "_pmdc_lookup", fake(pmdc))
    monkeypatch.setattr(ce, "_npi_lookup", fake(npi))


ACTIVE = {"registry": "PMDC (Pakistan)", "registration_no": "104551-P", "name": "AYESHA SIDDIQA",
          "status": "Active", "active": True}


def test_doctor_found_active_in_pmdc_scores_high(monkeypatch):
    _registers(monkeypatch, pmdc={"AYESHA SIDDIQA": [ACTIVE]})
    r = ce.calculate_credential_confidence("Dr. Ayesha Siddiqa | skin tips", False, "Ayesha Siddiqa")
    assert r["confidence_score"] == 90 and r["checked"] is True
    assert "104551-P" in r["verdict"]


def test_several_doctors_with_the_same_name_is_weaker_evidence(monkeypatch):
    _registers(monkeypatch, pmdc={"ALI KHAN": [dict(ACTIVE, name="ALI KHAN")] * 4})
    r = ce.calculate_credential_confidence("MBBS | health", False, "Ali Khan")
    assert r["confidence_score"] == 75
    assert "4 registered doctors share this name" in r["verdict"]


def test_doctor_claim_not_in_any_register_scores_low(monkeypatch):
    _registers(monkeypatch)
    r = ce.calculate_credential_confidence("MBBS | health tips", False, "Zxqv Plonkington")
    assert r["confidence_score"] == 15
    assert "no registered doctor" in r["verdict"]


def test_inactive_license_is_reported(monkeypatch):
    _registers(monkeypatch, pmdc={"SARA KHAN": [dict(ACTIVE, name="SARA KHAN", status="Expired", active=False)]})
    r = ce.calculate_credential_confidence("Dr. Sara Khan", False, "Sara Khan")
    assert r["confidence_score"] == 30 and "not active" in r["verdict"]


def test_uncheckable_claims_are_not_scored(monkeypatch):
    _registers(monkeypatch)
    assert ce.calculate_credential_confidence("CFA charterholder", False, "Ali Raza")["confidence_score"] is None
    assert ce.calculate_credential_confidence("Dr Ahmed | GP", False, "Ahmed")["confidence_score"] is None


def test_register_being_down_is_not_a_verdict(monkeypatch):
    _registers(monkeypatch, down=True)
    r = ce.calculate_credential_confidence("MBBS", False, "Real Person")
    assert r["confidence_score"] is None and r["checked"] is False


def test_name_is_cleaned_before_lookup():
    assert ce.candidate_names("Dr. Ayesha Siddiqa, MBBS", "Dr. Ayesha Siddiqa 🌸") == ["AYESHA SIDDIQA"]
