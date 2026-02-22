"""
Field mapping module — canonical column definitions for the insurance dataset.

Maps every dataset column to:
- Human-readable aliases (what might appear on a paper form)
- Expected Python type
- Validation rules
- Type-casting function
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Callable


class FieldType(str, Enum):
    INT = "int"
    FLOAT = "float"
    BOOL = "bool"
    STR = "str"


@dataclass
class FieldSpec:
    """Specification for a single dataset column."""
    canonical_name: str
    field_type: FieldType
    aliases: list[str] = field(default_factory=list)
    required: bool = False
    description: str = ""
    valid_values: list[str] | None = None  # for categorical fields

    def cast(self, raw_value: str) -> tuple[Any, bool]:
        """
        Cast a raw string value to the expected type.
        Returns (casted_value, success).
        """
        if raw_value is None:
            return None, False

        cleaned = raw_value.strip()
        if not cleaned or cleaned.lower() in ("n/a", "na", "none", "-", "null", "....", "......"):
            return None, False

        try:
            if self.field_type == FieldType.INT:
                # Remove commas, spaces, handle "2 adults" → 2
                num_match = re.search(r"[-+]?\d+", cleaned.replace(",", ""))
                if num_match:
                    return int(num_match.group()), True
                return None, False

            elif self.field_type == FieldType.FLOAT:
                # Remove currency symbols, commas
                cleaned = re.sub(r"[^\d.\-+]", "", cleaned.replace(",", ""))
                if cleaned:
                    return float(cleaned), True
                return None, False

            elif self.field_type == FieldType.BOOL:
                lower = cleaned.lower()
                if lower in ("yes", "true", "1", "y", "oui", "x", "✓", "✔"):
                    return True, True
                elif lower in ("no", "false", "0", "n", "non", ""):
                    return False, True
                return None, False

            elif self.field_type == FieldType.STR:
                # Validate against allowed values if specified
                if self.valid_values:
                    match = _fuzzy_match_value(cleaned, self.valid_values)
                    if match:
                        return match, True
                    return cleaned, True  # keep raw, let user fix
                return cleaned, True

        except (ValueError, TypeError):
            return None, False

        return None, False


def _fuzzy_match_value(raw: str, valid_values: list[str], threshold: float = 0.6) -> str | None:
    """Try to fuzzy-match a raw value against a list of valid values."""
    raw_lower = raw.lower().strip()

    # Exact match first
    for v in valid_values:
        if raw_lower == v.lower():
            return v

    # Substring match
    for v in valid_values:
        if raw_lower in v.lower() or v.lower() in raw_lower:
            return v

    # Try rapidfuzz if available
    try:
        from rapidfuzz import fuzz
        best_score = 0
        best_match = None
        for v in valid_values:
            score = fuzz.ratio(raw_lower, v.lower()) / 100.0
            if score > best_score:
                best_score = score
                best_match = v
        if best_score >= threshold:
            return best_match
    except ImportError:
        pass

    return None


# ─── ALL DATASET FIELDS ────────────────────────────────────────────
# Each field lists all plausible aliases a human might write on a paper form.

FIELD_SPECS: list[FieldSpec] = [
    # ── Demographics & Financials ───────────────────────────
    FieldSpec(
        canonical_name="Adult_Dependents",
        field_type=FieldType.INT,
        aliases=[
            "adult dependents", "adults", "adult deps", "nombre adultes",
            "adult_dependents", "nb adults", "number of adults",
            "adult members", "adults covered",
        ],
        description="Number of adults covered under the plan",
    ),
    FieldSpec(
        canonical_name="Child_Dependents",
        field_type=FieldType.INT,
        aliases=[
            "child dependents", "children", "child deps", "nombre enfants",
            "child_dependents", "nb children", "number of children",
            "kids", "minors",
        ],
        description="Number of children covered",
    ),
    FieldSpec(
        canonical_name="Infant_Dependents",
        field_type=FieldType.INT,
        aliases=[
            "infant dependents", "infants", "infant deps", "nombre nourrissons",
            "infant_dependents", "nb infants", "number of infants",
            "babies", "newborns",
        ],
        description="Number of infants covered",
    ),
    FieldSpec(
        canonical_name="Estimated_Annual_Income",
        field_type=FieldType.FLOAT,
        aliases=[
            "estimated annual income", "annual income", "yearly income",
            "income", "revenu annuel", "salary", "estimated_annual_income",
            "household income", "revenue", "earnings",
        ],
        description="Estimated yearly household income",
    ),
    FieldSpec(
        canonical_name="Employment_Status",
        field_type=FieldType.STR,
        aliases=[
            "employment status", "employment", "job status", "statut emploi",
            "employment_status", "work status", "profession", "occupation",
            "emploi",
        ],
        valid_values=[
            "Employed", "Self-Employed", "Unemployed", "Retired",
            "Student", "Part-Time", "Freelancer",
        ],
        description="Professional working arrangement",
    ),
    FieldSpec(
        canonical_name="Region_Code",
        field_type=FieldType.STR,
        aliases=[
            "region code", "region", "zone", "code region",
            "region_code", "area", "location", "geographic zone",
        ],
        description="Anonymized geographic location",
    ),

    # ── Customer History & Risk Profile ─────────────────────
    FieldSpec(
        canonical_name="Existing_Policyholder",
        field_type=FieldType.BOOL,
        aliases=[
            "existing policyholder", "existing policy", "current client",
            "existing_policyholder", "already insured", "has policy",
            "active policy", "client existant",
        ],
        description="Already has another active policy with the company",
    ),
    FieldSpec(
        canonical_name="Previous_Claims_Filed",
        field_type=FieldType.INT,
        aliases=[
            "previous claims filed", "claims filed", "prior claims",
            "previous_claims_filed", "nb claims", "number of claims",
            "sinistres", "claims history", "total claims",
        ],
        description="Total prior insurance claims filed",
    ),
    FieldSpec(
        canonical_name="Years_Without_Claims",
        field_type=FieldType.INT,
        aliases=[
            "years without claims", "claim free years", "no claims years",
            "years_without_claims", "clean years", "claims free",
            "annees sans sinistre", "years no claims",
        ],
        description="Consecutive claim-free years",
    ),
    FieldSpec(
        canonical_name="Previous_Policy_Duration_Months",
        field_type=FieldType.INT,
        aliases=[
            "previous policy duration months", "policy duration months",
            "prior policy months", "previous_policy_duration_months",
            "previous policy duration", "policy duration",
            "duree police precedente", "months insured",
        ],
        description="Months the user held their prior policy",
    ),
    FieldSpec(
        canonical_name="Policy_Cancelled_Post_Purchase",
        field_type=FieldType.BOOL,
        aliases=[
            "policy cancelled post purchase", "cancelled post purchase",
            "policy_cancelled_post_purchase", "cancelled after buying",
            "policy cancellation", "cancelled", "annulation police",
            "cancel history",
        ],
        description="History of canceling shortly after buying",
    ),

    # ── Policy Details & Preferences ────────────────────────
    FieldSpec(
        canonical_name="Deductible_Tier",
        field_type=FieldType.STR,
        aliases=[
            "deductible tier", "deductible", "deductible level",
            "deductible_tier", "franchise", "tier", "out of pocket",
        ],
        valid_values=["Low", "Medium", "High"],
        description="Out-of-pocket deductible level chosen",
    ),
    FieldSpec(
        canonical_name="Payment_Schedule",
        field_type=FieldType.STR,
        aliases=[
            "payment schedule", "payment frequency", "billing cycle",
            "payment_schedule", "schedule", "pay frequency",
            "echeancier", "payment plan",
        ],
        valid_values=["Monthly", "Quarterly", "Semi-Annual", "Annual"],
        description="Premium payment frequency",
    ),
    FieldSpec(
        canonical_name="Vehicles_on_Policy",
        field_type=FieldType.INT,
        aliases=[
            "vehicles on policy", "vehicles", "nb vehicles",
            "vehicles_on_policy", "number of vehicles", "cars",
            "vehicules", "autos",
        ],
        description="Number of vehicles in coverage portfolio",
    ),
    FieldSpec(
        canonical_name="Custom_Riders_Requested",
        field_type=FieldType.INT,
        aliases=[
            "custom riders requested", "riders", "add-ons",
            "custom_riders_requested", "special coverage",
            "extras", "options supplementaires", "riders requested",
        ],
        description="Special coverage add-ons requested",
    ),
    FieldSpec(
        canonical_name="Grace_Period_Extensions",
        field_type=FieldType.INT,
        aliases=[
            "grace period extensions", "grace extensions",
            "grace_period_extensions", "payment extensions",
            "deadline extensions", "extensions de delai",
        ],
        description="Times the user extended payment deadline",
    ),

    # ── Sales & Underwriting Process ────────────────────────
    FieldSpec(
        canonical_name="Days_Since_Quote",
        field_type=FieldType.INT,
        aliases=[
            "days since quote", "quote age", "days from quote",
            "days_since_quote", "jours depuis devis",
            "days since initial quote", "quote days",
        ],
        description="Days between quote request and finalizing",
    ),
    FieldSpec(
        canonical_name="Underwriting_Processing_Days",
        field_type=FieldType.INT,
        aliases=[
            "underwriting processing days", "underwriting days",
            "processing days", "underwriting_processing_days",
            "jours traitement", "uw days", "approval days",
        ],
        description="Days for underwriting to approve risk",
    ),
    FieldSpec(
        canonical_name="Policy_Amendments_Count",
        field_type=FieldType.INT,
        aliases=[
            "policy amendments count", "amendments", "modifications",
            "policy_amendments_count", "nb amendments",
            "quote modifications", "changes count",
        ],
        description="Times user modified quote before signing",
    ),
    FieldSpec(
        canonical_name="Acquisition_Channel",
        field_type=FieldType.STR,
        aliases=[
            "acquisition channel", "channel", "sales channel",
            "acquisition_channel", "canal acquisition",
            "how acquired", "source", "referral channel",
        ],
        valid_values=["Online", "Agent", "Phone", "Broker", "Direct", "Referral"],
        description="Platform/method through which policy was sold",
    ),
    FieldSpec(
        canonical_name="Broker_Agency_Type",
        field_type=FieldType.STR,
        aliases=[
            "broker agency type", "agency type", "broker type",
            "broker_agency_type", "type agence", "brokerage type",
            "agency size", "firm type",
        ],
        valid_values=["Small", "Medium", "Large", "Corporate", "Independent"],
        description="Scale of the brokerage firm",
    ),
    FieldSpec(
        canonical_name="Broker_ID",
        field_type=FieldType.STR,
        aliases=[
            "broker id", "broker", "agent id", "broker_id",
            "id courtier", "sales agent", "agent",
        ],
        description="Unique identifier for the sales agent",
    ),
    FieldSpec(
        canonical_name="Employer_ID",
        field_type=FieldType.STR,
        aliases=[
            "employer id", "employer", "company id", "employer_id",
            "id employeur", "workplace", "employer code",
        ],
        description="Unique identifier for user's employer",
    ),

    # ── Timeline Variables ──────────────────────────────────
    FieldSpec(
        canonical_name="Policy_Start_Year",
        field_type=FieldType.INT,
        aliases=[
            "policy start year", "start year", "year",
            "policy_start_year", "annee debut",
        ],
        description="Year coverage officially begins",
    ),
    FieldSpec(
        canonical_name="Policy_Start_Month",
        field_type=FieldType.STR,
        aliases=[
            "policy start month", "start month", "month",
            "policy_start_month", "mois debut",
        ],
        valid_values=[
            "January", "February", "March", "April", "May", "June",
            "July", "August", "September", "October", "November", "December",
        ],
        description="Month coverage begins",
    ),
    FieldSpec(
        canonical_name="Policy_Start_Week",
        field_type=FieldType.INT,
        aliases=[
            "policy start week", "start week", "week",
            "policy_start_week", "semaine debut", "week number",
        ],
        description="Week of year coverage begins",
    ),
    FieldSpec(
        canonical_name="Policy_Start_Day",
        field_type=FieldType.INT,
        aliases=[
            "policy start day", "start day", "day",
            "policy_start_day", "jour debut", "day of month",
        ],
        description="Day of month coverage begins",
    ),
]

# ── Lookup indexes ──────────────────────────────────────────

# canonical_name → FieldSpec
FIELD_BY_NAME: dict[str, FieldSpec] = {
    spec.canonical_name: spec for spec in FIELD_SPECS
}

# Build a flat alias → canonical_name lookup (all lowercased)
ALIAS_TO_CANONICAL: dict[str, str] = {}
for spec in FIELD_SPECS:
    # The canonical name itself (lowered, with underscores replaced)
    ALIAS_TO_CANONICAL[spec.canonical_name.lower()] = spec.canonical_name
    ALIAS_TO_CANONICAL[spec.canonical_name.lower().replace("_", " ")] = spec.canonical_name
    for alias in spec.aliases:
        ALIAS_TO_CANONICAL[alias.lower()] = spec.canonical_name

# All canonical column names in order
ALL_COLUMNS: list[str] = [spec.canonical_name for spec in FIELD_SPECS]
