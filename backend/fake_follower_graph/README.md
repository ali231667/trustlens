# Fake Follower Detection — Graph Theory + Manhattan Distance

This closes the gap between what the scope document specifies for Module 4
and what was previously built.

**Run it:**
```
cd backend
.\venv\Scripts\python.exe fake_follower_graph\run_analysis.py
```
Add `--sensitivity` to also re-run the whole thing across a range of
settings (slower, ~2 minutes).

---

## Why this exists

The scope document says Fake Follower Detection should use **graph theory
and Manhattan distance** to cluster a follower network into bot groups.

What was already built (`backend/fake_follower.py`) is a supervised **Random
Forest classifier**. It works well and it runs live on every scan, but it
answers a different question: *"does this one account look fake?"* It never
looks at a network and it does no clustering. That was honestly flagged as a
gap rather than papered over.

This module is the specified method, genuinely implemented. It answers:
*"inside a pool of accounts, which sub-groups behave so identically that they
were probably mass-produced by the same script?"*

Both are real. They are not the same technique, and neither replaces the
other.

---

## The idea, in plain words

Real people are all different from each other. One person posts 400 times
and follows 200 accounts; another posts twice and follows 3,000. Measure
them and they scatter.

Bot accounts built by a farm are the opposite. They are created in batches
by the same script, so they share a fingerprint — no profile picture, digits
jammed into the username, empty bio, almost no posts. Measure them and they
pile up on top of each other.

So the method is:

1. **Measure how far apart every pair of accounts is** using Manhattan
   distance across their behavioural features.
2. **Draw a graph.** Every account is a dot. Two dots get connected by a line
   if they are unusually close — meaning they behave almost identically.
3. **Find the communities** in that graph using Louvain community detection,
   a standard graph-theory algorithm.
4. **Flag the bot clusters.** A community is called bot-like if it is big
   enough to be a real group rather than a coincidence, and its members
   collectively carry the mass-produced fingerprint.
5. **Bot percentage** = accounts sitting in flagged clusters ÷ total accounts.

The picture it produces (`follower_network.png`) shows this directly: bot
farms appear as dense red knots, genuine accounts as looser communities, and
one-off accounts scatter around the outside.

### Why Manhattan distance and not the usual Euclidean one

Manhattan (L1) distance adds up the difference on each feature separately.
Euclidean squares them first, which lets one large difference dominate the
entire measurement. Since these features mix yes/no flags (has a profile
picture) with huge counts (followers), L1 stops any single feature from
swamping the rest. It is also what the scope document names explicitly.

### Why Louvain and not k-means

k-means has to be told how many groups to expect. We genuinely do not know
how many bot farms are in a given pool — that is the thing we are trying to
find out. Louvain discovers the number of communities on its own by
maximising modularity (connections dense inside groups, sparse between them).

---

## Results

Run against `backend/archive/fake_follower_detection_ali/master_dataset.csv`
— 1,890 real Instagram accounts (1,342 genuine, 548 fake) with ground-truth
labels, pooled from two public research datasets. Both datasets contribute
both genuine and fake accounts, which was checked deliberately: if all the
fakes had come from one file and all the genuine ones from the other, the
clustering could have been quietly detecting *which file a row came from*
rather than anything about bot behaviour.

| Measure | Result | What it means |
|---|---|---|
| **Precision** | **94.7%** | Of the accounts this flagged, 94.7% really were fake |
| **Recall** | **38.9%** | Of all the real fakes, 38.9% landed in a flagged cluster |
| **Accuracy** | **81.6%** | Overall correct calls |
| Bot percentage reported | 11.9% | 225 of 1,890 accounts sat in a flagged cluster |

Confusion matrix: 213 true positives, 12 false positives, 335 false
negatives, 1,330 true negatives.

### Read the recall number honestly

**38.9% recall is not a bug — it is what this method is for.**

Clustering can only catch bots that arrived in *batches*. A single fake
account with no near-identical twins does not form a cluster, so this method
correctly does not flag it. That is by design, not a failure.

This is exactly why the project keeps both methods. The Random Forest catches
lone fakes; the graph clustering catches coordinated farms and, when it does
flag something, it is right about 95% of the time. They cover different
failure modes.

### Robustness

The result was checked across twelve different parameter combinations
(edge threshold 0.5%–3%, minimum cluster size 3–10). **Precision stayed
between 94.6% and 99.2% in every single one.** Recall moved between 22% and
46%. So the high-precision finding is a property of the method, not a lucky
setting.

Run `--sensitivity` to reproduce that table.

---

## Honest limitations — state these to the panel, do not hide them

1. **It does not run live per-scan.** This is the important one. The method
   needs a list of an account's actual followers. RapidAPI's "Followers List
   v2" endpoint was tested repeatedly on 2026-09-24 with different accounts
   and different parameters, and returned
   `{"error": "Please try again later. You wont be charged for this request."}`
   every single time. Instagram restricts follower-list scraping far more
   aggressively than profile or post data. So this runs offline, on a
   labelled pool of real accounts that stands in for a follower network.

2. **`cluster_accounts()` is not tied to that CSV.** It takes any DataFrame
   with the required columns. The day a follower list can actually be
   fetched, the same function runs on it unchanged — no rewrite needed. That
   is a deliberate design choice, not a claim that it already works live.

3. **No account creation dates.** A genuinely strong bot-farm signal is
   "hundreds of accounts created the same afternoon." Public Instagram APIs
   do not expose creation dates, so that feature could not be used.

4. **The bot fingerprint is hand-designed, not learned.** The rule for what
   makes a community look bot-like (no picture, digits in username, empty
   bio, near-zero posts, follows far exceeding followers) is encoded from
   domain knowledge. It was fixed *before* any labels were looked at —
   otherwise this would quietly stop being unsupervised clustering and become
   a supervised classifier in disguise, and the accuracy figure would be
   meaningless.

5. **Labels are used for scoring only.** The clustering itself never sees the
   `fake` column. It is read once, at the end, to check the answer.

---

## Files

| File | What it is |
|---|---|
| `graph_cluster.py` | The method. Reusable — takes any pool of accounts. |
| `run_analysis.py` | Runs it, scores it against ground truth, draws the network. |
| `follower_network.png` | The visualisation, regenerated on every run. |
