"""
Image preprocessor for OCR — cleans up photos of paper forms.

Pipeline: load → grayscale → resize → denoise → binarize → deskew
Outputs a clean PIL Image ready for OCR.
"""

from __future__ import annotations

import io
import logging
from typing import Optional

import numpy as np
from PIL import Image, ImageEnhance, ImageFilter

logger = logging.getLogger(__name__)

# ── Constants ───────────────────────────────────────────────
MIN_DPI_EQUIVALENT = 300  # target effective DPI
MIN_WIDTH = 1200          # minimum width in px after resize
MAX_WIDTH = 4000          # cap to avoid OOM
DENOISE_STRENGTH = 3      # median filter kernel size (must be odd)


def preprocess(
    image_bytes: bytes,
    *,
    enhance_contrast: bool = True,
    binarize: bool = True,
    deskew: bool = True,
) -> Image.Image:
    """
    Full preprocessing pipeline for a scanned / photographed form.

    Args:
        image_bytes: Raw bytes of the uploaded image (JPEG/PNG).
        enhance_contrast: Whether to boost contrast.
        binarize: Whether to apply adaptive thresholding.
        deskew: Whether to attempt rotation correction.

    Returns:
        Cleaned PIL Image (grayscale, high contrast, straight).
    """
    img = _load_image(image_bytes)
    img = _to_grayscale(img)
    img = _resize_for_ocr(img)

    if enhance_contrast:
        img = _enhance_contrast(img)

    img = _denoise(img)

    if binarize:
        img = _binarize(img)

    if deskew:
        img = _deskew(img)

    logger.info("Preprocessing done: %dx%d", img.width, img.height)
    return img


# ── Step functions ──────────────────────────────────────────

def _load_image(data: bytes) -> Image.Image:
    """Load image from bytes, handle EXIF rotation."""
    img = Image.open(io.BytesIO(data))

    # Auto-rotate based on EXIF orientation tag
    try:
        from PIL import ExifTags
        exif = img._getexif()
        if exif:
            for tag, value in exif.items():
                if ExifTags.TAGS.get(tag) == "Orientation":
                    if value == 3:
                        img = img.rotate(180, expand=True)
                    elif value == 6:
                        img = img.rotate(270, expand=True)
                    elif value == 8:
                        img = img.rotate(90, expand=True)
                    break
    except (AttributeError, Exception):
        pass  # No EXIF or not a JPEG

    return img.convert("RGB")


def _to_grayscale(img: Image.Image) -> Image.Image:
    """Convert to grayscale."""
    return img.convert("L")


def _resize_for_ocr(img: Image.Image) -> Image.Image:
    """
    Resize image to a width suitable for OCR.
    Too small → upscale. Too large → downscale.
    """
    w, h = img.size

    if w < MIN_WIDTH:
        scale = MIN_WIDTH / w
        new_w, new_h = int(w * scale), int(h * scale)
        img = img.resize((new_w, new_h), Image.LANCZOS)
        logger.debug("Upscaled from %d to %d width", w, new_w)
    elif w > MAX_WIDTH:
        scale = MAX_WIDTH / w
        new_w, new_h = int(w * scale), int(h * scale)
        img = img.resize((new_w, new_h), Image.LANCZOS)
        logger.debug("Downscaled from %d to %d width", w, new_w)

    return img


def _enhance_contrast(img: Image.Image) -> Image.Image:
    """Boost contrast to make text stand out."""
    enhancer = ImageEnhance.Contrast(img)
    img = enhancer.enhance(1.8)

    enhancer = ImageEnhance.Sharpness(img)
    img = enhancer.enhance(2.0)

    return img


def _denoise(img: Image.Image) -> Image.Image:
    """Apply median filter to reduce noise while preserving edges."""
    return img.filter(ImageFilter.MedianFilter(size=DENOISE_STRENGTH))


def _binarize(img: Image.Image) -> Image.Image:
    """
    Adaptive thresholding — converts to pure black/white.
    Uses a local-mean approach (simulates adaptive threshold without OpenCV).
    """
    arr = np.array(img, dtype=np.float32)

    # Block-based adaptive threshold
    block_size = 51  # must be odd
    offset = 10

    # Use a box blur as the local mean (fast approximation)
    blurred = img.filter(ImageFilter.BoxBlur(block_size // 2))
    blurred_arr = np.array(blurred, dtype=np.float32)

    # Pixel is white if brighter than local mean minus offset
    binary = ((arr > (blurred_arr - offset)) * 255).astype(np.uint8)

    return Image.fromarray(binary, mode="L")


def _deskew(img: Image.Image) -> Image.Image:
    """
    Detect and correct skew angle of scanned text.
    Uses projection profile method (pure numpy, no OpenCV needed).
    """
    arr = np.array(img)

    # Invert for projection (text = white)
    if arr.mean() > 127:
        arr = 255 - arr

    best_angle = 0
    best_score = 0

    # Search angles from -5° to +5° in 0.5° steps
    for angle_10x in range(-50, 51, 5):
        angle = angle_10x / 10.0
        rotated = img.rotate(angle, fillcolor=255, expand=False)
        rot_arr = np.array(rotated)
        if rot_arr.mean() > 127:
            rot_arr = 255 - rot_arr

        # Horizontal projection profile — sum each row
        projection = rot_arr.sum(axis=1).astype(float)
        # Score = variance of projection (peaked = well-aligned text rows)
        score = float(np.var(projection))

        if score > best_score:
            best_score = score
            best_angle = angle

    if abs(best_angle) > 0.3:
        logger.info("Deskew: rotating %.1f°", best_angle)
        img = img.rotate(best_angle, fillcolor=255, expand=True)

    return img


def image_to_bytes(img: Image.Image, format: str = "PNG") -> bytes:
    """Convert a PIL Image back to bytes (useful for passing to OCR APIs)."""
    buf = io.BytesIO()
    img.save(buf, format=format)
    return buf.getvalue()
