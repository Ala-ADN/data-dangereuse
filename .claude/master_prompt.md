# 🏗️ DATA-DANGEREUSE — Master Architecture Document

> **Domain**: Insurance Brokerage — Coverage Bundle Recommendation
> **Purpose**: Single source of truth for all agents building this system.
> **Last updated**: 2026-02-22

---

## 1. Product Vision

A mobile-first web application for an **international insurance brokerage**. Clients either:

1. **Scan / upload insurance documents** (quotes, ID cards, prior policies) via OCR, or
2. **Fill a structured form** manually with their profile, risk, and preferences.

An **ML recommendation engine** then predicts the **best Coverage Bundle** (out of 10 insurance packages) and provides a short **NLP-generated explanation** of _why_ that bundle fits the client.

### 1.1 User Journey (Happy Path)

```
┌─────────────┐     ┌──────────────┐     ┌──────────────────┐     ┌──────────────────┐
│  HOMEPAGE   │────▸│  QR CODE /   │────▸│  DATA CAPTURE    │────▸│   DASHBOARD      │
│  (Landing)  │     │  APP INSTALL  │     │  Form OR Scanner │     │  Recommendation  │
│             │     │              │     │                  │     │  + Explanation    │
└─────────────┘     └──────────────┘     └──────────────────┘     └──────────────────┘
```

| Step | Action                                    | Technical Detail                                          |
| ---- | ----------------------------------------- | --------------------------------------------------------- |
| 1    | User lands on homepage                    | Next.js SSR landing page with hero, features, CTA         |
| 2    | Scans QR code or clicks download          | QR encodes deep-link / PWA install prompt                 |
| 3a   | **Option A**: Uploads photos from gallery | Images → Backend → OCR (PaddleOCR) → structured JSON      |
| 3b   | **Option B**: Fills form manually         | React Hook Form → validated JSON payload                  |
| 4    | Backend runs recommendation model         | Feature vector → trained XGBoost → top-K bundles + scores |
| 5    | Dashboard shows results                   | Best bundle card + NLP explanation (SHAP + template)      |

---

## 2. Dataset Description

### 2.1 Source Files

| File                    | Purpose                                                      |
| ----------------------- | ------------------------------------------------------------ |
| `train.csv`             | Training set — features + target `Purchased_Coverage_Bundle` |
| `test.csv`              | Test set — features only, predict the target                 |
| `sample_submission.csv` | Correct string formatting for predictions                    |

### 2.2 Target Variable — `Purchased_Coverage_Bundle`

The final insurance package selected by the customer. Encoded as integers 0–9:

| ID  | Bundle Name            | Description                |
| --- | ---------------------- | -------------------------- |
| 0   | `Auto_Comprehensive`   | Full auto coverage         |
| 1   | `Auto_Liability_Basic` | Minimum auto liability     |
| 2   | `Basic_Health`         | Essential health coverage  |
| 3   | `Family_Comprehensive` | Full family package        |
| 4   | `Health_Dental_Vision` | Health + dental + vision   |
| 5   | `Home_Premium`         | Premium homeowner policy   |
| 6   | `Home_Standard`        | Standard homeowner policy  |
| 7   | `Premium_Health_Life`  | Premium health + life      |
| 8   | `Renter_Basic`         | Basic renter's insurance   |
| 9   | `Renter_Premium`       | Premium renter's insurance |

### 2.3 Feature Columns (29 features)

#### Identifiers

| Column    | Type   | Description                                    |
| --------- | ------ | ---------------------------------------------- |
| `User_ID` | string | Unique identifier for the prospective customer |

#### Demographics & Financials

| Column                    | Type        | Description                                               |
| ------------------------- | ----------- | --------------------------------------------------------- |
| `Adult_Dependents`        | int         | Number of adults covered under the plan                   |
| `Child_Dependents`        | int         | Number of children covered                                |
| `Infant_Dependents`       | int         | Number of infants covered                                 |
| `Estimated_Annual_Income` | float       | Estimated yearly household income                         |
| `Employment_Status`       | categorical | Professional working arrangement of the primary applicant |
| `Region_Code`             | categorical | Anonymized geographic location                            |

#### Customer History & Risk Profile

| Column                            | Type     | Description                                        |
| --------------------------------- | -------- | -------------------------------------------------- |
| `Existing_Policyholder`           | bool/int | Already has another active policy with the company |
| `Previous_Claims_Filed`           | int      | Total prior insurance claims filed                 |
| `Years_Without_Claims`            | int      | Consecutive claim-free years                       |
| `Previous_Policy_Duration_Months` | int      | Months the user held their prior policy            |
| `Policy_Cancelled_Post_Purchase`  | bool/int | History of canceling shortly after buying          |

#### Policy Details & Preferences

| Column                    | Type        | Description                                       |
| ------------------------- | ----------- | ------------------------------------------------- |
| `Deductible_Tier`         | categorical | Out-of-pocket deductible level chosen             |
| `Payment_Schedule`        | categorical | Premium payment frequency (Monthly, Annual, etc.) |
| `Vehicles_on_Policy`      | int         | Number of vehicles in coverage portfolio          |
| `Custom_Riders_Requested` | int         | Special coverage add-ons requested                |
| `Grace_Period_Extensions` | int         | Times the user extended payment deadline          |

#### Sales & Underwriting Process

| Column                         | Type        | Description                                      |
| ------------------------------ | ----------- | ------------------------------------------------ |
| `Days_Since_Quote`             | int         | Days between quote request and finalizing        |
| `Underwriting_Processing_Days` | int         | Days for underwriting department to approve risk |
| `Policy_Amendments_Count`      | int         | Times user modified quote before signing         |
| `Acquisition_Channel`          | categorical | Platform/method through which policy was sold    |
| `Broker_Agency_Type`           | categorical | Scale of the brokerage firm handling the policy  |
| `Broker_ID`                    | categorical | Unique identifier for the sales agent            |
| `Employer_ID`                  | categorical | Unique identifier for user's employer            |

#### Timeline Variables

| Column               | Type | Description                     |
| -------------------- | ---- | ------------------------------- |
| `Policy_Start_Year`  | int  | Year coverage officially begins |
| `Policy_Start_Month` | int  | Month coverage begins           |
| `Policy_Start_Week`  | int  | Week of year coverage begins    |
| `Policy_Start_Day`   | int  | Day of month coverage begins    |

---

## 3. System Architecture

### 3.1 High-Level Architecture Diagram

