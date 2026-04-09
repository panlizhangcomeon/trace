"""
Pytest: 智能行程落库单测不等待百度节流间隔。
"""

import pytest


@pytest.fixture(autouse=True)
def _zero_baidu_smart_commit_interval(settings):
    settings.BAIDU_SMART_COMMIT_INTERVAL_SEC = 0.0
