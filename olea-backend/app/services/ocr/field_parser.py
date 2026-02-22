"""
Field parser — takes raw OCR text and maps it to dataset columns.

Handles the paper form format:
    Feature Name: value
    Feature Name: ......   (blank / unfilled)

Steps:
    1. Split text into lines
    2. For each line, try to split on ':'
    3. Fuzzy-match the key against known field aliases
    4. Cast the value to the expected type
    5. Track per-field confidence and unmatched lines
"""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass
from typing import Any, Optional

from app.services.ocr.field_map import (
    ALIAS_TO_CANONICAL,
    ALL_COLUMNS,
    FIELD_BY_NAME,
)

logger = logging.getLogger(__name__)

# ── OCR noise patterns to strip ─────────────────────────────
NOISE_PATTERNS = [
    r"\.{3,}",    # dots used as fill lines: ......
    r"_{3,}",     # underscores: _____
    r"-{3,}",     # dashes: -----
    r"\|",        # table pipes
    r"□|■|☐|☑",  # checkbox characters
]
NOISE_RE = re.compile("|".join(NOISE_PATTERNS))

# Minimum fuzzy match score to accept a field name match
FUZZY_THRESHOLD = 70

# Pre-computed sorted aliases for boundary detection (longest first)
_SORTED_ALIASES: list[str] = sorted(
    ALIAS_TO_CANONICAL.keys(), key=len, reverse=True
)


# ── Multi-field line splitting ──────────────────────────────

def _resplit_lines(
    lines: list[str],
    line_confidences: list[float],
) -> tuple[list[str], list[float]]:
    """
    Re-split lines that contain multiple key:value pairs.

    OCR often concatenates several fields onto one physical line:
        "Adult Dependents: 2 Child Dependents: 1 Infant Dependents: 0"
    After re-splitting this becomes three separate lines.
    """
    new_lines: list[str] = []
    new_confs: list[float] = []

    for i, line in enumerate(lines):
        conf = line_confidences[i] if i < len(line_confidences) else 0.5
        sub_lines = _find_field_boundaries(line)
        new_lines.extend(sub_lines)
        new_confs.extend([conf] * len(sub_lines))

    return new_lines, new_confs


def _find_field_boundaries(line: str) -> list[str]:
    """
    Detect multiple field:value pairs within a single line and split them.

    Uses the known alias table to identify where new field names start.
    Handles overlapping aliases (e.g. "income" inside "estimated annual income")
    by keeping the longest match at each position.
    """
    line_lower = line.lower()

    # Collect all (position, alias_length) where a known alias matches
    raw_matches: list[tuple[int, int]] = []

    for alias in _SORTED_ALIASES:
        alias_len = len(alias)
        start = 0
        while start <= len(line_lower) - alias_len:
            pos = line_lower.find(alias, start)
            if pos == -1:
                break

            # Must be at a word boundary (start of string or preceded by whitespace)
            if pos > 0 and line_lower[pos - 1] not in (" ", "\t"):
                start = pos + 1
                continue

            # Must be followed (after optional spaces) by a colon
            after = line[pos + alias_len :].lstrip()
            if after.startswith(":"):
                raw_matches.append((pos, alias_len))

            start = pos + 1

    if not raw_matches:
        return [line]

    # Sort by position, then longest alias first (for ties at same pos)
    raw_matches.sort(key=lambda x: (x[0], -x[1]))

    # Deduplicate: remove matches whose start falls within an earlier
    # match's alias span (e.g. "income" inside "estimated annual income")
    kept: list[tuple[int, int]] = []
    for pos, alen in raw_matches:
        subsumed = False
        for kept_pos, kept_len in kept:
            if pos > kept_pos and pos < kept_pos + kept_len:
                subsumed = True
                break
        if subsumed:
            continue
        # Skip duplicate at the same position (longer one was added first)
        if kept and kept[-1][0] == pos:
            continue
        kept.append((pos, alen))

    if len(kept) <= 1:
        return [line]

    boundaries = [pos for pos, _ in kept]
    segments: list[str] = []

    # Anything before the first field (headers, noise)
    if boundaries[0] > 0:
        prefix = line[: boundaries[0]].strip()
        if prefix:
            segments.append(prefix)

    for i, pos in enumerate(boundaries):
        end = boundaries[i + 1] if i + 1 < len(boundaries) else len(line)
        segment = line[pos:end].strip()
        if segment:
            segments.append(segment)

    return segments if segments else [line]


