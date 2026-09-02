"""
Lightweight retrieval-augmented generation for the Chatbot module.

Rather than pulling in a heavy vector database, this uses a plain
TF-IDF + cosine-similarity search (scikit-learn) over the department's
curated placement FAQ (data/placement_faq.json). It's a handful of KB
of pure Python/NumPy, has zero external services, and is more than
accurate enough for a few dozen-to-hundred short FAQ entries - while
still giving the chatbot grounded, department-specific answers instead
of relying on the LLM's general knowledge alone.
"""
from __future__ import annotations

import json
from functools import lru_cache

import config

FAQ_PATH = config.DATA_DIR / "placement_faq.json"


@lru_cache(maxsize=1)
def _load_faq() -> list[dict]:
    if not FAQ_PATH.exists():
        return []
    with open(FAQ_PATH, encoding="utf-8") as f:
        return json.load(f)


@lru_cache(maxsize=1)
def _index():
    from sklearn.feature_extraction.text import TfidfVectorizer

    faq = _load_faq()
    corpus = [f"{item['question']} {item['answer']}" for item in faq]
    if not corpus:
        return None, None
    vectorizer = TfidfVectorizer(stop_words="english")
    matrix = vectorizer.fit_transform(corpus)
    return vectorizer, matrix


def retrieve(query: str, top_k: int = 3, min_score: float = 0.12) -> list[dict]:
    """Return up to top_k FAQ entries relevant to `query`, best first."""
    from sklearn.metrics.pairwise import cosine_similarity

    faq = _load_faq()
    vectorizer, matrix = _index()
    if not faq or vectorizer is None:
        return []

    query_vec = vectorizer.transform([query])
    scores = cosine_similarity(query_vec, matrix).flatten()
    ranked = sorted(zip(scores, faq), key=lambda x: x[0], reverse=True)
    return [item for score, item in ranked[:top_k] if score >= min_score]


def build_context_block(query: str) -> str:
    hits = retrieve(query)
    if not hits:
        return ""
    lines = ["Relevant department FAQ entries (use these if directly relevant, otherwise rely on general knowledge):"]
    for h in hits:
        lines.append(f"- Q: {h['question']}\n  A: {h['answer']}")
    return "\n".join(lines)
