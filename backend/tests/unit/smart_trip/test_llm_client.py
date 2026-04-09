"""User-facing LLM error mapping."""
from services.llm_client import (
    LLMBadResponseError,
    LLMUnavailableError,
    user_message_for_llm_failure,
)


def test_missing_base():
    msg, d = user_message_for_llm_failure(LLMUnavailableError('LLM_API_BASE is not configured'))
    assert 'LLM_API_BASE' in msg
    assert d.get('field') == 'LLM_API_BASE'


def test_missing_key():
    msg, d = user_message_for_llm_failure(LLMUnavailableError('LLM_API_KEY is not configured'))
    assert 'LLM_API_KEY' in msg
    assert d.get('field') == 'LLM_API_KEY'


def test_http_401():
    msg, _ = user_message_for_llm_failure(LLMUnavailableError('HTTP 401'))
    assert '鉴权' in msg


def test_bad_response():
    msg, d = user_message_for_llm_failure(LLMBadResponseError('response is not JSON'))
    assert d.get('code') == 'llm_invalid_payload'
