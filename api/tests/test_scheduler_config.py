import os

from api.scheduler_config import get_schedule_minutes


def test_get_schedule_minutes_defaults_to_one_for_testing(monkeypatch):
    monkeypatch.delenv("SCHEDULE_MINUTES", raising=False)
    assert get_schedule_minutes() == 1


def test_get_schedule_minutes_honors_configured_value(monkeypatch):
    monkeypatch.setenv("SCHEDULE_MINUTES", "7")
    assert get_schedule_minutes() == 7
