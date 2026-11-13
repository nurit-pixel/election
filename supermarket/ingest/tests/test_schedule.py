from datetime import date, datetime, time

from ingest.schedule import ISRAEL, nightly_due, parse_time

SIX = time(6, 0)


def il(day: int, hour: int, minute: int = 0) -> datetime:
    return datetime(2026, 11, day, hour, minute, tzinfo=ISRAEL)


def test_not_before_six():
    assert nightly_due(il(13, 5, 59), date(2026, 11, 12), SIX) is False


def test_due_at_six_when_last_run_was_yesterday():
    assert nightly_due(il(13, 6, 0), date(2026, 11, 12), SIX) is True


def test_runs_once_a_day():
    assert nightly_due(il(13, 6, 5), date(2026, 11, 13), SIX) is False
    assert nightly_due(il(13, 23, 0), date(2026, 11, 13), SIX) is False


def test_catches_up_if_server_was_down_at_six():
    assert nightly_due(il(13, 14, 30), date(2026, 11, 12), SIX) is True
    assert nightly_due(il(13, 9, 0), date(2026, 11, 10), SIX) is True


def test_first_run_ever():
    assert nightly_due(il(13, 7, 0), None, SIX) is True
    assert nightly_due(il(13, 3, 0), None, SIX) is False


def test_israel_time_not_utc():
    # 04:30 UTC בחורף הוא 06:30 בישראל
    utc = datetime(2026, 11, 13, 4, 30, tzinfo=__import__("datetime").timezone.utc)
    assert nightly_due(utc.astimezone(ISRAEL), date(2026, 11, 12), SIX) is True
    # 03:30 UTC בקיץ (שעון קיץ, UTC+3) הוא 06:30 בישראל
    summer = datetime(2026, 7, 1, 3, 30, tzinfo=__import__("datetime").timezone.utc)
    assert nightly_due(summer.astimezone(ISRAEL), date(2026, 6, 30), SIX) is True


def test_parse_time():
    assert parse_time("06:00") == time(6, 0)
    assert parse_time("5:30") == time(5, 30)
    assert parse_time("7") == time(7, 0)
