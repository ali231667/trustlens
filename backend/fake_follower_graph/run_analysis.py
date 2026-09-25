# ============================================================
# TrustLens — Graph Clustering Analysis Runner
# ============================================================
#
# Runs the graph-theory / Manhattan-distance clustering in
# graph_cluster.py against a pool of real, labelled Instagram accounts,
# then scores the result against the ground-truth labels.
#
# The labels are used for NOTHING except this final scoring step. The
# clustering itself never sees them — otherwise the whole exercise would be
# circular and the accuracy figure would be meaningless.
#
# Run it:  cd backend  ->  .\venv\Scripts\python.exe fake_follower_graph\run_analysis.py

import os
import sys

import numpy as np
import pandas as pd
import networkx as nx
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from graph_cluster import cluster_accounts, bot_signature_scores  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
DATASET = os.path.join(
    HERE, "..", "archive", "fake_follower_detection_ali", "master_dataset.csv"
)

# Matches the app's dark theme so the figure belongs to this project
# rather than looking like a stray matplotlib default.
BG = "#070A09"
SURFACE = "#101513"
TEXT = "#F1F4F2"
MUTED = "#A6B1AB"
ACCENT = "#00D4AA"
DANGER = "#FF6B5B"


def evaluate(truth: np.ndarray, flagged: np.ndarray) -> dict:
    """Scores the unsupervised result against ground truth. Plain counting,
    no library magic, so every number here can be traced by hand."""
    tp = int(((flagged == 1) & (truth == 1)).sum())
    fp = int(((flagged == 1) & (truth == 0)).sum())
    fn = int(((flagged == 0) & (truth == 1)).sum())
    tn = int(((flagged == 0) & (truth == 0)).sum())

    precision = tp / (tp + fp) if (tp + fp) else 0.0
    recall = tp / (tp + fn) if (tp + fn) else 0.0
    f1 = 2 * precision * recall / (precision + recall) if (precision + recall) else 0.0

    return {
        "true_positives": tp,
        "false_positives": fp,
        "false_negatives": fn,
        "true_negatives": tn,
        "precision": precision,
        "recall": recall,
        "f1": f1,
        "accuracy": (tp + tn) / len(truth),
    }


def community_island_layout(H, labels, seed: int = 42):
    """Two-level layout: communities are placed relative to each other
    first, then each community's own members are arranged inside its own
    little territory.

    A plain force-directed layout of 1,500 nodes collapses into one hairball
    where the structure the algorithm found is invisible. Laying out the
    communities as islands shows the actual finding: bot farms are dense,
    self-contained knots."""
    members_by_comm = {}
    for node in H.nodes:
        members_by_comm.setdefault(labels[node], []).append(node)

    # Level 1 — how the communities sit relative to one another. Two
    # communities pull together in proportion to how many edges cross
    # between them.
    super_g = nx.Graph()
    super_g.add_nodes_from(members_by_comm)
    for u, v in H.edges:
        cu, cv = labels[u], labels[v]
        if cu != cv:
            super_g.add_edge(cu, cv, weight=super_g.get_edge_data(cu, cv, {"weight": 0})["weight"] + 1)

    super_pos = nx.spring_layout(super_g, seed=seed, k=1.9, iterations=220, weight="weight")

    # Level 2 — members inside each community, scaled so a large cluster
    # occupies proportionally more space than a small one.
    pos = {}
    for comm, members in members_by_comm.items():
        centre = super_pos[comm]
        radius = 0.018 * np.sqrt(len(members)) + 0.006

        if len(members) == 1:
            pos[members[0]] = centre
            continue

        sub = H.subgraph(members)
        local = nx.spring_layout(sub, seed=seed, k=0.6, iterations=60)

        coords = np.array([local[m] for m in members])
        extent = np.abs(coords).max() or 1.0
        coords = coords / extent * radius

        for m, xy in zip(members, coords):
            pos[m] = centre + xy

    return pos


