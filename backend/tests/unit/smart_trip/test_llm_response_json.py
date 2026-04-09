"""Tests for LLM JSON fence stripping."""
import json

import pytest

from services.llm_response_json import LLMJSONParseError, parse_assistant_json


def test_plain_json():
    d = {'schema_version': '1', 'a': 1}
    out = parse_assistant_json(json.dumps(d))
    assert out['schema_version'] == '1'


def test_markdown_fence():
    d = {'schema_version': '1', 'x': True}
    text = '```json\n' + json.dumps(d) + '\n```'
    out = parse_assistant_json(text)
    assert out['x'] is True


def test_invalid_raises():
    with pytest.raises(LLMJSONParseError):
        parse_assistant_json('not json')
