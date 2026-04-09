"""
OpenAI-compatible chat completions HTTP client.
"""
from __future__ import annotations

import logging
from typing import Any, Dict, List

import httpx
from django.conf import settings

logger = logging.getLogger(__name__)


class LLMTimeoutError(Exception):
    """LLM request exceeded timeout."""


class LLMUnavailableError(Exception):
    """LLM HTTP/network or non-success status."""


class LLMBadResponseError(Exception):
    """LLM returned 2xx but unexpected payload."""


def user_message_for_llm_failure(exc: BaseException) -> tuple[str, dict]:
    """
    Map internal LLM errors to safe, actionable API message + details (no secrets).
    """
    if isinstance(exc, LLMBadResponseError):
        msg = str(exc)
        if msg == 'empty content':
            return '智能服务返回为空，请稍后重试或更换模型。', {'code': 'llm_empty_content'}
        if 'not JSON' in msg:
            return '智能服务返回格式异常，请稍后重试。', {'code': 'llm_invalid_payload'}
        return '智能服务返回格式异常，请稍后重试。', {'code': 'llm_bad_response'}

    if not isinstance(exc, LLMUnavailableError):
        return '智能服务暂不可用，请稍后重试。', {}

    s = str(exc)
    if s == 'LLM_API_BASE is not configured':
        return (
            '尚未配置智能接口地址：请在服务端设置环境变量 LLM_API_BASE（OpenAI 兼容网关根地址，通常类似 https://api.openai.com/v1）。',
            {'code': 'llm_config_missing', 'field': 'LLM_API_BASE'},
        )
    if s == 'LLM_API_KEY is not configured':
        return (
            '尚未配置 API 密钥：请在服务端设置环境变量 LLM_API_KEY。',
            {'code': 'llm_config_missing', 'field': 'LLM_API_KEY'},
        )
    if s.startswith('HTTP 401') or s.startswith('HTTP 403'):
        return '智能接口鉴权失败：请检查 LLM_API_KEY 是否有效、是否过期。', {'code': 'llm_auth_failed'}
    if s.startswith('HTTP 404'):
        return (
            '智能接口地址可能不正确：请确认 LLM_API_BASE 是否包含 /v1（例如 https://api.openai.com/v1）。',
            {'code': 'llm_endpoint_not_found'},
        )
    if s.startswith('HTTP 429'):
        return '智能服务请求过于频繁或额度不足，请稍后再试。', {'code': 'llm_rate_limited'}
    if s.startswith('HTTP 4'):
        return (
            '智能接口拒绝了请求：请检查 LLM_MODEL 是否与网关匹配，或查看网关返回的错误说明。',
            {'code': 'llm_client_error'},
        )
    if s.startswith('HTTP 5'):
        return '智能服务上游暂时故障，请稍后重试。', {'code': 'llm_upstream_error'}

    # httpx.ConnectError, etc.
    if 'getaddrinfo failed' in s or 'Name or service not known' in s or 'nodename nor servname' in s:
        return '无法解析智能接口域名：请检查 LLM_API_BASE 是否写对。', {'code': 'llm_dns_error'}
    if 'Connection refused' in s or 'Connection reset' in s:
        return '无法连接智能接口：请确认地址、端口与网络（本机代理 / 防火墙）。', {'code': 'llm_connection_refused'}
    if 'Certificate' in s or 'SSL' in s or 'TLS' in s:
        return '与智能接口建立安全连接失败：请检查系统时间、代理或证书设置。', {'code': 'llm_tls_error'}

    return '无法连接智能服务，请检查网络与 LLM_API_BASE 配置。', {'code': 'llm_network_error'}


def chat_completion(
    messages: List[Dict[str, str]],
    *,
    timeout: float | None = None,
) -> str:
    """
    POST {LLM_API_BASE}/chat/completions (OpenAI-compatible).
    Returns assistant message content (string).
    """
    base = (settings.LLM_API_BASE or '').strip().rstrip('/')
    key = settings.LLM_API_KEY or ''
    model = settings.LLM_MODEL or 'gpt-4o-mini'
    t = float(timeout if timeout is not None else settings.LLM_TIMEOUT)

    if not base:
        raise LLMUnavailableError('LLM_API_BASE is not configured')
    if not key:
        raise LLMUnavailableError('LLM_API_KEY is not configured')

    url = f'{base}/chat/completions'
    headers = {
        'Authorization': f'Bearer {key}',
        'Content-Type': 'application/json',
    }
    body: Dict[str, Any] = {
        'model': model,
        'messages': messages,
    }

    try:
        with httpx.Client(timeout=t) as client:
            resp = client.post(url, json=body, headers=headers)
    except httpx.TimeoutException as e:
        raise LLMTimeoutError(str(e)) from e
    except httpx.RequestError as e:
        raise LLMUnavailableError(str(e)) from e

    if resp.status_code == 408:
        raise LLMTimeoutError('upstream 408')
    if resp.status_code >= 500:
        raise LLMUnavailableError(f'HTTP {resp.status_code}')
    if resp.status_code >= 400:
        raise LLMUnavailableError(f'HTTP {resp.status_code}')

    try:
        data = resp.json()
    except ValueError as e:
        raise LLMBadResponseError('response is not JSON') from e

    try:
        choice0 = data['choices'][0]
        msg = choice0['message']
        content = msg.get('content')
    except (KeyError, IndexError, TypeError) as e:
        raise LLMBadResponseError('missing choices[0].message.content') from e

    if content is None:
        raise LLMBadResponseError('empty content')

    if not isinstance(content, str):
        content = str(content)

    return content
