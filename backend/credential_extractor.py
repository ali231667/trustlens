# ============================================================
# TrustLens — Credential Extractor Module
# Finds professional credential claims in a bio and, where an official public
# register exists, checks them against it.
# ============================================================

import re
import time

import requests

# Known credential patterns.
#
# Full phrases ("Registered Dietitian") are matched in any case, but short
# abbreviations are CASE-SENSITIVE and only count in the form people use for
# qualifications. The old patterns matched any "rd"/"md" in any case, and on
# real Pakistani bios that meant: "Mall Rd, Lahore" -> Registered Dietitian,
# "Md. Usman" (short for Muhammad) -> MD, "MD of my startup" (Managing
# Director) -> MD. Those accounts then LOST points for an unverified medical
# claim they never made. Precision matters more than recall here: missing a
# rare real credential only leaves the module out, while a false match
# actively lowers an innocent account's score.
CREDENTIAL_PATTERNS = {
    "MBBS": r"\bMBBS\b",
    # "M.D." with dots, or ", MD" after a name ("Sara Khan, MD").
    "MD": r"\bM\.D\.|,\s*MD\b",
    "PhD": r"(?i:\bPh\.?\s?D\b)",
    "CFA": r"\bCFA\b",
    "CPA": r"\bCPA\b",
    "Certified Financial Planner": r"(?i:\bCertified Financial Planner\b)|\bCFP\b",
    # "RD"/"RDN" only after a name ("Ayesha Malik, RD"); "RDN" alone is unambiguous.
    "Registered Dietitian": r"(?i:\bRegistered Dietitian\b)|,\s*RDN?\b|\bRDN\b",
    "Licensed Therapist": r"(?i:\bLicensed Therapist\b)|\bLPC\b|\bLCSW\b",
    "Esq (Lawyer)": r"\bEsq\b|(?i:\bAttorney at Law\b)",
    "Professor": r"\bProf\.|(?i:\bProfessor\b)",
    # "Dr" followed by a capitalised name ("Dr. Sara", "Dr Ahmed") — not
    # "Jail Dr" (Drive) at the end of an address.
    "Doctor": r"\bDr\.?\s+[A-Z][a-z]",
    "Nutritionist": r"(?i:\bNutritionist\b)",
    "Certified Personal Trainer": r"(?i:\bCertified Personal Trainer\b)|\bCPT\b",
}

_COMPILED_PATTERNS = {name: re.compile(p) for name, p in CREDENTIAL_PATTERNS.items()}


def extract_credential_claims(bio_text: str) -> list:
    """
    Scans bio text for known professional credential patterns.
    Returns a list of matched credential claims.
    """
    if not bio_text:
        return []

    return [name for name, pattern in _COMPILED_PATTERNS.items() if pattern.search(bio_text)]


# --------------------------------------------------------------------------- #
# Cross-checking a claim against an official public register
# --------------------------------------------------------------------------- #
# A credential only affects the Trust Score if it was actually checked. The
# old version scored every claim 35 (unverified account) or 60 (verified), so
# a real doctor and a fake one got the same number — nothing was checked.
#
# Doctors can be checked for free, with no key or signup, against:
#   - PMDC (Pakistan Medical & Dental Council) practitioners register — the
#     same lookup its public "Search Doctor" feature on pmdc.pk performs.
#   - The US NPI Registry (CMS), an official public API.
# Other credentials (CFA, PhD, dietitian, ...) have no free public register,
# so they are reported as "claimed, can't be checked" and are NOT scored.
# (Google's Custom Search API, the original plan, is closed to new customers
# and shuts down on 1 January 2027.)
#
# Honest limit: a match proves that A registered doctor has this name, not
# that this Instagram account is that doctor. Common names can match several
# people, and the result says how many did.
MEDICAL_CLAIMS = {"MBBS", "MD", "Doctor"}

PMDC_URL = "https://hospitals-inspections.pmdc.pk/api/DRC/GetData"
NPI_URL = "https://npiregistry.cms.hhs.gov/api/"
_CACHE_TTL = 24 * 3600
_cache: dict = {}

_TITLES = re.compile(r"^(?:dr|doctor|prof|professor|mr|mrs|ms|miss|engr|sir)\b\.?\s*", re.I)
_BIO_DR_NAME = re.compile(r"\bDr\.?\s+([A-Z][A-Za-z'\-]+(?:\s+[A-Z][A-Za-z'\-]+){1,3})")


def _norm(name) -> str:
    """'Dr. Ayesha  Siddiqa 🌸' -> 'AYESHA SIDDIQA'"""
    name = str(name or "").strip()
    while True:
        stripped = _TITLES.sub("", name)
        if stripped == name:
            break
        name = stripped
    name = re.sub(r"[^A-Za-z\s]", " ", name)
    return re.sub(r"\s+", " ", name).strip().upper()


def candidate_names(bio_text: str, full_name: str = "") -> list:
    """Names worth looking up: the Instagram display name and any 'Dr. <Name>'
    written in the bio. Single words are skipped — far too ambiguous."""
    names = []
    for raw in [full_name] + _BIO_DR_NAME.findall(bio_text or ""):
        n = _norm(raw)
        if len(n.split()) >= 2 and n not in names:
            names.append(n)
    return names[:3]


def _cached(key, fetch):
    hit = _cache.get(key)
    if hit and hit[0] > time.time():
        return hit[1]
    value = fetch()
    _cache[key] = (time.time() + _CACHE_TTL, value)
    return value


