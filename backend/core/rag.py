"""
Retrieval-augmented generation (RAG) for the Placement Chatbot module.

Supports two semantic search backends:
1. High-precision vector embeddings via Ollama (`nomic-embed-text` model):
   computes 768-dimensional dense vector embeddings for placement FAQ entries
   and computes cosine similarity against student queries.
2. Lightweight TF-IDF fallback (scikit-learn): automatically active if Ollama
   is offline or `nomic-embed-text` is unavailable.
"""
from __future__ import annotations

import json
import logging
from functools import lru_cache
import numpy as np

import config

logger = logging.getLogger(__name__)

FAQ_PATH = config.DATA_DIR / "placement_faq.json"


@lru_cache(maxsize=1)
def _load_faq() -> list[dict]:
    if not FAQ_PATH.exists():
        return []
    with open(FAQ_PATH, encoding="utf-8") as f:
        return json.load(f)


def _get_ollama_embedding(text: str) -> list[float] | None:
    """Fetch 768-dim dense embedding from Ollama using nomic-embed-text."""
    import requests
    try:
        url = f"{config.OLLAMA_HOST}/api/embeddings"
        payload = {"model": config.OLLAMA_EMBED_MODEL, "prompt": text}
        res = requests.post(url, json=payload, timeout=2.5)
        if res.status_code == 200:
            emb = res.json().get("embedding")
            if emb and isinstance(emb, list):
                return emb
    except Exception as exc:
        logger.debug("Ollama nomic-embed-text embedding unavailable: %s", exc)
    return None


@lru_cache(maxsize=1)
def _vector_index() -> tuple[list[dict], np.ndarray] | tuple[None, None]:
    """Compute and cache nomic-embed-text vector embeddings for all FAQ entries."""
    faq = _load_faq()
    if not faq:
        return None, None

    embeddings = []
    for item in faq:
        text = f"{item['question']} {item['answer']}"
        emb = _get_ollama_embedding(text)
        if emb is None:
            return None, None  # Fallback to TF-IDF if nomic-embed-text fails
        embeddings.append(emb)

    matrix = np.array(embeddings, dtype=np.float32)
    # L2 normalize matrix rows for fast cosine similarity dot product
    norms = np.linalg.norm(matrix, axis=1, keepdims=True)
    norms[norms == 0] = 1e-10
    norm_matrix = matrix / norms
    return faq, norm_matrix


@lru_cache(maxsize=1)
def _tfidf_index():
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
    faq = _load_faq()
    if not faq:
        return []

    # 1. Try nomic-embed-text dense vector search
    q_emb = _get_ollama_embedding(query)
    if q_emb is not None:
        faq_data, norm_matrix = _vector_index()
        if faq_data and norm_matrix is not None:
            q_vec = np.array(q_emb, dtype=np.float32)
            q_norm = np.linalg.norm(q_vec)
            if q_norm > 0:
                q_vec = q_vec / q_norm
                scores = np.dot(norm_matrix, q_vec)
                ranked = sorted(zip(scores, faq_data), key=lambda x: float(x[0]), reverse=True)
                results = [item for score, item in ranked[:top_k] if score >= 0.35]
                if results:
                    return results

    # 2. Fallback to TF-IDF cosine similarity search
    from sklearn.metrics.pairwise import cosine_similarity
    vectorizer, matrix = _tfidf_index()
    if vectorizer is None or matrix is None:
        return []

    query_vec = vectorizer.transform([query])
    scores = cosine_similarity(query_vec, matrix).flatten()
    ranked = sorted(zip(scores, faq), key=lambda x: float(x[0]), reverse=True)
    return [item for score, item in ranked[:top_k] if score >= min_score]


def build_context_block(query: str) -> str:
    hits = retrieve(query)
    if not hits:
        return ""
    lines = ["Relevant department FAQ entries (use these if directly relevant, otherwise rely on general knowledge):"]
    for h in hits:
        lines.append(f"- Q: {h['question']}\n  A: {h['answer']}")
    return "\n".join(lines)
