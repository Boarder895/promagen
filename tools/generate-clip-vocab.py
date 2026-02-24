#!/usr/bin/env python3
"""
generate-clip-vocab.py — Convert CLIP BPE vocabulary to JSON
=============================================================

Downloads OpenAI's CLIP BPE vocabulary file and converts it to a JSON
format that clip-bpe-tokenizer.ts can load for exact tokenization.

Usage (from repo root):
    python tools/generate-clip-vocab.py

Output:
    src/data/clip-bpe-vocab.json (~400KB)

The CLIP tokenizer uses GPT-2's BPE vocabulary with 49,152 merge rules.
This script downloads the standard bpe_simple_vocab_16e6.txt.gz from
OpenAI's CLIP repository and converts it to our JSON format.

Requirements:
    pip install requests
"""

import json
import gzip
import os
import sys

# The CLIP BPE vocab is hosted at OpenAI's CLIP GitHub repo
VOCAB_URL = "https://raw.githubusercontent.com/openai/CLIP/main/clip/bpe_simple_vocab_16e6.txt.gz"
OUTPUT_PATH = os.path.join(os.path.dirname(__file__), "..", "src", "data", "clip-bpe-vocab.json")


def download_vocab(url: str) -> bytes:
    """Download the vocabulary file."""
    try:
        import requests
        print(f"Downloading CLIP BPE vocabulary from {url}...")
        resp = requests.get(url, timeout=30)
        resp.raise_for_status()
        return resp.content
    except ImportError:
        # Fallback to urllib if requests not installed
        import urllib.request
        print(f"Downloading CLIP BPE vocabulary from {url}...")
        with urllib.request.urlopen(url, timeout=30) as resp:
            return resp.read()


def parse_bpe_vocab(raw_gz: bytes) -> list[str]:
    """Parse the gzipped BPE vocabulary file into merge rules."""
    raw = gzip.decompress(raw_gz).decode("utf-8")
    lines = raw.strip().split("\n")

    # First line is a header comment, skip it
    # Lines 1 to 48895 are the merge rules (space-separated pairs)
    merges = []
    for line in lines[1:]:
        line = line.strip()
        if line and " " in line:
            merges.append(line)

    print(f"Parsed {len(merges)} BPE merge rules")
    return merges


def main():
    # Download
    raw_gz = download_vocab(VOCAB_URL)

    # Parse
    merges = parse_bpe_vocab(raw_gz)

    # Write JSON
    output = {
        "metadata": {
            "source": "OpenAI CLIP bpe_simple_vocab_16e6.txt.gz",
            "url": VOCAB_URL,
            "mergeCount": len(merges),
            "description": "CLIP BPE merge rules for exact tokenization. "
                           "Load with loadClipVocab() from clip-bpe-tokenizer.ts."
        },
        "merges": merges
    }

    os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)
    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(output, f, separators=(",", ":"))

    size_kb = os.path.getsize(OUTPUT_PATH) / 1024
    print(f"Written to {OUTPUT_PATH} ({size_kb:.0f} KB)")
    print(f"Import in your app: import vocabData from '@/data/clip-bpe-vocab.json'")
    print(f"Then call: loadClipVocab(vocabData)")


if __name__ == "__main__":
    main()