```
                           ┌─────────────────────────────────┐
                           │         FRONTEND (Next.js)       │
                           │  ┌───────────┐  ┌─────────────┐ │
                           │  │ Landing / │  │  Dashboard  │ │
                           │  │ QR Page   │  │  Results    │ │
                           │  └─────┬─────┘  └──────┬──────┘ │
                           └────────┼────────────────┼────────┘
                                    │   HTTPS/REST   │
                           ┌────────▼────────────────▼────────┐
                           │      API GATEWAY (FastAPI)        │
                           │  /api/v1/ocr    /api/v1/predict  │
                           │  /api/v1/form   /api/v1/explain  │
                           └──┬──────┬──────────┬──────┬──────┘
                              │      │          │      │
                 ┌────────────▼┐  ┌──▼────┐  ┌─▼────┐ │
                 │ OCR Service │  │ Redis │  │  ML  │ │
                 │ (Worker)    │  │ Cache │  │ Svc  │ │
                 └─────────────┘  └───────┘  └──┬───┘ │
                                                │     │
                                    ┌───────────▼─┐ ┌─▼───────────┐
                                    │  MLflow     │ │ Explainer   │
                                    │  Registry   │ │ Service     │
                                    └──────┬──────┘ │ (SHAP/LIME) │
                                           │        └─────────────┘
                                    ┌──────▼──────┐
                                    │ PostgreSQL  │
                                    │ + MinIO     │
                                    │ (artifacts) │
                                    └─────────────┘
```

### 3.2 Service Inventory

| Service         | Tech Stack                          | Port | Purpose                                           |
| --------------- | ----------------------------------- | ---- | ------------------------------------------------- |
| **frontend**    | Next.js 14, Tailwind CSS, shadcn/ui | 3000 | Landing page, form, scanner, dashboard            |
| **api-gateway** | FastAPI (Python 3.11)               | 8000 | Central REST API, auth, routing                   |
| **ocr-worker**  | Celery + PaddleOCR / Tesseract      | —    | Async image → text extraction                     |
| **ml-service**  | FastAPI + XGBoost / LightGBM        | 8001 | Model inference, bundle recommendation            |
| **explainer**   | SHAP + Jinja2 templates             | 8002 | Generate human-readable explanations              |
| **redis**       | Redis 7                             | 6379 | Caching predictions, rate limiting, Celery broker |
| **postgres**    | PostgreSQL 16                       | 5432 | Users, submissions, bundles catalog               |
| **mlflow**      | MLflow 2.x                          | 5000 | Experiment tracking, model registry               |
| **minio**       | MinIO                               | 9000 | Artifact storage (models, images)                 |
| **rabbitmq**    | RabbitMQ 3.x                        | 5672 | Message broker for OCR task queue                 |

---

## 4. Frontend Specification

### 4.1 Pages & Routes

```
/                    → Landing page (hero + QR code + CTA)
/download            → QR code full-screen + install instructions
/app                 → Main app shell (auth-gated)
/app/scan            → Camera/gallery upload for OCR
/app/form            → Manual data entry form
/app/dashboard       → Results: recommendation + explanation
/app/history         → Past submissions
```

### 4.2 Landing Page (Homepage)

**Design Reference**: Clean, modern SaaS landing (Olea-style interface)

```
┌──────────────────────────────────────────┐
│  NAVBAR  [Logo]         [Features] [CTA] │
├──────────────────────────────────────────┤
│                                          │
│   🛡️ Find Your Ideal Coverage Bundle    │
│   Upload your documents or fill a form   │
│   Our AI finds the perfect insurance     │
│   package for your needs                 │
│                                          │
│   ┌──────────┐    ┌──────────────────┐   │
│   │  QR CODE │    │  [Get Started →] │   │
│   │  ██████  │    │  [Scan Docs  📷] │   │
│   │  ██████  │    └──────────────────┘   │
│   └──────────┘                           │
│                                          │
├──────────────────────────────────────────┤
│   HOW IT WORKS                           │
│   ① Upload / Fill  ② AI Analyzes  ③ Get │
│     Your Info        Your Profile   Plan │
├──────────────────────────────────────────┤
│   COVERAGE BUNDLES  (preview grid)       │
│   [Auto] [Health] [Home] [Renter] [Life] │
├──────────────────────────────────────────┤
│   FEATURES GRID  (3 cards)               │
│   [OCR Scan] [Smart Form] [AI Insights]  │
├──────────────────────────────────────────┤
│   FOOTER                                 │
└──────────────────────────────────────────┘
```

### 4.3 Form Specification

**Reference**: Structured like Abid-style PDF forms — clean multi-step section-based layout.

#### Step 1: Demographics & Financials

| Field                       | Column Mapped             | Type                  | Validation    |
| --------------------------- | ------------------------- | --------------------- | ------------- |
| Number of Adult Dependents  | `Adult_Dependents`        | number (stepper)      | >= 0          |
| Number of Child Dependents  | `Child_Dependents`        | number (stepper)      | >= 0          |
| Number of Infant Dependents | `Infant_Dependents`       | number (stepper)      | >= 0          |
| Estimated Annual Income     | `Estimated_Annual_Income` | number / range slider | > 0, required |
| Employment Status           | `Employment_Status`       | select dropdown       | required      |
| Region                      | `Region_Code`             | select dropdown       | required      |

#### Step 2: Customer History & Risk Profile

| Field                                   | Column Mapped                     | Type             | Validation |
| --------------------------------------- | --------------------------------- | ---------------- | ---------- |
| Existing Policyholder?                  | `Existing_Policyholder`           | toggle (yes/no)  | required   |
| Previous Claims Filed                   | `Previous_Claims_Filed`           | number (stepper) | >= 0       |
| Years Without Claims                    | `Years_Without_Claims`            | number           | >= 0       |
| Previous Policy Duration (months)       | `Previous_Policy_Duration_Months` | number           | >= 0       |
| Ever Cancelled a Policy After Purchase? | `Policy_Cancelled_Post_Purchase`  | toggle (yes/no)  | required   |

#### Step 3: Policy Details & Preferences

| Field                        | Column Mapped             | Type                              | Validation |
| ---------------------------- | ------------------------- | --------------------------------- | ---------- |
| Deductible Tier              | `Deductible_Tier`         | select (Low/Medium/High)          | required   |
| Payment Schedule             | `Payment_Schedule`        | select (Monthly/Quarterly/Annual) | required   |
| Vehicles on Policy           | `Vehicles_on_Policy`      | number (stepper)                  | >= 0       |
| Custom Riders Requested      | `Custom_Riders_Requested` | number (stepper)                  | >= 0       |
| Grace Period Extensions Used | `Grace_Period_Extensions` | number                            | >= 0       |

