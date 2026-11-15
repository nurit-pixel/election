from datetime import datetime, timedelta, timezone

from ingest.retry import LastRun, MAX_RUNS_PER_DAY, due

NOW = datetime(2026, 11, 16, 9, 0, tzinfo=timezone.utc)


def _run(status="failed", hours_ago=1.5, runs_today=1, kind="prices"):
    return LastRun("SHUFERSAL", kind, status, NOW - timedelta(hours=hours_ago), runs_today)


def test_failed_run_is_retried_after_an_hour():
    assert due(_run(hours_ago=1.5), NOW)
    assert not due(_run(hours_ago=0.5), NOW)


def test_partial_run_is_retried_too():
    assert due(_run(status="partial"), NOW)


def test_successful_or_running_run_is_not_retried():
    assert not due(_run(status="ok"), NOW)
    assert not due(LastRun("SHUFERSAL", "prices", "running", None, 1), NOW)


def test_no_more_than_three_retries_a_day():
    assert due(_run(runs_today=MAX_RUNS_PER_DAY - 1), NOW)
    assert not due(_run(runs_today=MAX_RUNS_PER_DAY), NOW)


def test_store_lists_are_retried_but_promos_alone_are_not():
    assert due(_run(kind="stores"), NOW)
    assert not due(_run(kind="promos"), NOW)