@dataclass
class FieldResult:
    """Result of extracting a single field."""
    canonical_name: str
    raw_key: str          # what was on the document
    raw_value: str        # raw value string from OCR
    parsed_value: Any     # type-casted value (or None)
    confidence: float     # 0.0 – 1.0
    status: str           # "extracted" | "empty" | "failed" | "missing"


@dataclass
class ParseResult:
    """Complete parsing result for a document."""
    fields: dict[str, FieldResult]     # canonical_name → result
    unmatched_lines: list[str]         # lines that couldn't be matched
    total_lines: int
    matched_count: int
    empty_count: int                   # fields that exist but have no value


def parse_text(
    raw_text: str,
    line_confidences: list[float] | None = None,
) -> ParseResult:
    """
    Parse OCR text into structured fields.

    Expects lines in the format:
        Field Name: value
        Field Name: ......  (empty)

    Args:
        raw_text: Full OCR output text.
        line_confidences: Per-line OCR confidence scores (0-1).

    Returns:
        ParseResult with all matched fields and unmatched lines.
    """
    lines = raw_text.strip().split("\n")
    lines = [line.strip() for line in lines if line.strip()]

    if line_confidences is None:
        line_confidences = [0.8] * len(lines)

    # Ensure we have enough confidence values
    while len(line_confidences) < len(lines):
        line_confidences.append(0.5)

    # Re-split lines that contain multiple key:value pairs
    lines, line_confidences = _resplit_lines(lines, line_confidences)

    # Initialize all fields as "missing"
    fields: dict[str, FieldResult] = {}
    for col in ALL_COLUMNS:
        fields[col] = FieldResult(
            canonical_name=col,
            raw_key="",
            raw_value="",
            parsed_value=None,
            confidence=0.0,
            status="missing",
        )

    unmatched_lines: list[str] = []
    matched_count = 0
    empty_count = 0

    for i, line in enumerate(lines):
        line_conf = line_confidences[i] if i < len(line_confidences) else 0.5

        # Try to split on colon
        key, value = _split_key_value(line)
        if key is None:
            unmatched_lines.append(line)
            continue

        # Fuzzy-match key to a canonical field name
        canonical = _match_field_name(key)
        if canonical is None:
            unmatched_lines.append(line)
            continue

        # Clean the value
        clean_value = _clean_value(value)

        # Get the field spec and cast
        spec = FIELD_BY_NAME[canonical]

        if not clean_value:
            # Field exists on document but value is empty/dots
            fields[canonical] = FieldResult(
                canonical_name=canonical,
                raw_key=key,
                raw_value=value,
                parsed_value=None,
                confidence=line_conf * 0.9,  # we're confident the field exists
                status="empty",
            )
            empty_count += 1
            continue

        # Cast value to expected type
        parsed, cast_success = spec.cast(clean_value)

        fields[canonical] = FieldResult(
            canonical_name=canonical,
            raw_key=key,
            raw_value=value,
            parsed_value=parsed,
            confidence=line_conf * (0.95 if cast_success else 0.5),
            status="extracted" if cast_success else "failed",
        )

        if cast_success:
            matched_count += 1
        else:
            # Keep raw value so user can fix it
            fields[canonical].parsed_value = clean_value

    return ParseResult(
        fields=fields,
        unmatched_lines=unmatched_lines,
        total_lines=len(lines),
        matched_count=matched_count,
        empty_count=empty_count,
    )


