"""
Vision classification for card detection. Uses CLIP zero-shot image classification.
Model runs locally in Python; no browser fetch to Hugging Face.
"""
import base64
import io
from typing import Optional

from PIL import Image


def _get_classifier():
    """Lazy-load the pipeline. Model downloads on first use (or from cache)."""
    from transformers import pipeline

    return pipeline(
        "zero-shot-image-classification",
        model="openai/clip-vit-base-patch32",
    )


_classifier = None


def classify_image(image_b64: str, candidate_labels: list[str]) -> list[dict]:
    """
    Classify an image among candidate labels using CLIP.
    Returns list of {label, score} sorted by score descending.
    """
    global _classifier
    if _classifier is None:
        _classifier = _get_classifier()

    img_data = base64.b64decode(image_b64)
    image = Image.open(io.BytesIO(img_data)).convert("RGB")

    result = _classifier(image, candidate_labels=candidate_labels)
    return result
