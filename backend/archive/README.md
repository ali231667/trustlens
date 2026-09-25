# Archive — not part of the running system

These folders hold real work that isn't currently wired into the live
backend or frontend. Nothing here is deleted or lost — it's just set aside
so `backend/` only contains what actually runs when you start the server.

- **`fake_follower_detection_ali/`** — Ali's separate Fake Follower Detection
  model (XGBoost, 94.4% accuracy on his own test set). Not used live — the
  backend uses its own model (`backend/fake_follower_model.pkl`, Random
  Forest, 99.3%) instead, so there's only one fake-follower score, not two
  conflicting ones. Kept here for reference / in case it's needed later.

- **`video_to_text_transcriber_old/`** — the first version of Module 12
  (Whisper transcription). Ali is sending an updated version, which will be
  integrated when it arrives. This old copy is kept here in the meantime.

- **`browser_extension/`** — Module 11 (Chrome extension + its own gateway
  server). Real, tested work, but set aside for now: it depends on a
  "post checker" service that was never delivered, and it runs as a
  separate Chrome plug-in that can never be started by the frontend/backend
  run commands anyway. Revisit after the panel if there's time.

- **`misc/`** — an old exploratory notebook unrelated to the current
  pipeline, kept in case it's ever needed for reference.
