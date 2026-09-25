# Session Handoff — TrustLens FYP

Paste this whole file as your first message to Claude Code in this project. `CLAUDE.md` (in the project root) has the full technical reference — read it first. This file is the narrative handoff: where things stand right now, what to do next, and how to work with Hamza.

---

## Read CLAUDE.md first, then read this

I'm Hamza, a beginner CS student building my Final Year Project, TrustLens, mostly solo with AI help. I've been working with Claude (chat) for weeks on this and I'm now moving to Claude Code inside VS Code to continue. Everything Claude and I did together is documented in `CLAUDE.md` — please treat it as ground truth about the project's current real state. Nothing in this handoff should be treated as "let's redo this" — it's "here's where we are, keep going."

## How I need you to work with me

- **You write the code, not me.** I'm not going to be pasting code back and forth like before — you have direct access to this project, so you make the edits yourself.
- **Before doing any piece of work, plan first.** Research the problem properly, compare realistic alternative approaches, and work out the best/most optimal one — don't just go with the first idea. Tell me what you're going to do and how (the plan and the reasoning for picking that approach over the alternatives) BEFORE you start writing or changing anything. Wait for me to be on the same page before proceeding, unless it's something trivial.
- **After finishing any piece of work, give me a detailed summary of that pass** — what you actually did, and the reasoning for the specific decisions you took (especially anywhere you chose one approach over another). I want to actually understand what changed and why, not just "done."
- **Never push to GitHub until I've explicitly approved it.** Finish the work, show me the summary, and wait for my go-ahead before running `git push` (or even `git commit`, if there's any doubt) — this is a hard rule now, not a suggestion.
- I'm a total beginner. Explain every step literally when something needs my input — which key, what to type, where to click. Don't assume I know Git, terminal commands, or anything technical.
- Explain WHY before HOW.
- Never build fake/placeholder logic and call it done. If something can't be real right now, say so clearly and mark it as a known gap.
- I prefer VS Code's built-in terminal. I've had real trouble before with PowerShell vs CMD syntax differences (e.g. `rmdir /s /q` failing because I'm in PowerShell) — please account for that.
- Keep technical explanations in plain, simple words — my panel will grill me on details, so I actually need to understand what's built, not just have it work.
- I panic when something looks broken. Please calmly check first whether it's a real bug or something simple (wrong folder, stale terminal, paste error) before assuming the worst, and reassure me once you know which it is.
- Before big new work, give me a quick plain-language overview of what we're about to do and why (this is the same thing as the planning step above — the plan itself should include this).
- Be honest with me about limitations — especially anything the panel might ask about, like "is this really AI or just calling an API." I'd rather know the real answer now than get caught off guard.

## Where the project actually stands right now

Five modules are genuinely built and tested end-to-end: **Data Ingestion**, **Fake Follower Detection** (real trained ML, 99.3% accuracy), **Engagement Analyzer** + **Comment Authenticity**, **Credential Extractor** (partial — no external verification, see below), **Misinformation Classifier** (real trained ML, 77% test accuracy, 6 classes), and **Trust Score Engine**. Full details, file locations, and exact status of every one of the 12 scoped modules are in `CLAUDE.md` — please read that table before touching any backend code.

The frontend has all 8 planned pages built with a real, deliberately non-generic design system (also fully documented in `CLAUDE.md` — please match it exactly for any new UI work, don't default to generic templates). The Landing → Results flow is fully wired to the live backend and works end-to-end with real data. **Dashboard and Comparison pages currently show hardcoded sample data, not real scan history — this is a known, undisclosed-to-viewers gap, not a secret, but important to be upfront about if it comes up.**

## What's immediately next — in priority order

1. **Integrate my teammate Umar's modules.** He built at least a browser extension and possibly one more module. I've asked him to zip and send me just his new folder(s) directly (not via Git — we decided against that to avoid confusion, since neither of us is confident with merge conflicts). When I paste you a screenshot of what's inside his zip, help me figure out where it belongs in the project structure, what dependencies it needs, and how to actually run/test it — without touching or overwriting anything of mine.

2. **Decide whether to wire Misinformation Classifier into captions, not just bio text.** Right now `classify_text()` only runs on the profile's bio in `/analyze-live`. The scope doc wants it on captions and Whisper-transcribed reel text too. Captions should be reachable via the existing `fetch_engagement_data` post data; Whisper/reel transcription is a whole unbuilt module (#12) — probably too much for remaining time, but captions-only might be feasible. Ask me before starting this — it depends how much time I actually have left before the panel.

3. **Decide whether Dashboard/Comparison get wired to real data**, or whether I present them honestly as "designed, not yet data-connected" to the panel. This needs a real decision on scope vs. time remaining — please help me think through the tradeoff rather than just building it.

4. **Panel defense prep.** A lot of groundwork exists already from earlier sessions (see the last section of CLAUDE.md) — bot detection theory, model justifications, Trust Score reasoning, business model, tool comparisons, and how to handle "is this really AI" style questions. If I ask for more prep, build on that instead of starting fresh, and ask me to summarize what's already covered if you need the specifics.

## Things to actively watch out for

- **Never touch Google Custom Search / Google Cloud billing again without walking me through the billing implications first and getting my clear, calm go-ahead.** I had a genuinely scary moment with this (details in CLAUDE.md under "Abandoned: Google Custom Search") and closed the billing account. If credential verification ever needs to happen, look for a no-billing-required alternative first, or present the confidence-score-only version as the final scoped feature.
- **RapidAPI quota is limited** — a full live scan costs ~3 API calls against a small free-tier quota. Check current quota before suggesting multiple live test scans; prefer testing individual pieces (e.g. the misinfo classifier alone via typed text) when possible.
- **If retraining the misinformation model is ever needed again on Colab: mount Google Drive at the very start of the session and save the model there, not to Colab's local storage.** Two earlier training runs were lost because Colab silently reset the session mid-training and the "Model saved" success message printed against a session that no longer actually existed. This cost real time and should never happen again.
- **Don't assume a "deleted"/"modified" file in `git status` is safe to commit without checking what it actually is.** Earlier in the project, a `git add .` almost deleted a teammate's browser-extension files and his separate misinformation-classifier folder from GitHub because they showed up as "deleted" in a diff neither of us fully understood at the time. Always look at exactly what's staged before committing, especially anything touching files neither of us just edited.
- I sometimes paste garbled/duplicated terminal commands (copy-paste artifacts) or hit "wrong folder" errors — these are almost always harmless. Check calmly before treating them as real bugs.

## First thing to do in this session

1. Read `CLAUDE.md` fully, then give me a summary of the whole project in your own words — what it is, what's built, what's not — so I can confirm you've actually understood it correctly before anything else happens.
2. Ask me: has anything changed since this handoff was written (e.g. did Umar's files arrive, has more time passed, did I already act on anything above)?
3. Then, for whatever we tackle first: plan it, show me the plan and your reasoning, wait for my go-ahead, do the work yourself, then give me the detailed summary — following the workflow described above. Remember: no `git commit`/`git push` without my explicit approval, every single time.
