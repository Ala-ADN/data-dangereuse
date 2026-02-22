"""
Unit tests for the OCR field parser.

Tests the core logic without needing Tesseract installed:
- Key-value splitting
- Field name fuzzy matching
- Value type casting
- Full parse pipeline
"""

import pytest

from app.services.ocr.field_parser import (
    parse_text,
    fields_to_dict,
    fields_to_confidence_dict,
    fields_to_status_dict,
    _split_key_value,
    _match_field_name,
    _clean_value,
    _find_field_boundaries,
    _resplit_lines,
)
from app.services.ocr.field_map import FIELD_BY_NAME, FieldType


# ─── Key-Value Splitting ───────────────────────────────────

class TestSplitKeyValue:
    def test_simple_colon(self):
        key, val = _split_key_value("Adult Dependents: 2")
        assert key == "Adult Dependents"
        assert val == "2"

    def test_colon_with_spaces(self):
        key, val = _split_key_value("  Estimated Annual Income :  65000  ")
        assert key == "Estimated Annual Income"
        assert val == "65000"

    def test_equals_sign_fallback(self):
        key, val = _split_key_value("Vehicles on Policy = 3")
        assert key == "Vehicles on Policy"
        assert val == "3"

    def test_no_separator_returns_none(self):
        key, val = _split_key_value("just some random text")
        assert key is None
        assert val is None

    def test_empty_line(self):
        key, val = _split_key_value("")
        assert key is None

    def test_only_colon(self):
        key, val = _split_key_value(":")
        assert key is None

    def test_value_with_colons(self):
        """Value itself can contain colons (e.g. time)."""
        key, val = _split_key_value("Region Code: R-105:A")
        assert key == "Region Code"
        assert val == "R-105:A"


# ─── Field Name Matching ──────────────────────────────────

class TestMatchFieldName:
    def test_exact_canonical(self):
        assert _match_field_name("Adult_Dependents") == "Adult_Dependents"

    def test_exact_alias(self):
        assert _match_field_name("annual income") == "Estimated_Annual_Income"

    def test_human_readable(self):
        assert _match_field_name("Adult Dependents") == "Adult_Dependents"

    def test_case_insensitive(self):
        assert _match_field_name("EMPLOYMENT STATUS") == "Employment_Status"

    def test_partial_match(self):
        assert _match_field_name("claim free years") == "Years_Without_Claims"

    def test_unrecognized_returns_none(self):
        result = _match_field_name("Favorite Color")
        assert result is None

    def test_ocr_noise_stripped(self):
        """OCR might add punctuation to field names."""
        assert _match_field_name("Adult Dependents.") == "Adult_Dependents"

    def test_children_alias(self):
        assert _match_field_name("children") == "Child_Dependents"

    def test_deductible(self):
        assert _match_field_name("deductible") == "Deductible_Tier"


# ─── Value Cleaning ───────────────────────────────────────

class TestCleanValue:
    def test_removes_dots(self):
        assert _clean_value("......") == ""

    def test_removes_underscores(self):
        assert _clean_value("___________") == ""

    def test_preserves_real_value(self):
        assert _clean_value("65000") == "65000"

    def test_strips_whitespace(self):
        assert _clean_value("  Employed  ") == "Employed"

    def test_mixed_noise(self):
        assert _clean_value("...2...") == "2"


# ─── Type Casting ──────────────────────────────────────────

class TestFieldCasting:
    def test_int_field(self):
        spec = FIELD_BY_NAME["Adult_Dependents"]
        val, ok = spec.cast("2")
        assert ok is True
        assert val == 2

    def test_int_with_noise(self):
        spec = FIELD_BY_NAME["Vehicles_on_Policy"]
        val, ok = spec.cast("3 vehicles")
        assert ok is True
        assert val == 3

    def test_float_field(self):
        spec = FIELD_BY_NAME["Estimated_Annual_Income"]
        val, ok = spec.cast("65,000")
        assert ok is True
        assert val == 65000.0

    def test_float_with_currency(self):
        spec = FIELD_BY_NAME["Estimated_Annual_Income"]
        val, ok = spec.cast("$85,000")
        assert ok is True
        assert val == 85000.0

    def test_bool_yes(self):
        spec = FIELD_BY_NAME["Existing_Policyholder"]
        val, ok = spec.cast("Yes")
        assert ok is True
        assert val is True

    def test_bool_no(self):
        spec = FIELD_BY_NAME["Policy_Cancelled_Post_Purchase"]
        val, ok = spec.cast("No")
        assert ok is True
        assert val is False

    def test_str_categorical_exact(self):
        spec = FIELD_BY_NAME["Deductible_Tier"]
        val, ok = spec.cast("Medium")
        assert ok is True
        assert val == "Medium"

    def test_str_categorical_fuzzy(self):
        spec = FIELD_BY_NAME["Deductible_Tier"]
        val, ok = spec.cast("medium")
        assert ok is True
        assert val == "Medium"

    def test_empty_value(self):
        spec = FIELD_BY_NAME["Adult_Dependents"]
        val, ok = spec.cast("......")
        assert ok is False
        assert val is None

    def test_na_value(self):
        spec = FIELD_BY_NAME["Adult_Dependents"]
        val, ok = spec.cast("N/A")
        assert ok is False
        assert val is None