def _split_key_value(line: str) -> tuple[Optional[str], Optional[str]]:
    """
    Split a line into key and value on the FIRST colon.
    Returns (key, value) or (None, None) if no colon found.
    """
    # Skip lines that are just decorators, headers, or noise
    stripped = line.strip()
    if not stripped or len(stripped) < 3:
        return None, None

    # Must contain a colon
    if ":" not in stripped:
        # Try equals sign as fallback
        if "=" in stripped:
            parts = stripped.split("=", 1)
        else:
            return None, None
    else:
        parts = stripped.split(":", 1)

    if len(parts) != 2:
        return None, None

    key = parts[0].strip()
    value = parts[1].strip()

    # Key should be at least 2 chars and not just numbers
    if len(key) < 2 or key.isdigit():
        return None, None

    return key, value


def _match_field_name(raw_key: str) -> Optional[str]:
    """
    Match a raw OCR field name to a canonical dataset column.
    Uses exact match first, then fuzzy matching.
    """
    normalized = raw_key.lower().strip()

    # Remove common OCR noise from the key
    normalized = re.sub(r"[^\w\s]", "", normalized).strip()
    # Collapse multiple spaces
    normalized = re.sub(r"\s+", " ", normalized)

    # 1. Exact match in alias table
    if normalized in ALIAS_TO_CANONICAL:
        return ALIAS_TO_CANONICAL[normalized]

    # 2. Check if canonical name (with underscores) matches
    with_underscores = normalized.replace(" ", "_")
    if with_underscores in ALIAS_TO_CANONICAL:
        return ALIAS_TO_CANONICAL[with_underscores]

    # 3. Substring check — is any alias fully contained in the key?
    for alias, canonical in ALIAS_TO_CANONICAL.items():
        if len(alias) >= 4 and alias in normalized:
            return canonical

    # 4. Fuzzy match with rapidfuzz
    try:
        from rapidfuzz import fuzz, process

        all_aliases = list(ALIAS_TO_CANONICAL.keys())
        match = process.extractOne(
            normalized,
            all_aliases,
            scorer=fuzz.token_sort_ratio,
            score_cutoff=FUZZY_THRESHOLD,
        )
        if match:
            matched_alias, score, _ = match
            logger.debug("Fuzzy matched '%s' → '%s' (score: %d)", raw_key, matched_alias, score)
            return ALIAS_TO_CANONICAL[matched_alias]
    except ImportError:
        # No rapidfuzz — fall back to simple ratio
        pass

    # 5. Last resort: check if any canonical name words overlap
    key_words = set(normalized.split())
    best_match = None
    best_overlap = 0
    for canonical in ALL_COLUMNS:
        canon_words = set(canonical.lower().replace("_", " ").split())
        overlap = len(key_words & canon_words)
        if overlap > best_overlap and overlap >= 1 and len(canon_words) <= 3:
            best_overlap = overlap
            best_match = canonical

    if best_match and best_overlap >= 1:
        return best_match

    logger.debug("No match found for key: '%s'", raw_key)
    return None


def _clean_value(raw_value: str) -> str:
    """Clean a raw OCR value: remove noise patterns, trim whitespace."""
    cleaned = NOISE_RE.sub("", raw_value)
    cleaned = cleaned.strip()

    # Remove leading/trailing punctuation that's noise
    cleaned = cleaned.strip(".,;:|-_ ")

    return cleaned


def fields_to_dict(parse_result: ParseResult) -> dict[str, Any]:
    """
    Convert ParseResult into a flat dict suitable for the form/prediction API.
    Keys are canonical column names, values are parsed values (None if missing).
    """
    return {
        name: result.parsed_value
        for name, result in parse_result.fields.items()
    }


def fields_to_confidence_dict(parse_result: ParseResult) -> dict[str, float]:
    """
    Return per-field confidence scores.
    """
    return {
        name: round(result.confidence, 3)
        for name, result in parse_result.fields.items()
    }


def fields_to_status_dict(parse_result: ParseResult) -> dict[str, str]:
    """
    Return per-field extraction status.
    """
    return {
        name: result.status
        for name, result in parse_result.fields.items()
    }