def draw_network(result: dict, truth: np.ndarray, out_path: str, seed: int = 42) -> None:
    """Draws the similarity graph. Every dot is an account; every line means
    two accounts are near-identical in behaviour. Bot farms appear as the
    dense knots, real people as the loose scatter."""
    G = result["graph"]
    flagged = result["in_bot_cluster"]
    labels = result["labels"]

    # Isolated nodes carry no structural information and would just be a
    # grey haze around the edge of the picture.
    connected = [n for n in G.nodes if G.degree(n) > 0]
    H = G.subgraph(connected)

    fig, ax = plt.subplots(figsize=(13, 9), facecolor=BG)
    ax.set_facecolor(BG)

    pos = community_island_layout(H, labels, seed=seed)

    # Edges that stay inside one community are the evidence of a tight
    # group, so they are drawn brighter than the ones bridging communities.
    inner = [(u, v) for u, v in H.edges if labels[u] == labels[v]]
    outer = [(u, v) for u, v in H.edges if labels[u] != labels[v]]

    nx.draw_networkx_edges(H, pos, edgelist=outer, ax=ax,
                           edge_color="#1B2320", width=0.3, alpha=0.5)
    nx.draw_networkx_edges(H, pos, edgelist=inner, ax=ax,
                           edge_color="#33413C", width=0.5, alpha=0.8)

    nodes = list(H.nodes)
    xy = np.array([pos[n] for n in nodes])
    colors = [DANGER if flagged[n] else ACCENT for n in nodes]

    # Soft glow, matching the halo motif used across the app: the same
    # points drawn large and faint underneath the crisp ones.
    ax.scatter(xy[:, 0], xy[:, 1], s=110, c=colors, alpha=0.06, linewidths=0)
    ax.scatter(xy[:, 0], xy[:, 1], s=46, c=colors, alpha=0.12, linewidths=0)

    sizes = [22 if flagged[n] else 11 for n in nodes]
    ax.scatter(xy[:, 0], xy[:, 1], s=sizes, c=colors, alpha=0.95,
               linewidths=0.35, edgecolors=BG, zorder=3)

    ev = evaluate(truth, flagged.astype(int))

    ax.set_title(
        "Follower similarity network  ·  Manhattan distance + Louvain community detection",
        color=TEXT, fontsize=14, pad=18, loc="left",
    )
    subtitle = (
        f"{result['n_accounts']} accounts  ·  {H.number_of_nodes()} with at least one near-identical peer  ·  "
        f"{result['n_communities']} communities found  ·  {result['n_bot_clusters']} flagged as bot clusters"
    )
    ax.text(0, 1.015, subtitle, transform=ax.transAxes, color=MUTED, fontsize=9.5)

    legend = [
        plt.Line2D([0], [0], marker="o", color=BG, markerfacecolor=DANGER,
                   markersize=8, label="In a flagged bot cluster", linestyle="none"),
        plt.Line2D([0], [0], marker="o", color=BG, markerfacecolor=ACCENT,
                   markersize=6, label="Not flagged", linestyle="none"),
    ]
    leg = ax.legend(handles=legend, loc="lower right", frameon=True,
                    facecolor=SURFACE, edgecolor="#1E2724", fontsize=9.5)
    for txt in leg.get_texts():
        txt.set_color(MUTED)

    ax.text(
        0.0, -0.045,
        f"Measured against ground-truth labels:  precision {ev['precision']:.0%}"
        f"   ·   recall {ev['recall']:.0%}   ·   accuracy {ev['accuracy']:.0%}",
        transform=ax.transAxes, color=MUTED, fontsize=9.5, family="monospace",
    )

    ax.axis("off")
    fig.tight_layout()
    fig.savefig(out_path, dpi=190, facecolor=BG, bbox_inches="tight")
    plt.close(fig)


def sensitivity_sweep(accounts: pd.DataFrame, truth: np.ndarray) -> None:
    """Re-runs the clustering across a range of settings.

    A single good result can always be a lucky parameter choice. This shows
    whether the finding survives being poked at — and it is reported
    whatever it says, not only when it flatters the method."""
    print("\n--- Sensitivity: does the result survive changing the settings? ---")
    print(f"{'edge %':>7} {'min size':>9} {'communities':>12} {'bot %':>7} {'precision':>10} {'recall':>8} {'accuracy':>9}")
    for pct in (0.5, 1.0, 2.0, 3.0):
        for min_size in (3, 5, 10):
            r = cluster_accounts(accounts, edge_percentile=pct, min_cluster_size=min_size)
            e = evaluate(truth, r["in_bot_cluster"].astype(int))
            print(f"{pct:>7} {min_size:>9} {r['n_communities']:>12} {r['bot_percentage']:>6}% "
                  f"{e['precision']:>9.1%} {e['recall']:>7.1%} {e['accuracy']:>8.1%}")


def main() -> None:
    accounts = pd.read_csv(DATASET)
    truth = accounts["fake"].astype(int).to_numpy()

    print("=" * 66)
    print("TrustLens — Fake Follower Detection via Graph Clustering")
    print("=" * 66)
    print(f"Accounts in pool ........ {len(accounts)}")
    print(f"Genuine (ground truth) .. {int((truth == 0).sum())}")
    print(f"Fake (ground truth) ..... {int((truth == 1).sum())}")

    result = cluster_accounts(accounts)

    print("\n--- Clustering (labels not used) ---")
    print(f"Manhattan distance, mean over all pairs .. {result['mean_distance_overall']:.4f}")
    print(f"Edge threshold (closest 1% of pairs) ..... {result['edge_threshold']:.4f}")
    print(f"Edges drawn .............................. {result['graph'].number_of_edges()}")
    print(f"Communities found ........................ {result['n_communities']}")
    print(f"Flagged as bot clusters .................. {result['n_bot_clusters']}")
    print(f"BOT PERCENTAGE ........................... {result['bot_percentage']}%")

    sizable = [c for c in result["clusters"] if c["size"] >= 5]
    sizable.sort(key=lambda c: c["mean_bot_signature"], reverse=True)

    print("\n--- Largest communities, most bot-like first ---")
    print(f"{'id':>4} {'size':>5} {'cohesion':>9} {'signature':>10} {'flagged':>8} {'actually fake':>14}")
    for c in sizable[:12]:
        actual = truth[c["members"]].mean()
        print(
            f"{c['cluster_id']:>4} {c['size']:>5} {c['mean_distance_within']:>9.4f} "
            f"{c['mean_bot_signature']:>10.3f} {str(c['is_bot_cluster']):>8} {actual:>13.0%}"
        )

    ev = evaluate(truth, result["in_bot_cluster"].astype(int))
    print("\n--- Scored against ground truth (labels used ONLY here) ---")
    print(f"Precision . {ev['precision']:.1%}  (of accounts we flagged, this share really were fake)")
    print(f"Recall .... {ev['recall']:.1%}  (of all real fakes, this share landed in a flagged cluster)")
    print(f"F1 ........ {ev['f1']:.1%}")
    print(f"Accuracy .. {ev['accuracy']:.1%}")
    print(f"\nConfusion:  TP {ev['true_positives']}   FP {ev['false_positives']}   "
          f"FN {ev['false_negatives']}   TN {ev['true_negatives']}")

    out_path = os.path.join(HERE, "follower_network.png")
    draw_network(result, truth, out_path)
    print(f"\nNetwork visualisation saved to: {out_path}")

    if "--sensitivity" in sys.argv:
        sensitivity_sweep(accounts, truth)


if __name__ == "__main__":
    main()