#### Step 4: Sales & Underwriting Info

| Field                        | Column Mapped                  | Type            | Validation |
| ---------------------------- | ------------------------------ | --------------- | ---------- |
| Days Since Quote             | `Days_Since_Quote`             | number          | >= 0       |
| Underwriting Processing Days | `Underwriting_Processing_Days` | number          | >= 0       |
| Policy Amendments Count      | `Policy_Amendments_Count`      | number          | >= 0       |
| Acquisition Channel          | `Acquisition_Channel`          | select dropdown | required   |
| Broker Agency Type           | `Broker_Agency_Type`           | select dropdown | required   |
| Broker ID                    | `Broker_ID`                    | text / select   | optional   |
| Employer ID                  | `Employer_ID`                  | text / select   | optional   |

#### Step 5: Policy Timeline

| Field             | Column Mapped                      | Type        | Validation      |
| ----------------- | ---------------------------------- | ----------- | --------------- |
| Policy Start Date | `Policy_Start_Year/Month/Week/Day` | date picker | auto-decomposed |

> **Note**: The date picker captures a single date, which is decomposed into `Year`, `Month`, `Week`, `Day` columns in the backend feature pipeline.

### 4.4 Scanner / OCR Upload Page

```
┌─────────────────────────────────────┐
│   📷 Scan Your Insurance Documents  │
│                                     │
│   Supported: Quotes, ID cards,      │
│   prior policy documents, invoices  │
│                                     │
│   ┌─────────────────────────────┐   │
│   │                             │   │
│   │    DROP ZONE / CAMERA       │   │
│   │    Drag & drop or tap       │   │
│   │    to select photos         │   │
│   │                             │   │
│   └─────────────────────────────┘   │
│                                     │
│   📁 Gallery  │  📸 Camera          │
│                                     │
│   Uploaded: quote.jpg        ✓      │
│             prior_policy.pdf ✓      │
│                                     │
│   [Process Documents →]             │
│                                     │
│   ┌─ Extracted Fields Preview ──┐   │
│   │ Income: $65,000       [✓]   │   │
│   │ Dependents: 2 adults  [✓]   │   │
│   │ Claims: 1             [✎]   │   │
│   │ ...                         │   │
│   │ [Confirm & Submit →]        │   │
│   └─────────────────────────────┘   │
└─────────────────────────────────────┘
```

- Accept: JPEG, PNG, PDF (first page rasterized)
- Max 5 files, 10MB each
- Show upload progress bar
- After OCR: display extracted fields for user **review/edit** before submission

### 4.5 Dashboard / Results Page

```
┌──────────────────────────────────────────────┐
│  YOUR COVERAGE RECOMMENDATION                │
│                                              │
│  ┌────────────────────────────────────────┐  │
│  │  🏆 BEST BUNDLE: Family_Comprehensive │  │
│  │  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │  │
│  │  Bundle ID:    3                       │  │
│  │  Type:         Family Comprehensive    │  │
│  │  Confidence:   92%                     │  │
│  │                                        │  │
│  │  💡 WHY THIS BUNDLE?                  │  │
│  │  "Based on your 2 adult and 1 child   │  │
│  │   dependents, combined with your       │  │
│  │   $85,000 annual income and clean      │  │
│  │   claims history (4 years without      │  │
│  │   claims), Family_Comprehensive        │  │
│  │   offers the most complete protection  │  │
│  │   for your household. Your choice of   │  │
│  │   a medium deductible tier aligns      │  │
│  │   perfectly with this bundle."         │  │
│  └────────────────────────────────────────┘  │
│                                              │
│  OTHER OPTIONS (ranked)                      │
│  ┌──────────────┐ ┌──────────────┐ ┌──────┐ │
│  │ Premium      │ │ Health       │ │ Home │ │
│  │ Health_Life  │ │ Dental_Vis.  │ │ Std  │ │
│  │ 78%          │ │ 65%          │ │ 42%  │ │
│  └──────────────┘ └──────────────┘ └──────┘ │
│                                              │
│  📊 FEATURE IMPORTANCE (SHAP chart)         │
│  ▓▓▓▓▓▓▓▓░░  Adult_Dependents    (0.28)    │
│  ▓▓▓▓▓▓░░░░  Annual_Income       (0.22)    │
│  ▓▓▓▓▓░░░░░  Child_Dependents    (0.19)    │
│  ▓▓▓░░░░░░░  Deductible_Tier     (0.14)    │
│  ▓▓░░░░░░░░  Years_Without_Claims(0.09)    │
│  ▓░░░░░░░░░  Vehicles_on_Policy  (0.05)    │
│  ░░░░░░░░░░  Others              (0.03)    │
└──────────────────────────────────────────────┘
```

---

## 5. Backend API Specification

### 5.1 API Gateway (FastAPI)

Base URL: `http://localhost:8000/api/v1`

#### Endpoints

```yaml
# ── Authentication ──────────────────────────
POST   /auth/register          # Create account
POST   /auth/login             # JWT token pair
POST   /auth/refresh           # Refresh access token

# ── Form Submission ─────────────────────────
POST   /submissions            # Submit form data → returns submission_id
GET    /submissions/{id}       # Get submission status & results
GET    /submissions            # List user's submissions

# ── OCR Processing ──────────────────────────
POST   /ocr/upload             # Upload images → returns task_id
GET    /ocr/status/{task_id}   # Poll OCR task status
GET    /ocr/result/{task_id}   # Get extracted fields (JSON)

# ── Prediction / Recommendation ─────────────
POST   /predict                # Send features → get bundle recommendations
GET    /predict/{submission_id}# Get cached prediction for submission

# ── Explanation ─────────────────────────────
GET    /explain/{prediction_id}# Get NLP explanation for a prediction

# ── Bundles Catalog ─────────────────────────
GET    /bundles                # List all 10 coverage bundles
GET    /bundles/{id}           # Bundle details
```

#### Key Schemas

