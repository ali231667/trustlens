# Run TrustLens on a new Windows PC

Simple steps to copy the project to `D:\trustlens` and run it.
Use the **VS Code terminal** (it is PowerShell). Type each command, then press **Enter**.

---

## What you get at the end

- **Backend** (the Python server with the AI models) at `http://127.0.0.1:8000`
- **Website** (React) at `http://localhost:5173`
- Optional: the **browser extension** services at `http://127.0.0.1:8100`

---

## Step 0 — Check the tools you already have

Open VS Code → menu **Terminal → New Terminal**. Type:

```powershell
git --version
python --version
node --version
```

| Tool | You need | If missing, install from |
|---|---|---|
| Git | any version | https://git-scm.com/download/win |
| Python | **3.11, 3.12 or 3.13** | https://www.python.org/downloads/ — tick **"Add python.exe to PATH"** in the installer |
| Node.js | **22 or newer** (LTS) | https://nodejs.org |

- If a tool is already installed with a good version, **use it. Do not install again.**
- After you install something new, **close VS Code and open it again**, so the terminal can find it.
- Python 3.14 is too new for some AI packages. If you have it, also install 3.12 and use `py -3.12` instead of `python` in Step 4.

---

## Step 1 — Copy the project to the D: drive

```powershell
cd D:\
git clone https://github.com/ali231667/trustlens.git
cd D:\trustlens
```

Then in VS Code: **File → Open Folder… → `D:\trustlens`**.

---

## Step 2 — Create the secret keys file (`backend\.env`)

**Why:** API keys and passwords are never put on GitHub. You must create this file by hand on every new PC.

1. In VS Code, right-click the `backend` folder → **New File** → name it exactly `.env`
2. Paste the 7 lines your teammate sent you (`RAPIDAPI_KEY=…`, `RAPIDAPI_KEY_COMMENTS=…`, `GOOGLE_SEARCH_API_KEY=…`, `GOOGLE_SEARCH_ENGINE_ID=…`, `JWT_SECRET=…`, `GMAIL_ADDRESS=…`, `GMAIL_APP_PASSWORD=…`)
3. Press **Ctrl + S** to save.

- Make the file in VS Code, not Notepad. Notepad often saves it as `.env.txt`, and then it does not work.
- The Google keys are not used any more. It is fine to keep or delete those two lines.
- Never commit this file. `.gitignore` already blocks it.

---

## Step 3 — Get the misinformation AI model file (1.1 GB)

**Why:** GitHub does not accept files bigger than 100 MB, so this file is **not** in the repository.

1. Ask Hamza for **`model.safetensors`** (it is on his Google Drive / his PC at `backend\misinfo_classifier\api\model\`).
2. Put it here:
   `D:\trustlens\backend\misinfo_classifier\api\model\model.safetensors`
3. That folder must then have 5 files: `config.json`, `model.safetensors`, `tokenizer.json`, `tokenizer_config.json`, `training_args.bin`.

**Without this file:** the website still starts and scans still run, **but the Misinformation module does not run** and is left out of the Trust Score. The Results page will wrongly say "No bio or caption text was available". So get this file before the evaluation.

---

## Step 4 — Install the backend (Python)

```powershell
cd D:\trustlens\backend
python -m venv venv
.\venv\Scripts\Activate.ps1
```

- If you see **"running scripts is disabled on this system"**, run this once, then the Activate line again:
  ```powershell
  Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
  ```
  (Type `Y` and press Enter if it asks.)
- When it works, the line in the terminal starts with **`(venv)`**.

Now install the packages (this takes 5–15 minutes, it downloads about 1 GB):

```powershell
python -m pip install --upgrade pip
pip install -r requirements.txt
```

Check that everything is fine:

```powershell
python -m pytest tests -q
```

You should see **`46 passed`**.

---

## Step 5 — Start the backend

```powershell
cd D:\trustlens\backend
.\start.ps1
```

- Wait until you see `Application startup complete`.
- Open `http://127.0.0.1:8000/docs` in the browser. You should see the API page.
- **Leave this terminal open.** Closing it stops the backend.

---

## Step 6 — Install and start the website

Open a **second** terminal: click the **`+`** at the top-right of the terminal panel.

```powershell
cd D:\trustlens\frontend
npm install
npm run dev
```

- `npm install` is only needed the first time.
- Open **`http://localhost:5173`** in the browser.

---

## Step 7 — Create your accounts (the database starts empty)

**Why:** the database (`backend\trustlens.db`) is **not** copied from Hamza's PC. It is created fresh and empty. Old accounts and scan history are not there.

1. On the website click **Sign up**. Use a real email. A 6-digit code comes to that email. Enter it.
2. To make this account an **admin** (for the admin console demo), in a terminal with `(venv)` active:
   ```powershell
   cd D:\trustlens\backend
   .\venv\Scripts\Activate.ps1
   python make_admin.py your-email@example.com
   ```
3. Log out and log in again. You now see **Admin** in the navbar.
4. For the dispute demo you need **two** accounts (a normal user + an admin), because an admin cannot decide their own dispute.

---

## Step 8 (optional) — Browser extension

Open a third terminal:

```powershell
powershell -ExecutionPolicy Bypass -File D:\trustlens\backend\browser_extension\start_all.ps1
```

- 3 new windows open (ports 8001, 8002, 8100). Wait ~30 seconds.
- Check `http://127.0.0.1:8100/health`.
- In Chrome: go to `chrome://extensions` → turn on **Developer mode** (top-right) → **Load unpacked** → choose `D:\trustlens\backend\browser_extension\extension`.
- Open Instagram (logged in) and **reload** the tab.
- The first reel is slow: the speech model (~150 MB) downloads the first time.
- The "Why?" button uses Gemini. It needs `GEMINI_API_KEY=…` in `backend\browser_extension\gateway\.env`. Without it, a simple rule-based explanation is shown instead. Nothing breaks.
- More details: `backend\browser_extension\DEMO_RUNBOOK.md`.

---

## Every day after this (only 2 commands)

Terminal 1:
```powershell
cd D:\trustlens\backend
.\start.ps1
```

Terminal 2:
```powershell
cd D:\trustlens\frontend
npm run dev
```

---

## Common problems

| You see | Why | Fix |
|---|---|---|
| `running scripts is disabled` | Windows safety setting | `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` |
| `python is not recognized` | Python not on PATH | Reinstall Python, tick "Add python.exe to PATH", restart VS Code |
| `No module named ...` | venv not active | Run `.\venv\Scripts\Activate.ps1` first (line must start with `(venv)`) |
| `address already in use` / port 8000 busy | Backend already running in another terminal | Use that one, or close it |
| "Can't reach the TrustLens server" | Backend not running | Start Step 5 first |
| Misinformation says "No bio or caption text" on every scan | `model.safetensors` missing | Step 3 |
| Signup error about email (503) | Gmail lines missing in `.env` | Step 2 |
| Scan error from RapidAPI (429 / quota) | The RapidAPI monthly quota is used up | Check the RapidAPI dashboard of the account that owns the key |

**Save your API quota:** every live scan uses 2–3 RapidAPI requests. To test the AI without spending quota, use `POST /test-misinfo` on `http://127.0.0.1:8000/docs`.
