# ============================================================
# TrustLens — Fake Follower Detection via Graph Theory
#   + Manhattan Distance Clustering
# ============================================================
#
# WHAT THIS IS
# ------------
# The scope document specifies that Fake Follower Detection should use
# graph theory and Manhattan distance to cluster a follower network into
# bot groups. This file is that method, genuinely implemented.
#
# It is SEPARATE from `backend/fake_follower.py`, which is the supervised
# Random Forest that runs live on every scan. That one asks "does THIS ONE
# account look fake?". This one asks a different question: "inside a POOL
# of accounts, which sub-groups behave so identically that they were
# probably mass-produced?" Both are real; they are not the same technique.
#
# THE CORE IDEA (this is the bit worth understanding)
# ---------------------------------------------------
# Real people are all different from each other. One posts 400 times and
# follows 200 people; another posts twice and follows 3,000. Spread them
# out in feature space and they scatter.
#
# Bot accounts made by a farm are the opposite: created in batches by the
# same script, so they share a signature — no profile picture, digits
# jammed into the username, empty bio, near-zero posts. Spread THEM out in
# feature space and they pile up on top of each other.
#
# So: measure how far apart every pair of accounts is (Manhattan distance),
# draw an edge between any two that are unusually close, and the bot farms
# show up as dense clumps in the resulting graph while real humans stay
# sparse. Community detection then names those clumps.
#
# WHY MANHATTAN DISTANCE AND NOT EUCLIDEAN
# ----------------------------------------
# Manhattan (L1) distance adds up the differences on each feature
# separately instead of squaring them. Squaring lets one big difference
# dominate the whole measurement; adding does not. Since these features are
# a mix of binary flags (has a profile picture: yes/no) and heavy-tailed
# counts (followers), L1 keeps any single feature from swamping the rest.
# This is also what the scope document asks for by name.

import numpy as np
import pandas as pd
import networkx as nx
from scipy.spatial.distance import pdist, squareform


# Features used to measure how similar two accounts are.
DISTANCE_FEATURES = [
    "profile_pic",
    "username_digit_ratio",
    "description_length",
    "private",
    "posts_count",
    "followers_count",
    "follows_count",
]

# Heavy-tailed count features. One account with 2 million followers and
# another with 400 are astronomically far apart on a raw scale, which would
# drown out every other signal. log1p compresses that back to something
# comparable without discarding the ordering.
COUNT_FEATURES = ["description_length", "posts_count", "followers_count", "follows_count"]


def build_feature_matrix(accounts: pd.DataFrame) -> np.ndarray:
    """Turns raw account rows into a scaled matrix ready for distance
    measurement. Every column ends up in [0, 1] so that no single feature
    contributes more to the distance than any other purely because of the
    units it happens to be measured in."""
    X = accounts[DISTANCE_FEATURES].astype(float).copy()

    for col in COUNT_FEATURES:
        X[col] = np.log1p(X[col].clip(lower=0))

    X = X.to_numpy(dtype=float)

    col_min = X.min(axis=0)
    col_max = X.max(axis=0)
    span = np.where(col_max - col_min == 0, 1.0, col_max - col_min)
    return (X - col_min) / span


def build_similarity_graph(distances: np.ndarray, percentile: float):
    """Builds the graph. Every account is a node. Two accounts get an edge
    if the Manhattan distance between them falls in the closest
    `percentile`% of all pairs in this dataset.

    The threshold is derived from the data rather than hardcoded, so the
    method adapts to whatever pool it is pointed at instead of assuming
    the spread of any one dataset."""
    condensed = squareform(distances, checks=False)
    threshold = float(np.percentile(condensed, percentile))

    n = distances.shape[0]
    G = nx.Graph()
    G.add_nodes_from(range(n))

    close_i, close_j = np.where((distances <= threshold) & (np.triu(np.ones_like(distances), k=1) > 0))
    for i, j in zip(close_i, close_j):
        # Edge weight = similarity, so community detection treats
        # near-identical pairs as stronger evidence of belonging together
        # than merely-close ones.
        G.add_edge(int(i), int(j), weight=float(1.0 - distances[i, j] / (threshold + 1e-9)))

    return G, threshold