```python
# ── Request: Form Submission ────────────────
class SubmissionCreate(BaseModel):
    # Demographics & Financials
    adult_dependents: int
    child_dependents: int
    infant_dependents: int
    estimated_annual_income: float
    employment_status: str
    region_code: str

    # Customer History & Risk Profile
    existing_policyholder: bool
    previous_claims_filed: int
    years_without_claims: int
    previous_policy_duration_months: int
    policy_cancelled_post_purchase: bool

    # Policy Details & Preferences
    deductible_tier: str
    payment_schedule: str
    vehicles_on_policy: int
    custom_riders_requested: int
    grace_period_extensions: int

    # Sales & Underwriting
    days_since_quote: int
    underwriting_processing_days: int
    policy_amendments_count: int
    acquisition_channel: str
    broker_agency_type: str
    broker_id: Optional[str] = None
    employer_id: Optional[str] = None

    # Timeline (from date picker → decomposed)
    policy_start_year: int
    policy_start_month: int
    policy_start_week: int
    policy_start_day: int

    source: Literal["form", "ocr"]

# ── Response: Prediction ────────────────────
class PredictionResponse(BaseModel):
    prediction_id: str
    submission_id: str
    recommended_bundle: BundleDetail        # top-1 bundle
    alternatives: list[BundleDetail]        # remaining ranked bundles
    confidence_scores: dict[str, float]     # bundle_name → probability
    explanation: ExplanationBlock
    cached: bool                            # true if served from Redis
    model_version: str                      # MLflow model version

# ── Response: Explanation ───────────────────
class ExplanationBlock(BaseModel):
    summary: str                            # 2-3 sentence NLP explanation
    feature_importance: list[FeatureWeight] # SHAP values (name, value, direction)
    counterfactual: Optional[str]           # "If X were different..."

# ── Bundle Detail ───────────────────────────
class BundleDetail(BaseModel):
    bundle_id: int                          # 0-9
    bundle_name: str                        # e.g. "Family_Comprehensive"
    confidence: float                       # model probability
    description: str                        # human-readable summary
```

### 5.2 Request Flow with Redis Caching

```
Client ─── POST /predict ──▸ API Gateway
                                │
                          ┌─────▼──────┐
                          │ Hash input  │
                          │ features    │
                          └─────┬──────┘
                                │
                     ┌──────────▼──────────┐
                     │   Redis GET hash    │
                     │   cache:pred:{hash} │
                     └──────────┬──────────┘
                                │
                    ┌───── HIT ─┤─ MISS ─────┐
                    │           │             │
                    ▼           │             ▼
              Return cached     │     ML Service inference
              (< 5ms)          │     SHAP explanation
                                │     Store in Redis (TTL 1h)
                                │             │
                                │             ▼
                                │       Return fresh result
                                │       (200-500ms)
```

**Redis Key Strategy:**

```
cache:pred:{sha256(sorted_features)}    → PredictionResponse    (TTL: 1 hour)
cache:ocr:{file_hash}                  → OCR result             (TTL: 24 hours)
cache:bundles:all                      → Bundles catalog         (TTL: 6 hours)
rate:user:{user_id}                    → Rate limit counter      (TTL: 60s)
session:model_version                  → Current production ver  (no TTL, updated on deploy)
```

---

## 6. OCR Pipeline

### 6.1 Architecture

```
Upload Request
     │
     ▼
┌─────────────┐     ┌──────────────┐     ┌──────────────┐
│ API Gateway │────▸│  RabbitMQ    │────▸│ OCR Worker   │
│ (validates) │     │  (task queue)│     │ (Celery)     │
└─────────────┘     └──────────────┘     └──────┬───────┘
                                                │
                                    ┌───────────▼────────────┐
                                    │ 1. Preprocess image    │
                                    │    - deskew, denoise   │
                                    │    - contrast enhance  │
                                    │ 2. PaddleOCR / Tess    │
                                    │    - text extraction   │
                                    │ 3. Field parsing       │
                                    │    - regex + NER       │
                                    │    - map to dataset    │
                                    │      columns           │
                                    │ 4. Confidence scoring  │
                                    └───────────┬────────────┘
                                                │
                                                ▼
                                    Structured JSON → form fields
                                    Notify client via polling
```

### 6.2 Supported Document Types → Field Mapping

| Document Type        | Fields Extracted → Dataset Columns                                                   |
| -------------------- | ------------------------------------------------------------------------------------ |
| Insurance Quote      | `Deductible_Tier`, `Payment_Schedule`, `Custom_Riders_Requested`, `Days_Since_Quote` |
| Prior Policy Doc     | `Previous_Policy_Duration_Months`, `Previous_Claims_Filed`, `Years_Without_Claims`   |
| ID Card              | Name, DOB → derive `Region_Code` from address                                        |
| Pay Stub / Tax Doc   | `Estimated_Annual_Income`, `Employment_Status`, `Employer_ID`                        |
| Vehicle Registration | `Vehicles_on_Policy`                                                                 |

### 6.3 OCR Tech Choice

- **Primary**: PaddleOCR (better for mixed Arabic/French/English documents)
- **Fallback**: Tesseract 5 with `ara` + `fra` + `eng` language packs
- **PDF handling**: pdf2image → rasterize at 300 DPI → OCR

---

## 7. ML Recommendation Engine

### 7.1 Problem Formulation

| Aspect     | Detail                                            |
| ---------- | ------------------------------------------------- |
| **Task**   | Multi-class classification (10 classes)           |
| **Input**  | 28 features (see Section 2.3)                     |
| **Output** | Probability distribution over 10 coverage bundles |
| **Target** | `Purchased_Coverage_Bundle` (0–9)                 |
| **Metric** | Macro F1-score (primary), Accuracy, Log-loss      |

### 7.2 Feature Engineering Pipeline

```python
def build_feature_vector(raw: dict) -> pd.DataFrame:
    """
    Transform raw submission into model-ready features.
    Must match training pipeline exactly.
    """
    features = {}

    # ── Numeric (pass-through) ──────────────────
    NUMERIC_COLS = [
        "Adult_Dependents", "Child_Dependents", "Infant_Dependents",
        "Estimated_Annual_Income",
        "Previous_Claims_Filed", "Years_Without_Claims",
        "Previous_Policy_Duration_Months",
        "Vehicles_on_Policy", "Custom_Riders_Requested",
        "Grace_Period_Extensions",
        "Days_Since_Quote", "Underwriting_Processing_Days",
        "Policy_Amendments_Count",
        "Policy_Start_Year", "Policy_Start_Month",
        "Policy_Start_Week", "Policy_Start_Day",
    ]

    # ── Boolean → int ───────────────────────────
    BOOL_COLS = [
        "Existing_Policyholder",
        "Policy_Cancelled_Post_Purchase",
    ]

    # ── Categorical → label/ordinal/target encode ─
    CATEGORICAL_COLS = [
        "Employment_Status",      # label encode
        "Region_Code",            # label encode
        "Deductible_Tier",        # ordinal encode (Low=0, Med=1, High=2)
        "Payment_Schedule",       # label encode
        "Acquisition_Channel",    # label encode
        "Broker_Agency_Type",     # label encode
    ]

    # ── High cardinality → frequency/target encode ─
    HIGH_CARD_COLS = [
        "Broker_ID",              # frequency encode
        "Employer_ID",            # frequency encode
    ]

    # ── Derived features ────────────────────────
    derived = {
        "total_dependents":       adult + child + infant,
        "has_dependents":         int(total_dependents > 0),
        "income_per_dependent":   income / max(total_dependents, 1),
        "claims_rate":            claims / max(policy_duration_months, 1),
        "risk_score":             claims - years_without_claims,
        "quote_to_process_ratio": days_since_quote / max(underwriting_days, 1),
        "policy_complexity":      vehicles + riders + amendments,
    }

    return feature_df
```