# ─── Full Parse Pipeline ──────────────────────────────────

class TestParseText:
    SAMPLE_TEXT = """
Adult Dependents: 2
Child Dependents: 1
Infant Dependents: 0
Estimated Annual Income: 65000
Employment Status: Employed
Region Code: R-105
Existing Policyholder: Yes
Previous Claims Filed: 1
Years Without Claims: 4
Previous Policy Duration Months: 36
Policy Cancelled Post Purchase: No
Deductible Tier: Medium
Payment Schedule: Monthly
Vehicles on Policy: 2
Custom Riders Requested: 1
Grace Period Extensions: 0
Days Since Quote: 12
Underwriting Processing Days: 5
Policy Amendments Count: 2
Acquisition Channel: Online
Broker Agency Type: Medium
Broker ID: BRK-4421
Employer ID: EMP-8832
Policy Start Year: 2026
Policy Start Month: March
Policy Start Week: 10
Policy Start Day: 15
    """.strip()

    def test_full_form_parses(self):
        result = parse_text(self.SAMPLE_TEXT)
        fields = fields_to_dict(result)

        assert fields["Adult_Dependents"] == 2
        assert fields["Child_Dependents"] == 1
        assert fields["Estimated_Annual_Income"] == 65000.0
        assert fields["Employment_Status"] == "Employed"
        assert fields["Existing_Policyholder"] is True
        assert fields["Deductible_Tier"] == "Medium"
        assert fields["Payment_Schedule"] == "Monthly"
        assert fields["Policy_Start_Month"] == "March"

    def test_matched_count(self):
        result = parse_text(self.SAMPLE_TEXT)
        assert result.matched_count >= 20  # should match most fields

    def test_no_unmatched(self):
        result = parse_text(self.SAMPLE_TEXT)
        assert len(result.unmatched_lines) == 0

    def test_partial_form(self):
        text = """
Adult Dependents: 3
Child Dependents: ......
Estimated Annual Income: 92000
Employment Status: Self-Employed
        """.strip()

        result = parse_text(text)
        fields = fields_to_dict(result)
        statuses = fields_to_status_dict(result)

        assert fields["Adult_Dependents"] == 3
        assert fields["Child_Dependents"] is None
        assert statuses["Child_Dependents"] == "empty"
        assert fields["Estimated_Annual_Income"] == 92000.0
        # Fields not on the form at all
        assert statuses["Vehicles_on_Policy"] == "missing"

    def test_empty_text(self):
        result = parse_text("")
        fields = fields_to_dict(result)
        assert all(v is None for v in fields.values())
        assert result.matched_count == 0

    def test_confidences_are_valid(self):
        result = parse_text(self.SAMPLE_TEXT)
        confs = fields_to_confidence_dict(result)
        for name, conf in confs.items():
            assert 0.0 <= conf <= 1.0, f"{name} confidence {conf} out of range"


# ─── Multi-Field Line Splitting ───────────────────────────

class TestFindFieldBoundaries:
    def test_single_field_unchanged(self):
        result = _find_field_boundaries("Adult Dependents: 2")
        assert result == ["Adult Dependents: 2"]

    def test_two_fields_on_one_line(self):
        line = "Adult Dependents: 2 Child Dependents: 1"
        result = _find_field_boundaries(line)
        assert len(result) == 2
        assert "Adult Dependents: 2" in result[0]
        assert "Child Dependents: 1" in result[1]

    def test_many_fields_on_one_line(self):
        line = (
            "Adult Dependents: 2 Child Dependents: 1 "
            "Infant Dependents: 0 Estimated Annual Income: 65,000"
        )
        result = _find_field_boundaries(line)
        assert len(result) == 4

    def test_header_prefix_separated(self):
        line = "INSURANCE APPLICATION — FULL Adult Dependents: 2 Child Dependents: 1"
        result = _find_field_boundaries(line)
        # Prefix "INSURANCE APPLICATION — FULL" plus two fields
        assert len(result) == 3
        assert "INSURANCE" in result[0]
        assert "Adult Dependents: 2" in result[1]

    def test_no_colon_unchanged(self):
        result = _find_field_boundaries("just some text without fields")
        assert result == ["just some text without fields"]

    def test_overlapping_aliases_keep_longest(self):
        """'income' is a substring alias of 'estimated annual income'."""
        line = "Estimated Annual Income: 65000 Employment Status: Employed"
        result = _find_field_boundaries(line)
        assert len(result) == 2
        assert "Estimated Annual Income: 65000" in result[0]
        assert "Employment Status: Employed" in result[1]

    def test_bool_value_not_false_boundary(self):
        """'No' or 'Yes' values must not create false field boundaries."""
        line = "Policy Cancelled Post Purchase: No Policy Amendments Count: 2"
        result = _find_field_boundaries(line)
        assert len(result) == 2
        assert "Policy Cancelled Post Purchase: No" in result[0]
        assert "Policy Amendments Count: 2" in result[1]