# Encoded from domain knowledge about how bot farms build accounts, and
# deliberately fixed BEFORE looking at any ground-truth labels — otherwise
# this stops being unsupervised clustering and quietly becomes a
# supervised classifier wearing a disguise.
def bot_signature_scores(accounts: pd.DataFrame) -> np.ndarray:
    """Scores each account 0-1 on how closely it matches the known
    fingerprint of a mass-produced account. Used to decide which
    *communities* look bot-like, never to classify accounts individually."""
    no_picture = (accounts["profile_pic"].astype(float) == 0).astype(float)
    digit_username = accounts["username_digit_ratio"].astype(float).clip(0, 1)
    empty_bio = (accounts["description_length"].astype(float) == 0).astype(float)
    barely_posts = (accounts["posts_count"].astype(float) <= 2).astype(float)

    followers = accounts["followers_count"].astype(float)
    follows = accounts["follows_count"].astype(float)
    # Broadcasting out to far more accounts than follow you back is the
    # classic mass-follow bot pattern.
    lopsided = (follows > (followers * 3)).astype(float)

    return (no_picture + digit_username + empty_bio + barely_posts + lopsided).to_numpy() / 5.0


def cluster_accounts(
    accounts: pd.DataFrame,
    edge_percentile: float = 1.0,
    min_cluster_size: int = 5,
    signature_cutoff: float = 0.5,
    seed: int = 42,
) -> dict:
    """Runs the full pipeline on any pool of accounts.

    `accounts` must be a DataFrame carrying the DISTANCE_FEATURES columns.
    It is deliberately not tied to any one CSV — the same function would
    run unchanged on a real follower list the day one can actually be
    fetched.

    Returns the per-account cluster assignment, which clusters were judged
    bot-like, and the overall bot percentage.
    """
    X = build_feature_matrix(accounts)
    distances = squareform(pdist(X, metric="cityblock"))

    G, threshold = build_similarity_graph(distances, edge_percentile)

    # Louvain community detection: a standard graph-theory algorithm that
    # searches for the grouping which maximises modularity — meaning
    # connections are dense inside groups and sparse between them. It finds
    # the number of communities on its own rather than being told to expect
    # some fixed count, which matters because we do not know in advance how
    # many bot farms are in a given pool.
    communities = nx.community.louvain_communities(G, weight="weight", seed=seed)

    labels = np.full(len(accounts), -1, dtype=int)
    for cid, members in enumerate(communities):
        for node in members:
            labels[node] = cid

    signatures = bot_signature_scores(accounts)

    clusters = []
    for cid, members in enumerate(communities):
        members = sorted(members)
        size = len(members)

        if size > 1:
            sub = distances[np.ix_(members, members)]
            cohesion = float(sub[np.triu_indices(size, k=1)].mean())
        else:
            cohesion = float("nan")

        mean_signature = float(signatures[members].mean())

        # A cluster is called bot-like when it is big enough to be a group
        # rather than a coincidence, AND its members collectively carry the
        # mass-produced-account fingerprint.
        is_bot_cluster = size >= min_cluster_size and mean_signature >= signature_cutoff

        clusters.append({
            "cluster_id": cid,
            "size": size,
            "members": members,
            "mean_distance_within": cohesion,
            "mean_bot_signature": mean_signature,
            "is_bot_cluster": is_bot_cluster,
        })

    bot_members = [m for c in clusters if c["is_bot_cluster"] for m in c["members"]]
    in_bot_cluster = np.zeros(len(accounts), dtype=bool)
    in_bot_cluster[bot_members] = True

    all_pairs = squareform(distances, checks=False)

    return {
        "labels": labels,
        "clusters": clusters,
        "in_bot_cluster": in_bot_cluster,
        "bot_percentage": round(100.0 * in_bot_cluster.sum() / len(accounts), 1),
        "graph": G,
        "distances": distances,
        "edge_threshold": threshold,
        "mean_distance_overall": float(all_pairs.mean()),
        "n_accounts": len(accounts),
        "n_communities": len(communities),
        "n_bot_clusters": sum(1 for c in clusters if c["is_bot_cluster"]),
    }