### 7.3 Model Stack

| Stage        | Model                                 | Purpose                                      |
| ------------ | ------------------------------------- | -------------------------------------------- |
| **v1 (MVP)** | XGBoost Classifier (`multi:softprob`) | Fast, interpretable, works with tabular data |
| **v2**       | LightGBM + CatBoost ensemble          | Better categorical handling, stacking        |
| **v3**       | AutoML (FLAML / AutoGluon)            | Automated model selection & tuning           |

### 7.4 Training Pipeline

```
┌────────────┐    ┌──────────────┐    ┌──────────────┐    ┌────────────┐
│ train.csv  │───▸│ Feature Eng  │───▸│ Train/Val    │───▸│ Evaluate   │
│ (raw data) │    │ Pipeline     │    │ Stratified   │    │ Metrics    │
│            │    │ (encoders +  │    │ 5-Fold CV    │    │            │
│            │    │  derived)    │    │              │    │            │
└────────────┘    └──────────────┘    └──────────────┘    └─────┬──────┘
                                                                │
                                                    ┌───────────▼──────────┐
                                                    │ MLflow log:          │
                                                    │  - params            │
                                                    │  - metrics:          │
                                                    │    macro_f1          │
                                                    │    accuracy          │
                                                    │    log_loss          │
                                                    │    per-class F1      │
                                                    │  - model artifact    │
                                                    │  - SHAP summary plot │
                                                    │  - confusion matrix  │
                                                    │  - feature encoders  │
                                                    └───────────┬──────────┘
                                                                │
                                                    ┌───────────▼──────────┐
                                                    │ If metrics improve:  │
                                                    │  → Promote to        │
                                                    │    "Production" in   │
                                                    │    MLflow Registry   │
                                                    │  → Update Redis key  │
                                                    │    session:model_ver │
                                                    └──────────────────────┘
```

### 7.5 Inference Pipeline

```python
async def predict_bundle(features: dict) -> PredictionResponse:
    """
    1. Check Redis cache (hash of sorted features)
    2. If miss → load Production model from MLflow
    3. Transform features using saved encoders
    4. model.predict_proba(features) → probabilities for all 10 bundles
    5. Sort by probability descending
    6. Generate SHAP explanation for top prediction
    7. Cache result in Redis (TTL 1h)
    8. Return ranked bundles + explanation
    """
```

---

## 8. Explainability (XAI) Service

### 8.1 Architecture

```python
# For each prediction, generate:
{
    "summary": "...",                    # Human-readable 2-3 sentence explanation
    "feature_importance": [              # SHAP values per feature
        {"feature": "Adult_Dependents", "value": 2, "shap": 0.28, "direction": "positive"},
        {"feature": "Estimated_Annual_Income", "value": 85000, "shap": 0.22, "direction": "positive"},
        ...
    ],
    "counterfactual": "..."              # "If you had 0 vehicles, Auto bundles would rank lower"
}
```

### 8.2 Explanation Generation

```
Prediction probabilities + SHAP values
        │
        ▼
┌───────────────────┐
│ Template Engine   │
│ (Jinja2)          │
│                   │
│ Rules:            │
│ - Top 3 SHAP      │
│   features        │
│ - Bundle-specific  │
│   context         │
│ - Risk assessment │
│ - Counterfactual  │
│   ("what if")     │
└────────┬──────────┘
         │
         ▼
  Natural language summary
```

### 8.3 Template Example

```jinja2
Based on your profile with {{ adult_dependents }} adult and {{ child_dependents }} child
dependents{% if infant_dependents > 0 %} plus {{ infant_dependents }} infant(s){% endif %},
and an estimated annual income of ${{ "{:,.0f}".format(income) }},
**{{ recommended_bundle }}** is the best match with {{ "%.0f"|format(confidence * 100) }}% confidence.

{% if top_feature == "Adult_Dependents" or top_feature == "Child_Dependents" %}
Your family size is the primary driver — this bundle provides comprehensive coverage
for all household members.
{% elif top_feature == "Vehicles_on_Policy" %}
With {{ vehicles }} vehicles on your policy, this bundle optimizes your auto coverage costs.
{% elif top_feature == "Estimated_Annual_Income" %}
Your income level positions you well for this tier of coverage, balancing premium cost
with protection breadth.
{% endif %}

{% if years_without_claims > 3 %}
Your clean claims history ({{ years_without_claims }} years) qualifies you for
favorable rates under this bundle.
{% endif %}
```

### 8.4 Bundle-Specific Explanation Context

| Bundle               | Key Driving Features             | Explanation Focus                  |
| -------------------- | -------------------------------- | ---------------------------------- |
| Auto_Comprehensive   | Vehicles, Income, Region         | Vehicle count, driving profile     |
| Auto_Liability_Basic | Vehicles, Low income, Budget     | Cost-effective minimum coverage    |
| Basic_Health         | Low dependents, Young, Budget    | Essential health for individuals   |
| Family_Comprehensive | High dependents, Income          | Family size, comprehensive needs   |
| Health_Dental_Vision | Moderate dependents, Health pref | Health package completeness        |
| Home_Premium         | Income, Region, No vehicles      | High-value property protection     |
| Home_Standard        | Moderate income, Homeowner       | Standard property coverage         |
| Premium_Health_Life  | High income, Family, Risk-averse | Premium tier, long-term protection |
| Renter_Basic         | Low income, No vehicles, Single  | Budget renter coverage             |
| Renter_Premium       | Moderate income, Valuables       | Enhanced renter protection         |

