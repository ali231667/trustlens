"""
Trains the fake-follower Random Forest and saves fake_follower_model.pkl.

Run:
    cd backend
    .\\venv\\Scripts\\python.exe train_fake_follower.py

WHY THIS SCRIPT EXISTS
----------------------
The previous model was trained in a notebook against
`D:\\TrustLens_Paper\\fake_instagram_profiles.csv` — a file that is not in this
repository. Nobody could re-run that training, and nobody could check the
"99.3% accuracy" number that was being quoted, including us.

Worse, that notebook scaled its features with StandardScaler and saved only
the model, never the scaler, while `fake_follower.py` fed the model raw
values. The result: the saved model returned "genuine" for every account it
was ever shown — 50% accuracy on a balanced 696-account set, which is exactly
chance. It had been wired into the live Trust Score in that state.

So this script deliberately:
  * trains on a dataset that IS in this repository, so the result is
    reproducible by anyone who clones it, including the panel,
  * uses NO scaler at all — a Random Forest splits on thresholds and does not
    need scaled inputs, which removes that entire class of bug permanently,
  * imports `build_features` from `fake_follower.py` rather than rebuilding the
    feature list here, so training and live prediction cannot drift apart,
  * evaluates on a held-out test split it never trained on, and prints whatever
    that says.

DATASET
-------
`archive/fake_follower_detection_ali/goyal-dataset/` — the public Kaggle
"Instagram fake spammer genuine accounts" dataset, 576 training rows and 120
test rows, balanced 50/50, already split by the dataset's own authors. The
split is theirs, not ours, so we are not choosing a flattering one.
"""
from __future__ import annotations

import os
import pickle

import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix

from fake_follower import FEATURE_NAMES, MODEL_PATH, build_features

HERE = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(HERE, "archive", "fake_follower_detection_ali", "goyal-dataset")


def load_split(name: str):
    """Loads one split and converts it into model input via the shared builder."""
    df = pd.read_csv(os.path.join(DATA_DIR, f"{name}.csv"))

    rows = [
        build_features(
            followers=r["#followers"],
            following=r["#follows"],
            posts=r["#posts"],
            has_profile_pic=r["profile pic"],
            bio_length=r["description length"],
            has_external_url=r["external URL"],
            is_private=r["private"],
            username_digit_ratio=r["nums/length username"],
            fullname_words=r["fullname words"],
            fullname_digit_ratio=r["nums/length fullname"],
            name_equals_username=r["name==username"],
        )
        for _, r in df.iterrows()
    ]
    return np.array(rows, dtype=float), df["fake"].astype(int).to_numpy()


def main() -> None:
    X_train, y_train = load_split("train")
    X_test, y_test = load_split("test")

    print("=" * 62)
    print("TrustLens — Fake Follower Detection, training")
    print("=" * 62)
    print(f"Train rows ... {len(y_train)}  (fake: {int(y_train.sum())})")
    print(f"Test rows .... {len(y_test)}  (fake: {int(y_test.sum())})")
    print(f"Features ..... {len(FEATURE_NAMES)}")

    # Passing a DataFrame rather than a bare array so the model records
    # feature_names_in_. That metadata is what made the previous model's
    # breakage diagnosable at all.
    train_df = pd.DataFrame(X_train, columns=FEATURE_NAMES)
    test_df = pd.DataFrame(X_test, columns=FEATURE_NAMES)

    model = RandomForestClassifier(
        n_estimators=200,
        random_state=42,
        # The dataset is balanced, but this keeps the model honest if the
        # data is ever swapped for a less tidy one.
        class_weight="balanced",
    )
    model.fit(train_df, y_train)

    train_acc = accuracy_score(y_train, model.predict(train_df))
    test_pred = model.predict(test_df)
    test_acc = accuracy_score(y_test, test_pred)

    print("\n--- Results ---")
    print(f"Training accuracy ....... {train_acc:.1%}")
    print(f"HELD-OUT test accuracy .. {test_acc:.1%}   <- the number to quote")

    print("\nClassification report (held-out test set):")
    print(classification_report(y_test, test_pred,
                                target_names=["genuine", "fake"], digits=3))

    tn, fp, fn, tp = confusion_matrix(y_test, test_pred).ravel()
    print(f"Confusion:  TP {tp}  FP {fp}  FN {fn}  TN {tn}")

    print("\nTop features by importance:")
    for i in np.argsort(model.feature_importances_)[::-1][:6]:
        print(f"  {FEATURE_NAMES[i]:<24} {model.feature_importances_[i]:.3f}")

    # Sanity check the failure that went unnoticed last time: a model that
    # only ever predicts one class scores 50% on balanced data and looks
    # plausible in a single spot-check.
    unique_preds = set(np.unique(test_pred).tolist())
    if len(unique_preds) < 2:
        raise SystemExit(
            "\nABORTED: the model only ever predicts one class, so it is not "
            "discriminating at all. Refusing to save it."
        )

    with open(MODEL_PATH, "wb") as f:
        pickle.dump(model, f)
    print(f"\nSaved model to: {MODEL_PATH}")


if __name__ == "__main__":
    main()