class TestResplitLines:
    def test_confidence_expanded(self):
        lines = ["Adult Dependents: 2 Child Dependents: 1"]
        confs = [0.9]
        new_lines, new_confs = _resplit_lines(lines, confs)
        assert len(new_lines) == 2
        assert len(new_confs) == 2
        assert all(c == 0.9 for c in new_confs)

    def test_mixed_single_and_multi(self):
        lines = [
            "Adult Dependents: 2 Child Dependents: 1",
            "Employment Status: Employed",
        ]
        confs = [0.85, 0.90]
        new_lines, new_confs = _resplit_lines(lines, confs)
        assert len(new_lines) == 3
        assert new_confs[0] == 0.85
        assert new_confs[1] == 0.85
        assert new_confs[2] == 0.90


class TestMultiFieldParsing:
    """End-to-end test with the exact OCR text from the failing sample."""

    MULTI_LINE_TEXT = (
        "INSURANCE APPLICATION — FULL Adult Dependents: 2 "
        "Child Dependents: 1 Infant Dependents: 0 "
        "Estimated Annual Income: 65,000 Existing Policyholder: Yes "
        "Years Without Claims: 4 Payment Schedule: Monthly "
        "Custom Riders Requested: 1 Days Since Quote: 12 "
        "Employer ID: EMP-8832 Policy Start Year: 2026 "
        "Policy Start Month: March Policy Start Day: 15 Signature:\n"
        "Employment Status: Employed Previous Claims Filed: 1 "
        "Previous Policy Duration Months: 36 Vehicles on Policy: 2 "
        "Grace Period Extensions: 0 Underwriting Processing Days: 5 "
        "Policy Start Week: 10\n"
        "Region Code: R-105 Policy Cancelled Post Purchase: No "
        "Policy Amendments Count: 2\n"
        "Deductible Tier: Medium Acquisition Channel: Online\n"
        "Broker Agency Type: Medium\n"
        "Broker ID: BRK-4421"
    )

    def test_all_fields_extracted(self):
        result = parse_text(self.MULTI_LINE_TEXT)
        fields = fields_to_dict(result)
        statuses = fields_to_status_dict(result)

        # Every field from the form should be extracted, not "missing"
        expected_extracted = [
            "Adult_Dependents", "Child_Dependents", "Infant_Dependents",
            "Estimated_Annual_Income", "Employment_Status", "Region_Code",
            "Existing_Policyholder", "Previous_Claims_Filed",
            "Years_Without_Claims", "Previous_Policy_Duration_Months",
            "Policy_Cancelled_Post_Purchase", "Deductible_Tier",
            "Payment_Schedule", "Vehicles_on_Policy",
            "Custom_Riders_Requested", "Grace_Period_Extensions",
            "Days_Since_Quote", "Underwriting_Processing_Days",
            "Policy_Amendments_Count", "Acquisition_Channel",
            "Broker_Agency_Type", "Broker_ID", "Employer_ID",
            "Policy_Start_Year", "Policy_Start_Month",
            "Policy_Start_Week", "Policy_Start_Day",
        ]
        for field_name in expected_extracted:
            assert statuses[field_name] != "missing", (
                f"{field_name} is 'missing' — was not parsed from the line"
            )

    def test_values_correct(self):
        result = parse_text(self.MULTI_LINE_TEXT)
        fields = fields_to_dict(result)

        assert fields["Adult_Dependents"] == 2
        assert fields["Child_Dependents"] == 1
        assert fields["Infant_Dependents"] == 0
        assert fields["Estimated_Annual_Income"] == 65000.0
        assert fields["Employment_Status"] == "Employed"
        assert fields["Existing_Policyholder"] is True
        assert fields["Years_Without_Claims"] == 4
        assert fields["Payment_Schedule"] == "Monthly"
        assert fields["Vehicles_on_Policy"] == 2
        assert fields["Days_Since_Quote"] == 12
        assert fields["Policy_Cancelled_Post_Purchase"] is False
        assert fields["Policy_Amendments_Count"] == 2
        assert fields["Deductible_Tier"] == "Medium"
        assert fields["Acquisition_Channel"] == "Online"
        assert fields["Broker_Agency_Type"] == "Medium"
        assert fields["Broker_ID"] == "BRK-4421"
        assert fields["Employer_ID"] == "EMP-8832"
        assert fields["Policy_Start_Year"] == 2026
        assert fields["Policy_Start_Month"] == "March"
        assert fields["Policy_Start_Day"] == 15
        assert fields["Policy_Start_Week"] == 10

    def test_high_match_count(self):
        result = parse_text(self.MULTI_LINE_TEXT)
        assert result.matched_count >= 25, (
            f"Only matched {result.matched_count}/27 fields"
        )