---

## 9. MLOps & Continuous Retraining

### 9.1 MLflow Setup

```
services/ml-service/
├── mlflow_config/
│   ├── Dockerfile              # MLflow tracking server
│   └── entrypoint.sh
├── experiments/
│   └── bundle_recommender/     # Main experiment
└── registry/
    ├── Production/             # Currently served model
    ├── Staging/                # Candidate model under evaluation
    └── Archived/               # Previous versions
```

### 9.2 Model Artifacts Logged per Run

```yaml
artifacts:
  - model.pkl # Serialized XGBoost model
  - feature_encoders.pkl # Label/ordinal encoders
  - feature_names.json # Ordered feature list
  - shap_summary.png # SHAP summary plot
  - confusion_matrix.png # Confusion matrix
  - classification_report.json # Per-class metrics
  - training_config.yaml # Hyperparameters used

metrics:
  - macro_f1
  - weighted_f1
  - accuracy
  - log_loss
  - per_class_f1_0 ... per_class_f1_9

params:
  - n_estimators
  - max_depth
  - learning_rate
  - subsample
  - colsample_bytree
  - num_features
  - training_samples
  - cv_folds
```

### 9.3 Retraining Trigger Strategy

| Trigger              | Condition                                    | Action                               |
| -------------------- | -------------------------------------------- | ------------------------------------ |
| **Scheduled**        | Every Sunday 02:00 UTC                       | Full retrain on all accumulated data |
| **Data drift**       | PSI > 0.2 on any feature distribution        | Alert + auto-retrain                 |
| **Performance drop** | Rolling 7-day F1 drops > 5% from baseline    | Auto-retrain + alert                 |
| **Data volume**      | 500+ new submissions since last train        | Trigger retrain                      |
| **Manual**           | Admin triggers via `/admin/retrain` endpoint | On-demand retrain                    |

### 9.4 CI/CD for Models

```
┌─────────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│ New data     │───▸│ Retrain      │───▸│ Evaluate     │───▸│ A/B Test     │
│ accumulated  │    │ pipeline     │    │ on holdout   │    │ (shadow mode)│
└─────────────┘    └──────────────┘    └──────┬───────┘    └──────┬───────┘
                                              │                    │
                                    Pass ─────┤                    │
                                    (F1 >=    │                    │
                                     baseline)│                    │
                                              ▼                    ▼
                                    ┌──────────────┐    ┌──────────────┐
                                    │ Register in  │    │ Promote to   │
                                    │ MLflow       │    │ Production   │
                                    │ (Staging)    │    │ if shadow OK │
                                    └──────────────┘    └──────────────┘
```

### 9.5 Monitoring & Observability

```yaml
monitoring:
  metrics_tracked:
    - prediction_latency_p50_p95_p99
    - cache_hit_rate
    - model_f1_rolling_7d
    - feature_drift_psi_per_column
    - prediction_distribution # are we over-predicting one bundle?
    - ocr_success_rate
    - api_error_rate_by_endpoint

  alerting:
    channel: slack / email
    conditions:
      - p99_latency > 2s
      - cache_hit_rate < 50%
      - f1_drop > 5%
      - ocr_fail_rate > 20%
      - single_bundle_predicted > 40% # class imbalance alert

  dashboards:
    - grafana: model_performance # F1, accuracy, confusion matrix over time
    - grafana: api_health # latency, error rates, throughput
    - grafana: ocr_pipeline # success rate, processing time
    - grafana: data_drift # PSI per feature over time
```

---

## 10. Database Schema

### 10.1 Core Tables

```sql
-- Users
CREATE TABLE users (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email         VARCHAR(255) UNIQUE NOT NULL,
    phone         VARCHAR(20),
    password_hash VARCHAR(255) NOT NULL,
    full_name     VARCHAR(255),
    created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Coverage Bundles catalog (the 10 bundles)
CREATE TABLE bundles (
    id              INTEGER PRIMARY KEY,          -- 0-9
    bundle_name     VARCHAR(100) UNIQUE NOT NULL,  -- e.g. "Family_Comprehensive"
    display_name    VARCHAR(200) NOT NULL,          -- e.g. "Family Comprehensive Package"
    description     TEXT,
    category        VARCHAR(50),                    -- Auto / Health / Home / Renter / Life
    icon            VARCHAR(50),                    -- icon identifier for frontend
    is_active       BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Seed data for bundles
INSERT INTO bundles (id, bundle_name, display_name, category) VALUES
(0, 'Auto_Comprehensive',    'Auto Comprehensive Coverage',    'Auto'),
(1, 'Auto_Liability_Basic',  'Auto Basic Liability',           'Auto'),
(2, 'Basic_Health',          'Basic Health Coverage',           'Health'),
(3, 'Family_Comprehensive',  'Family Comprehensive Package',   'Family'),
(4, 'Health_Dental_Vision',  'Health + Dental + Vision',       'Health'),
(5, 'Home_Premium',          'Home Premium Protection',        'Home'),
(6, 'Home_Standard',         'Home Standard Coverage',         'Home'),
(7, 'Premium_Health_Life',   'Premium Health & Life',          'Health'),
(8, 'Renter_Basic',          'Basic Renter Insurance',         'Renter'),
(9, 'Renter_Premium',        'Premium Renter Insurance',       'Renter');

-- User submissions (form or OCR)
CREATE TABLE submissions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID REFERENCES users(id),
    source          VARCHAR(10) CHECK (source IN ('form', 'ocr')),
    raw_data        JSONB NOT NULL,           -- original input (all 28 features)
    processed_data  JSONB,                    -- cleaned + derived feature vector
    status          VARCHAR(20) DEFAULT 'pending',
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Predictions
CREATE TABLE predictions (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    submission_id        UUID REFERENCES submissions(id),
    model_version        VARCHAR(50) NOT NULL,
    recommended_bundle   INTEGER REFERENCES bundles(id),
    all_probabilities    JSONB NOT NULL,       -- {bundle_id: probability} for all 10
    feature_vector       JSONB NOT NULL,       -- exact input to model
    shap_values          JSONB,                -- SHAP explanation data
    explanation_text     TEXT,                 -- generated NLP summary
    latency_ms           INTEGER,
    cache_hit            BOOLEAN DEFAULT FALSE,
    created_at           TIMESTAMPTZ DEFAULT NOW()
);

-- OCR tasks
CREATE TABLE ocr_tasks (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    submission_id   UUID REFERENCES submissions(id),
    file_paths      TEXT[] NOT NULL,
    status          VARCHAR(20) DEFAULT 'queued',  -- queued/processing/done/failed
    extracted_data  JSONB,                         -- mapped to dataset columns
    confidence      DECIMAL(3,2),
    error_message   TEXT,
    started_at      TIMESTAMPTZ,
    completed_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Model performance log (for drift detection & monitoring)
CREATE TABLE model_metrics (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    model_version   VARCHAR(50) NOT NULL,
    metric_name     VARCHAR(50) NOT NULL,      -- macro_f1, accuracy, log_loss, psi_*
    metric_value    DECIMAL(10,6) NOT NULL,
    dataset_size    INTEGER,
    recorded_at     TIMESTAMPTZ DEFAULT NOW()
);

-- Feedback / ground truth (for retraining)
CREATE TABLE feedback (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    prediction_id   UUID REFERENCES predictions(id),
    actual_bundle   INTEGER REFERENCES bundles(id),  -- what the user actually chose
    satisfaction    INTEGER CHECK (satisfaction BETWEEN 1 AND 5),
    created_at      TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 11. Infrastructure

### 11.1 Environment Variables

```bash
# ── Database ────────────────────────
POSTGRES_HOST=postgres
POSTGRES_PORT=5432
POSTGRES_DB=datadangereuse
POSTGRES_USER=app
POSTGRES_PASSWORD=<secret>

