"""
Parse JSON from LLM assistant text (strip markdown fences).
"""
from __future__ import annotations

import json
import re
from typing import Any, Dict


class LLMJSONParseError(ValueError):
    """Assistant output is not valid JSON after stripping fences."""


_FENCE_RE = re.compile(r'^\s*```(?:json)?\s*', re.IGNORECASE)
_FENCE_END_RE = re.compile(r'\s*```\s*$', re.MULTILINE)


def parse_assistant_json(text: str) -> Dict[str, Any]:
    if not text or not str(text).strip():
        raise LLMJSONParseError('empty assistant message')

    raw = str(text).strip()
    if _FENCE_RE.match(raw):
        raw = _FENCE_RE.sub('', raw, count=1)
        raw = _FENCE_END_RE.sub('', raw).strip()

    try:
        data = json.loads(raw)
    except json.JSONDecodeError as e:
        raise LLMJSONParseError(str(e)) from e

    if not isinstance(data, dict):
        raise LLMJSONParseError('root JSON must be an object')

    return data
