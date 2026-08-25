from app.investigator.investigator import finalize_run
from app.investigator.models import Investigation, InvestigationStatus, Run, RunStatus

RUN_ID = "run-1"


def _run() -> Run:
    return Run(
        run_id=RUN_ID,
        created_at="2026-08-25T00:00:00Z",
        status=RunStatus.IN_PROGRESS,
        vertical="Med Spa",
        geography="Miami-Dade County, Florida",
    )


def _investigation(investigation_id: str, status: InvestigationStatus) -> Investigation:
    return Investigation(
        investigation_id=investigation_id,
        run_id=RUN_ID,
        business_id=f"biz-{investigation_id}",
        created_at="2026-08-25T00:00:00Z",
        status=status,
    )


def test_finalize_run_all_completed_reaches_completed() -> None:
    run = _run()
    result = finalize_run(
        run,
        [
            _investigation("i1", InvestigationStatus.COMPLETED),
            _investigation("i2", InvestigationStatus.COMPLETED),
        ],
    )
    assert result.status == RunStatus.COMPLETED
    assert result.investigation_count == 2
    assert result.completed_investigation_count == 2
    assert result.failed_investigation_count == 0


def test_finalize_run_with_any_failure_is_not_reported_completed() -> None:
    run = _run()
    result = finalize_run(
        run,
        [
            _investigation("i1", InvestigationStatus.COMPLETED),
            _investigation("i2", InvestigationStatus.FAILED),
        ],
    )
    assert result.status == RunStatus.FAILED
    assert result.status != RunStatus.COMPLETED
    assert result.completed_investigation_count == 1
    assert result.failed_investigation_count == 1
    assert result.investigation_count == 2


def test_finalize_run_leaves_status_untouched_while_investigations_pending() -> None:
    run = _run()
    result = finalize_run(run, [_investigation("i1", InvestigationStatus.IN_PROGRESS)])
    assert result.status == RunStatus.IN_PROGRESS
    assert result.investigation_count is None


def test_finalize_run_with_no_investigations_leaves_status_untouched() -> None:
    run = _run()
    result = finalize_run(run, [])
    assert result.status == RunStatus.IN_PROGRESS
    assert result.investigation_count is None