# ── Redis ───────────────────────────
REDIS_URL=redis://redis:6379/0
REDIS_CACHE_TTL=3600

# ── MLflow ──────────────────────────
MLFLOW_TRACKING_URI=http://mlflow:5000
MLFLOW_S3_ENDPOINT_URL=http://minio:9000
AWS_ACCESS_KEY_ID=minioadmin
AWS_SECRET_ACCESS_KEY=<secret>

# ── OCR ─────────────────────────────
OCR_ENGINE=paddleocr
OCR_LANGUAGES=ar,fr,en
CELERY_BROKER_URL=amqp://rabbitmq:5672

# ── API ─────────────────────────────
API_SECRET_KEY=<secret>
API_CORS_ORIGINS=http://localhost:3000
JWT_EXPIRY_MINUTES=60

# ── ML Service ──────────────────────
MODEL_NAME=bundle_recommender
MODEL_STAGE=Production
SHAP_BACKGROUND_SAMPLES=100
```

### 11.2 Tech Stack Summary

```
┌─────────────────────────────────────────────────┐
│                   FRONTEND                       │
│  Next.js 14 · React 18 · Tailwind · shadcn/ui  │
│  react-hook-form · zod · react-query · qrcode  │
│  recharts (SHAP charts)                         │
├─────────────────────────────────────────────────┤
│                   BACKEND                        │
│  FastAPI · Pydantic v2 · SQLAlchemy 2 · Alembic│
│  Celery · httpx · python-jose (JWT)             │
├─────────────────────────────────────────────────┤
│                   ML / AI                        │
│  XGBoost · scikit-learn · SHAP · PaddleOCR     │
│  MLflow · pandas · numpy · Jinja2 · FLAML      │
├─────────────────────────────────────────────────┤
│                   INFRA                          │
│  Docker · PostgreSQL 16 · Redis 7 · RabbitMQ   │
│  MinIO · Nginx (reverse proxy)                  │
└─────────────────────────────────────────────────┘
```

---

## 12. Agent Task Breakdown

> Each agent should read THIS document first, then implement their scope.

### Agent 1: Frontend Agent

**Scope**: Everything in `frontend/`

| Task                | Priority | Details                                                 |
| ------------------- | -------- | ------------------------------------------------------- |
| Landing page        | P0       | Hero, QR code, features grid, CTA buttons (Olea-style)  |
| QR code component   | P0       | Generate dynamic QR code with deep-link                 |
| Multi-step form     | P0       | 5-step form matching Section 4.3 spec (all 28 features) |
| Scanner/upload page | P0       | Drag-drop, camera, gallery upload with preview          |
| Dashboard page      | P0       | Recommendation card, SHAP bar chart, alternatives grid  |
| History page        | P1       | List past submissions with status                       |
| Auth pages          | P1       | Login, register, forgot password                        |
| PWA setup           | P2       | Service worker, manifest, offline support               |

**Key Libraries**: `next`, `tailwindcss`, `shadcn/ui`, `react-hook-form`, `zod`, `@tanstack/react-query`, `qrcode.react`, `recharts`

---

### Agent 2: Backend API Agent

**Scope**: Everything in `backend/`

| Task                 | Priority | Details                                      |
| -------------------- | -------- | -------------------------------------------- |
| FastAPI app scaffold | P0       | Project structure, config, CORS, middleware  |
| Auth endpoints       | P0       | JWT register/login/refresh                   |
| Submission endpoints | P0       | CRUD for form submissions (28 features)      |
| OCR upload endpoint  | P0       | File validation, task dispatch to Celery     |
| Prediction endpoint  | P0       | Feature prep → ML service call → Redis cache |
| Redis caching layer  | P0       | Hash-based cache with TTL (see Section 5.2)  |
| Database models      | P0       | SQLAlchemy models matching Section 10        |
| Alembic migrations   | P1       | Initial migration + seed bundle data         |
| Explanation endpoint | P1       | Fetch SHAP explanation for prediction        |

**Key Libraries**: `fastapi`, `sqlalchemy`, `alembic`, `redis`, `celery`, `pydantic`, `python-jose`, `passlib`, `httpx`

---

### Agent 3: OCR Agent

**Scope**: Everything in `services/ocr-worker/`

| Task                  | Priority | Details                                            |
| --------------------- | -------- | -------------------------------------------------- |
| Celery worker setup   | P0       | Connect to RabbitMQ, task registration             |
| Image preprocessing   | P0       | Deskew, denoise, contrast enhancement              |
| PaddleOCR integration | P0       | Text extraction with confidence                    |
| Field parser          | P0       | Map extracted text → dataset columns (Section 6.2) |
| PDF support           | P1       | pdf2image conversion at 300 DPI                    |
| Arabic/French support | P1       | Multi-language OCR config                          |
| Confidence scoring    | P1       | Per-field extraction confidence                    |

**Key Libraries**: `celery`, `paddleocr`, `opencv-python`, `Pillow`, `pdf2image`, `pytesseract`

---

### Agent 4: ML & Explainability Agent

**Scope**: Everything in `services/ml-service/` and `services/explainer/`

| Task                 | Priority | Details                                             |
| -------------------- | -------- | --------------------------------------------------- |
| Data loading & EDA   | P0       | Load train.csv, explore distributions               |
| Feature engineering  | P0       | Encoders + derived features (Section 7.2)           |
| XGBoost training     | P0       | Stratified 5-fold CV, hyperparameter tuning         |
| MLflow integration   | P0       | Log experiments, register models, track metrics     |
| Inference API        | P0       | FastAPI server loading model from MLflow registry   |
| SHAP explainer       | P0       | TreeExplainer for per-prediction feature importance |
| NLP explanation gen  | P0       | Jinja2 templates (Section 8.3) per-bundle context   |
| Retraining scheduler | P1       | Cron-based retrain trigger (Section 9.3)            |
| Data drift detection | P1       | PSI calculation on feature distributions            |
| Synthetic data gen   | P0       | Generate demo data if train.csv is small            |

**Key Libraries**: `xgboost`, `lightgbm`, `scikit-learn`, `shap`, `mlflow`, `pandas`, `numpy`, `jinja2`, `apscheduler`

---

### Agent 5: Infrastructure Agent

**Scope**: `docker-compose.yml`, `infra/`, CI/CD

| Task              | Priority | Details                         |
| ----------------- | -------- | ------------------------------- |
| Docker Compose    | P0       | All 10 services orchestrated    |
| Nginx config      | P1       | Reverse proxy, path routing     |
| GitHub Actions CI | P1       | Lint, test, build, push images  |
| Monitoring setup  | P2       | Prometheus + Grafana dashboards |

---

## 13. File Structure Reference

```
data-dangereuse/
├── .claude/
│   └── master_prompt.md              ← THIS FILE
├── data/
│   ├── train.csv                     ← Training data
│   ├── test.csv                      ← Test data
│   └── sample_submission.csv         ← Submission format
├── frontend/                         ← Next.js app
│   ├── public/
│   ├── src/
│   │   ├── app/                      # App Router pages
│   │   │   ├── page.tsx              # Landing page (Olea-style)
│   │   │   ├── download/page.tsx     # QR code page
│   │   │   └── app/
│   │   │       ├── scan/page.tsx     # OCR upload
│   │   │       ├── form/page.tsx     # 5-step manual form
│   │   │       ├── dashboard/page.tsx# Results + explanation
│   │   │       └── history/page.tsx  # Past submissions
│   │   ├── components/
│   │   │   ├── ui/                   # shadcn/ui components
│   │   │   ├── landing/              # Landing page sections
│   │   │   ├── form/                 # Form step components (5 steps)
│   │   │   ├── scanner/              # Upload/camera components
│   │   │   └── dashboard/            # Result cards, SHAP chart
│   │   ├── lib/
│   │   │   ├── api.ts                # API client
│   │   │   ├── validations.ts        # Zod schemas (match dataset cols)
│   │   │   └── utils.ts
│   │   └── hooks/
│   ├── tailwind.config.ts
│   ├── next.config.js
│   └── package.json
├── backend/                          ← FastAPI application
│   ├── app/
│   │   ├── main.py                   # FastAPI app entry
│   │   ├── config.py                 # Settings (pydantic-settings)
│   │   ├── api/
│   │   │   ├── v1/
│   │   │   │   ├── auth.py
│   │   │   │   ├── submissions.py
│   │   │   │   ├── ocr.py
│   │   │   │   ├── predict.py
│   │   │   │   ├── explain.py
│   │   │   │   └── bundles.py
│   │   │   └── deps.py               # Dependencies (DB, Redis, Auth)
│   │   ├── models/                   # SQLAlchemy models
│   │   ├── schemas/                  # Pydantic schemas
│   │   ├── services/
│   │   │   ├── prediction.py         # Prediction business logic
│   │   │   ├── cache.py              # Redis caching logic
│   │   │   └── ocr_dispatch.py       # Celery task dispatch
│   │   └── db/
│   │       ├── session.py
│   │       └── migrations/           # Alembic
│   ├── requirements.txt
│   ├── Dockerfile
│   └── tests/
├── services/
│   ├── ocr-worker/                   ← OCR Celery worker
│   │   ├── worker.py
│   │   ├── tasks.py
│   │   ├── preprocessor.py           # Image preprocessing
│   │   ├── extractor.py              # PaddleOCR wrapper
│   │   ├── field_parser.py           # Map text → dataset columns
│   │   ├── requirements.txt
│   │   └── Dockerfile
│   ├── ml-service/                   ← ML inference + training
│   │   ├── app.py                    # FastAPI inference server
│   │   ├── train.py                  # Training pipeline (XGBoost)
│   │   ├── features.py               # Feature engineering (Section 7.2)
│   │   ├── predict.py                # Inference logic
│   │   ├── retrain.py                # Scheduled retraining
│   │   ├── drift.py                  # Data drift detection (PSI)
│   │   ├── requirements.txt
│   │   └── Dockerfile
│   └── explainer/                    ← Explanation service
│       ├── app.py                    # FastAPI explanation server
│       ├── shap_explainer.py         # SHAP TreeExplainer
│       ├── templates/
│       │   ├── explanation.j2        # Main explanation template
│       │   └── bundle_context.j2     # Per-bundle context
│       ├── requirements.txt
│       └── Dockerfile
├── infra/
│   ├── nginx/
│   │   └── nginx.conf
│   ├── mlflow/
│   │   └── Dockerfile
│   └── monitoring/
│       ├── prometheus.yml
│       └── grafana/
│           └── dashboards/
├── docker-compose.yml
├── .env.example
├── .gitignore
└── README.md
```

---

## 14. Demo / MVP Priorities

For the tech demo, focus on this **critical path**:

```
1. Landing page with QR code           ← Agent 1
2. 5-step form (all 28 features)       ← Agent 1 + Agent 2
3. Load train.csv, train XGBoost       ← Agent 4
4. MLflow experiment tracking          ← Agent 4
5. Prediction endpoint + Redis cache   ← Agent 2 + Agent 4
6. Dashboard with SHAP explanation     ← Agent 1 + Agent 4
7. OCR upload pipeline                 ← Agent 3 (can be Phase 2)
8. Docker compose for all services     ← Agent 5
```

**MVP Definition**: A user can land on the homepage, fill the 5-step form with their insurance profile, submit, and see a recommended Coverage Bundle with a natural language explanation and SHAP feature importance chart — all in under 3 seconds (with Redis cache).

---

_End of Master Architecture Document_
