#!/usr/bin/env python3
"""
generate-semantic-pairs.py — Auto-detect redundancy pairs using CLIP embeddings
================================================================================

Loads all Promagen vocabulary terms, computes CLIP text embeddings for each,
then finds all pairs with cosine similarity > threshold. These are automatically
redundant — no hand curation needed.

Usage (from repo root):
    python tools/generate-semantic-pairs.py

Output:
    src/data/semantic-pairs.json

Requirements:
    pip install torch transformers numpy

The first run downloads the CLIP model (~600MB). Subsequent runs use the cache.
Processing ~5,500 vocabulary terms takes ~2-3 minutes on CPU, ~30s on GPU.

Threshold tuning:
    0.90+ = very conservative (only near-identical: "foggy" / "misty")
    0.85  = recommended (catches "dramatic lighting" / "cinematic lighting")
    0.80  = aggressive (may catch stylistically different: "sunset" / "golden hour")
    0.75  = very aggressive (risk of false positives)
"""

import json
import os
import sys
import time
from pathlib import Path
from itertools import combinations

# Configuration
THRESHOLD = 0.85  # Cosine similarity threshold for redundancy
VOCAB_DIR = Path(__file__).parent.parent / "src" / "data" / "vocabulary" / "prompt-builder"
OUTPUT_PATH = Path(__file__).parent.parent / "src" / "data" / "semantic-pairs.json"

# Categories to process (matching the vocabulary JSON files)
CATEGORIES = [
    "lighting", "fidelity", "style", "atmosphere", "camera",
    "colour", "materials", "composition", "environment", "action", "subject"
]


def load_vocabulary() -> dict[str, list[str]]:
    """Load all vocabulary terms from the prompt-builder JSON files."""
    vocab: dict[str, list[str]] = {}

    for category in CATEGORIES:
        filepath = VOCAB_DIR / f"{category}.json"
        if not filepath.exists():
            print(f"  Warning: {filepath} not found, skipping")
            continue

        with open(filepath, "r", encoding="utf-8") as f:
            data = json.load(f)

        # Extract terms from the JSON structure
        terms = []
        def extract_strings(obj):
            if isinstance(obj, str):
                terms.append(obj)
            elif isinstance(obj, list):
                for item in obj:
                    extract_strings(item)
            elif isinstance(obj, dict):
                for val in obj.values():
                    extract_strings(val)

        extract_strings(data)

        # Deduplicate and clean
        unique_terms = list(set(t.strip() for t in terms if t.strip()))
        vocab[category] = unique_terms
        print(f"  {category}: {len(unique_terms)} terms")

    return vocab


def compute_embeddings(terms: list[str], model, processor, device):
    """Compute CLIP text embeddings for a list of terms."""
    import torch
    import numpy as np

    embeddings = []
    batch_size = 64

    for i in range(0, len(terms), batch_size):
        batch = terms[i:i + batch_size]
        inputs = processor(text=batch, return_tensors="pt", padding=True, truncation=True)
        inputs = {k: v.to(device) for k, v in inputs.items()}

        with torch.no_grad():
            outputs = model.get_text_features(**inputs)
            # Normalize embeddings
            outputs = outputs / outputs.norm(dim=-1, keepdim=True)

        embeddings.append(outputs.cpu().numpy())

    return np.vstack(embeddings)


def find_similar_pairs(
    terms: list[str],
    categories: list[str],
    embeddings,
    threshold: float
) -> list[dict]:
    """Find all pairs above the similarity threshold."""
    import numpy as np

    n = len(terms)
    pairs = []

    # Compute pairwise cosine similarity
    # (embeddings are already normalized, so dot product = cosine similarity)
    sim_matrix = embeddings @ embeddings.T

    for i in range(n):
        for j in range(i + 1, n):
            sim = float(sim_matrix[i, j])
            if sim >= threshold:
                pairs.append({
                    "termA": terms[i],
                    "termB": terms[j],
                    "categoryA": categories[i],
                    "categoryB": categories[j],
                    "similarity": round(sim, 4),
                    "crossCategory": categories[i] != categories[j],
                })

    return pairs


def main():
    print("=" * 60)
    print("Semantic Pair Generator for Promagen Optimizer")
    print("=" * 60)
    print()

    # Check dependencies
    try:
        import torch
        import numpy as np
        from transformers import CLIPModel, CLIPProcessor
    except ImportError as e:
        print(f"Missing dependency: {e}")
        print("Install with: pip install torch transformers numpy")
        sys.exit(1)

    # Load vocabulary
    print("Loading vocabulary...")
    vocab = load_vocabulary()
    all_terms = []
    all_categories = []
    for category, terms in vocab.items():
        all_terms.extend(terms)
        all_categories.extend([category] * len(terms))

    print(f"\nTotal: {len(all_terms)} unique terms across {len(vocab)} categories")

    # Load CLIP model
    print("\nLoading CLIP model (first run downloads ~600MB)...")
    device = "cuda" if torch.cuda.is_available() else "cpu"
    print(f"  Using device: {device}")

    model = CLIPModel.from_pretrained("openai/clip-vit-base-patch32")
    processor = CLIPProcessor.from_pretrained("openai/clip-vit-base-patch32")
    model = model.to(device)
    model.eval()

    # Compute embeddings
    print(f"\nComputing embeddings for {len(all_terms)} terms...")
    start = time.time()
    embeddings = compute_embeddings(all_terms, model, processor, device)
    elapsed = time.time() - start
    print(f"  Done in {elapsed:.1f}s")

    # Find similar pairs
    print(f"\nFinding pairs with similarity >= {THRESHOLD}...")
    pairs = find_similar_pairs(all_terms, all_categories, embeddings, THRESHOLD)

    # Sort by similarity (highest first)
    pairs.sort(key=lambda p: -p["similarity"])

    # Separate within-category and cross-category
    within = [p for p in pairs if not p["crossCategory"]]
    cross = [p for p in pairs if p["crossCategory"]]

    print(f"  Within-category pairs: {len(within)}")
    print(f"  Cross-category pairs:  {len(cross)}")
    print(f"  Total: {len(pairs)}")

    # Write output
    output = {
        "metadata": {
            "generatedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "model": "openai/clip-vit-base-patch32",
            "threshold": THRESHOLD,
            "totalTerms": len(all_terms),
            "totalPairs": len(pairs),
            "withinCategory": len(within),
            "crossCategory": len(cross),
        },
        "pairs": [
            [p["termA"], p["termB"], p["similarity"], p["categoryA"], p["categoryB"]]
            for p in pairs
        ]
    }

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(output, f, indent=2)

    size_kb = OUTPUT_PATH.stat().st_size / 1024
    print(f"\nWritten to {OUTPUT_PATH} ({size_kb:.0f} KB)")

    # Show top 20 pairs
    print(f"\nTop 20 most similar pairs (threshold={THRESHOLD}):")
    print("-" * 70)
    for p in pairs[:20]:
        cross_tag = " [CROSS]" if p["crossCategory"] else ""
        print(f"  {p['similarity']:.3f}  {p['termA']!r:30s}  ↔  {p['termB']!r}{cross_tag}")

    print(f"\nDone! Import in optimizer: import semanticPairs from '@/data/semantic-pairs.json'")


if __name__ == "__main__":
    main()