def _pmdc_lookup(name: str) -> list:
    def fetch():
        r = requests.post(
            PMDC_URL, data={"RegistrationNo": "", "Name": name, "FatherName": ""},
            headers={"Content-Type": "application/x-www-form-urlencoded; charset=UTF-8"},
            timeout=10)
        r.raise_for_status()
        data = r.json()
        if not data.get("status"):
            return []
        return [{
            "registry": "PMDC (Pakistan)",
            "registration_no": d.get("RegistrationNo"),
            "name": d.get("Name"),
            "status": d.get("Status"),
            "active": str(d.get("Status") or "").strip().lower() == "active",
            "qualifications": d.get("Qualifications"),
            "valid_upto": d.get("ValidUpto"),
        } for d in data.get("data") or [] if _norm(d.get("Name")) == name]
    return _cached(("pmdc", name), fetch)


def _npi_lookup(name: str) -> list:
    parts = name.split()
    first, last = parts[0], parts[-1]

    def fetch():
        r = requests.get(NPI_URL, params={
            "version": "2.1", "first_name": first, "last_name": last,
            "enumeration_type": "NPI-1", "limit": 50}, timeout=10)
        r.raise_for_status()
        out = []
        for res in r.json().get("results") or []:
            b = res.get("basic") or {}
            full = _norm(f"{b.get('first_name', '')} {b.get('middle_name', '')} {b.get('last_name', '')}")
            short = _norm(f"{b.get('first_name', '')} {b.get('last_name', '')}")
            if name not in (full, short):
                continue
            out.append({
                "registry": "US NPI",
                "registration_no": res.get("number"),
                "name": short.title(),
                "status": "Active" if b.get("status") == "A" else (b.get("status") or "Unknown"),
                "active": b.get("status") == "A",
                "qualifications": b.get("credential"),
                "valid_upto": None,
            })
        return out
    return _cached(("npi", name), fetch)


def verify_medical_claim(bio_text: str, full_name: str = "") -> dict:
    """Look the doctor's name up in PMDC, then in the US NPI register."""
    names = candidate_names(bio_text, full_name)
    if not names:
        return {"checked": False, "status": "no_name", "registry": None,
                "searched_names": [], "matches": [],
                "note": "no full name (first and last) to look up"}

    matches, errors, attempts = [], [], 0
    for label, lookup in (("PMDC", _pmdc_lookup), ("US NPI", _npi_lookup)):
        for n in names:
            attempts += 1
            try:
                matches += lookup(n)
            except Exception as exc:   # a register being down is not a verdict
                errors.append(f"{label}: {type(exc).__name__}")
        if matches:
            break

    if matches:
        active = [m for m in matches if m["active"]]
        return {"checked": True, "status": "found_active" if active else "found_inactive",
                "registry": matches[0]["registry"], "searched_names": names,
                "matches": matches[:5], "match_count": len(matches),
                "active_count": len(active)}
    if errors and len(errors) == attempts:
        return {"checked": False, "status": "unavailable", "registry": None,
                "searched_names": names, "matches": [],
                "note": "the registers couldn't be reached (" + ", ".join(errors) + ")"}
    return {"checked": True, "status": "not_found",
            "registry": "PMDC (Pakistan) and US NPI Registry",
            "searched_names": names, "matches": [], "match_count": 0, "active_count": 0}


def calculate_credential_confidence(bio_text: str, is_verified: bool = False,
                                    full_name: str = "", verify: bool = True) -> dict:
    """
    Finds credential claims in the bio and, where an official register exists,
    checks them. `confidence_score` stays None unless something was actually
    checked, and the Trust Score then leaves this module out rather than guess.
    """
    claims = extract_credential_claims(bio_text)
    if not claims:
        return {"claims_found": [], "confidence_score": None, "checked": False,
                "verification": None, "unchecked_note": None,
                "verdict": "No credential claims detected in bio"}

    medical = [c for c in claims if c in MEDICAL_CLAIMS]
    others = [c for c in claims if c not in MEDICAL_CLAIMS]
    unchecked_note = None
    if others:
        unchecked_note = (f"{', '.join(others)}: no free public register exists to check "
                          f"{'this' if len(others) == 1 else 'these'} against, so not scored.")

    if not medical or not verify:
        return {"claims_found": claims, "confidence_score": None, "checked": False,
                "verification": {"checked": False, "status": "not_checkable"},
                "unchecked_note": unchecked_note,
                "verdict": "Claimed in the bio, but there's no public register to check it against, so it isn't scored"}

    v = verify_medical_claim(bio_text, full_name)
    status = v["status"]
    if status == "found_active":
        several = v.get("match_count", 0) > 1
        score = 75 if several else 90
        if is_verified:
            score += 5          # Instagram has confirmed this account's identity
        who = (f"{v['match_count']} registered doctors share this name" if several
               else f"registration {v['matches'][0]['registration_no']}")
        verdict = f"Found in the {v['registry']} register with an active license ({who})"
    elif status == "found_inactive":
        score = 30
        verdict = f"Found in the {v['registry']} register, but the license is not active"
    elif status == "not_found":
        score = 15
        verdict = ("Claims to be a doctor, but no registered doctor with this name was found "
                   "in PMDC (Pakistan) or the US NPI Registry")
    else:   # no_name / unavailable: nothing was actually checked
        score = None
        verdict = "Claims to be a doctor, but this couldn't be checked: " + v.get("note", "")

    return {"claims_found": claims, "confidence_score": score, "checked": score is not None,
            "verification": v, "unchecked_note": unchecked_note, "verdict": verdict}
