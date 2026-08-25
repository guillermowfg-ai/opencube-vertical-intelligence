# Copyright 2026 Google LLC
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     https://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

from app.investigator.catalog import (
    EVALUATED_OPPORTUNITY_IDS,
    LEAD_FOLLOW_UP_EFFECTIVENESS,
    MED_SPA_CATALOG,
    get_evaluated_definitions,
)


def test_catalog_has_five_definitions() -> None:
    assert len(MED_SPA_CATALOG) == 5
    assert len({d.opportunity_id for d in MED_SPA_CATALOG}) == 5


def test_only_three_definitions_are_evaluated_in_v1() -> None:
    assert len(EVALUATED_OPPORTUNITY_IDS) == 3
    evaluated = get_evaluated_definitions()
    assert len(evaluated) == 3
    assert {d.opportunity_id for d in evaluated} == EVALUATED_OPPORTUNITY_IDS


def test_pbx_and_crm_definitions_declared_but_not_evaluated() -> None:
    declared_ids = {d.opportunity_id for d in MED_SPA_CATALOG}
    assert "pbx_telephony_cost_optimization" in declared_ids
    assert "crm_optimization_or_replacement" in declared_ids
    assert "pbx_telephony_cost_optimization" not in EVALUATED_OPPORTUNITY_IDS
    assert "crm_optimization_or_replacement" not in EVALUATED_OPPORTUNITY_IDS


def test_lead_follow_up_is_not_publicly_observable() -> None:
    assert LEAD_FOLLOW_UP_EFFECTIVENESS.publicly_observable is False
    assert LEAD_FOLLOW_UP_EFFECTIVENESS.requires_independent_verification is True


def test_every_definition_declares_disallowed_claims() -> None:
    for definition in MED_SPA_CATALOG:
        assert definition.claims_not_allowed_without_evidence, (
            f"{definition.opportunity_id} must declare disallowed claims"
        )
