<div align="center">

# 🛡️ CERTUS

### AI-Powered Insurance Coverage Recommendation Platform

[![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?style=for-the-badge&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![Expo](https://img.shields.io/badge/Expo_SDK-54-000020?style=for-the-badge&logo=expo&logoColor=white)](https://expo.dev)
[![React Native](https://img.shields.io/badge/React_Native-0.81-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://reactnative.dev)

<br/>

> **Find your ideal insurance bundle in seconds.**<br/>
> Upload your documents or fill a quick form — our AI engine analyzes your profile<br/>
> and recommends the perfect coverage package with a human-readable explanation of _why_ it fits you.

<br/>

[Getting Started](#-getting-started) •
[API Reference](#-api-reference) •
[Architecture](#-system-architecture) •
[ML Pipeline](#-ml-pipeline)

<br/>

---

</div>

## 📋 Table of Contents

- [Product Overview](#-product-overview)
- [System Architecture](#-system-architecture)
- [User Flow](#-user-flow)
- [Tech Stack](#-tech-stack)
- [Coverage Bundles](#-coverage-bundles)
- [ML Pipeline](#-ml-pipeline)
- [Feature Engineering](#-feature-engineering)
- [API Reference](#-api-reference)
- [Services & Ports](#-services--ports)
- [Getting Started](#-getting-started)
- [MLOps & Caching](#-mlops--caching)
- [Project Structure](#-project-structure)

---

## 🎯 Product Overview

**CERTUS** is a mobile-first web application for an international insurance brokerage. It enables clients to receive personalized insurance bundle recommendations through two paths:

| Path              | Description                                                                                |
| ----------------- | ------------------------------------------------------------------------------------------ |
| 📷 **OCR Scan**   | Upload quotes, ID cards, or prior policy documents — extracted automatically via PaddleOCR |
| 📝 **Smart Form** | Fill a structured 5-step form with demographic, financial, and policy details              |

The backend ML engine predicts the best **Coverage Bundle** (out of 10 insurance packages) and provides a natural-language explanation powered by SHAP + LLM.

---

## 🏗️ System Architecture

The system is built as a **modular microservices ecosystem**, decoupling the client-facing interfaces from computationally intensive ML and OCR workloads to ensure high availability and fault tolerance.

![Architecture Overview](ARCHI.png)

---

## 🔄 User Flow

![User Flow Diagram](user_flow.png)

```
┌─────────────┐     ┌──────────────┐     ┌──────────────────┐     ┌──────────────────┐
│  HOMEPAGE   │────▸│  QR CODE /   │────▸│  DATA CAPTURE    │────▸│   DASHBOARD      │
│  (Landing)  │     │  APP INSTALL │     │  Form OR Scanner │     │  Recommendation  │
│             │     │              │     │                  │     │  + Explanation   │
└─────────────┘     └──────────────┘     └──────────────────┘     └──────────────────┘
```

| Step | Action                                    | Technical Detail                                          |
| ---- | ----------------------------------------- | --------------------------------------------------------- |
| 1    | User lands on homepage                    | Next.js SSR landing page with hero, features, CTA         |
| 2    | Scans QR code or clicks download          | QR encodes deep-link / PWA install prompt                 |
| 3a   | **Option A**: Uploads photos from gallery | Images → Backend → OCR (PaddleOCR) → structured JSON      |
| 3b   | **Option B**: Fills form manually         | React Hook Form → validated JSON payload                  |
| 4    | Backend runs recommendation model         | Feature vector → trained XGBoost → top-K bundles + scores |
| 5    | Dashboard shows results                   | Best bundle card + NLP explanation (SHAP + LLM)           |

---

## 🛠️ Tech Stack

<table>
<tr>
<td valign="top" width="33%">

### 📱 Frontend

![Expo](https://img.shields.io/badge/Expo-54-000020?style=flat-square&logo=expo)
![React Native](https://img.shields.io/badge/React_Native-0.81-61DAFB?style=flat-square&logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?style=flat-square&logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react)

| Tech              | Purpose                |
| :---------------- | :--------------------- |
| Expo SDK 54       | Cross-platform runtime |
| React Native 0.81 | Native UI framework    |
| expo-router       | File-based navigation  |
| expo-image-picker | Camera & gallery       |

</td>
<td valign="top" width="33%">

### ⚙️ Backend

![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?style=flat-square&logo=fastapi)
![Python](https://img.shields.io/badge/Python-3.12-3776AB?style=flat-square&logo=python&logoColor=white)
![SQLAlchemy](https://img.shields.io/badge/SQLAlchemy-2.0-D71F00?style=flat-square)
![Pydantic](https://img.shields.io/badge/Pydantic-v2-E92063?style=flat-square)

| Tech                   | Purpose           |
| :--------------------- | :---------------- |
| FastAPI                | Async REST API    |
| SQLAlchemy + aiosqlite | Async ORM + DB    |
| Pydantic v2            | Schema validation |
| python-multipart       | File uploads      |

</td>
<td valign="top" width="33%">

### 🧠 ML / AI

![XGBoost](https://img.shields.io/badge/XGBoost-2.1-FF6600?style=flat-square)
![scikit-learn](https://img.shields.io/badge/sklearn-1.6-F7931E?style=flat-square&logo=scikitlearn&logoColor=white)
![SHAP](https://img.shields.io/badge/SHAP-Explainability-blueviolet?style=flat-square)
![OpenAI](https://img.shields.io/badge/OpenAI-LLM-412991?style=flat-square&logo=openai&logoColor=white)

| Tech                  | Purpose             |
| :-------------------- | :------------------ |
| XGBoost 2.1           | 10-class classifier |
| SHAP                  | Feature importances |
| OpenAI                | NL explanations     |
| Tesseract + RapidFuzz | OCR pipeline        |

</td>
</tr>
</table>

---

## 📦 Coverage Bundles

The model predicts one of **10 insurance packages**:

| ID  | Bundle                 | Description                |
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

---

## 🤖 ML Pipeline

### Model: XGBoost

XGBoost was selected after robust hyperparameter optimization and AutoML benchmarking, constrained by the competition's evaluation criteria:

- **Memory footprint**: < 10 MB (serialized) — well within the 200 MB penalty threshold
- **Inference latency**: Sub-millisecond per payload via optimized C++ backend
- **Multiclass handling**: Native support for 10-class classification with heterogeneous features

### Explainability: SHAP + LLM

```
XGBoost Prediction
       │
       ▼
  SHAP Values  ──────────▶  OpenAI LLM
  (per feature)              │
                             ▼
                    Natural-language explanation
                    e.g. "Based on your 2 adult
                    dependents and clean claims
                    history (4 years), Family_
                    Comprehensive offers the most
                    complete protection..."
```

### Feature Engineering Highlights

The pipeline synthesizes **40+ derived dimensions** across 11 feature families:

| Family                            | Description                                                                                                   |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| **Socio-Demographic Profiling**   | Logarithmic income normalization, composite affluence indicators (`Affluent_Family`, `Budget_Renter_Profile`) |
| **Actuarial Risk Quantification** | Composite `Risk_Score` penalizing claims and grace extensions, rewarding claim-free tenure                    |
| **Loyalty Flags**                 | `Churny_Loyalist` — high historical retention with recent attrition signals                                   |
| **Underwriting Friction**         | `Amendment_Rate`, `Quote_Speed` — procedural elasticity metrics                                               |
| **Cyclical Temporal Embeddings**  | Sine/cosine Fourier transforms on Month, Week, Day to preserve cyclicality without categorical explosion      |

All binary thresholds were calibrated via **Mutual Information sweeps** and **Cramér's V optimization**:

| Feature             | Initial     | Optimized  | ΔV     |
| ------------------- | ----------- | ---------- | ------ |
| `Long_Tenure`       | ≥ 36 months | ≥ 5 months | +0.158 |
| `Has_Vehicle`       | > 1         | ≥ 1        | +0.142 |
| `Grace_Period_Ext.` | ≥ 0         | ≥ 1        | +0.130 |
| `High_Friction`     | > 3         | ≥ 1        | +0.072 |

---

## 📡 API Reference

> **Base URL** · `http://localhost:8000/api/v1` · **Docs** · [`/docs`](http://localhost:8000/docs)

| Method | Endpoint                     | Description                                        |
| :----- | :--------------------------- | :------------------------------------------------- |
| `POST` | `/ocr/extract`               | Upload a single document image → extract 27 fields |
| `POST` | `/ocr/extract-multiple`      | Upload up to 5 images → merged extraction          |
| `POST` | `/predictions/from-features` | Submit feature payload → XGBoost prediction        |
| `GET`  | `/explain/{prediction_id}`   | SHAP feature importances + LLM explanation         |
| `POST` | `/forms`                     | Create / update form submission                    |
| `GET`  | `/forms/{id}`                | Retrieve saved form data                           |

<details>
<summary><b>📨 Example — Prediction Request</b></summary>

```http
POST /api/v1/predictions/from-features
Content-Type: application/json
```

```json
{
  "Region_Code": "R-105",
  "Broker_ID": "BRK-4421",
  "Broker_Agency_Type": "Medium",
  "Employer_ID": "EMP-8832",
  "Estimated_Annual_Income": 65000,
  "Employment_Status": "Employed",
  "Adult_Dependents": 2,
  "Child_Dependents": 1,
  "Infant_Dependents": 0,
  "Previous_Policy_Duration_Months": 36,
  "Previous_Claims_Filed": 1,
  "Years_Without_Claims": 4,
  "Deductible_Tier": "Medium",
  "Vehicles_on_Policy": 2,
  "Custom_Riders_Requested": 1,
  "Acquisition_Channel": "Online",
  "Payment_Schedule": "Monthly",
  "Days_Since_Quote": 12,
  "Underwriting_Processing_Days": 5,
  "Policy_Start_Month": "March",
  "Policy_Cancelled_Post_Purchase": 0,
  "Policy_Start_Year": 2026,
  "Policy_Start_Week": 10,
  "Policy_Start_Day": 15,
  "Grace_Period_Extensions": 0,
  "Existing_Policyholder": 1,
  "Policy_Amendments_Count": 2
}
```

</details>

<details>
<summary><b>📬 Example — Prediction Response</b></summary>

```json
{
  "id": "a1b2c3d4-...",
  "form_id": "f5e6d7c8-...",
  "model_version": "xgb-v2.1",
  "result": {
    "predicted_bundle": 3,
    "probabilities": [
      0.02, 0.01, 0.05, 0.82, 0.03, 0.01, 0.01, 0.03, 0.01, 0.01
    ]
  },
  "confidence": 0.82,
  "explanation": null,
  "created_at": "2026-02-22T14:30:00Z"
}
```

</details>

<details>
<summary><b>🧠 Example — Explanation Response</b></summary>

```json
{
  "prediction_id": "a1b2c3d4-...",
  "method": "shap",
  "feature_importances": [
    { "feature": "Estimated_Annual_Income", "importance": 0.42 },
    { "feature": "Adult_Dependents", "importance": 0.31 },
    { "feature": "Years_Without_Claims", "importance": 0.22 },
    { "feature": "Vehicles_on_Policy", "importance": -0.15 }
  ],
  "summary": "Your income and family size strongly suggest Family Comprehensive.",
  "llm_explanation": "Based on your 2 adult dependents and 4 claim-free years..."
}
```

</details>
```

---

## 🔧 Services & Ports

```
┌──────────────────────────────────────────────────────────┐
│                     CERTUS Stack                         │
├────────────────┬──────────────────────┬──────────────────┤
│  📱 Frontend   │  ⚙️  Backend (API)    │  🧠 ML Engine    │
│  Expo :8081    │  FastAPI :8000       │  XGBoost in-proc │
│  React Native  │  SQLAlchemy + SQLite │  SHAP + OpenAI   │
│  TypeScript    │  OCR Pipeline        │  Tesseract       │
└────────────────┴──────────────────────┴──────────────────┘
```

| Service    | Stack                      |    Port     | Purpose                                |
| :--------- | :------------------------- | :---------: | :------------------------------------- |
| `frontend` | Expo SDK 54 / React Native |   `8081`    | Mobile app — scanner, form, results    |
| `api`      | FastAPI + Uvicorn          |   `8000`    | REST API, OCR, prediction, explanation |
| `swagger`  | OpenAPI                    | `8000/docs` | Interactive API documentation          |

---

## 🚀 Getting Started

### Prerequisites

| Requirement                                                                                                  | Version             |
| :----------------------------------------------------------------------------------------------------------- | :------------------ |
| ![Docker](https://img.shields.io/badge/Docker-Required-2496ED?style=flat-square&logo=docker&logoColor=white) | 24+ with Compose v2 |
| ![Node](https://img.shields.io/badge/Node.js-18+-339933?style=flat-square&logo=nodedotjs&logoColor=white)    | For frontend dev    |
| ![Python](https://img.shields.io/badge/Python-3.12-3776AB?style=flat-square&logo=python&logoColor=white)     | For backend dev     |

### 1 · Clone

```bash
git clone https://github.com/Ala-ADN/data-dangereuse.git
cd data-dangereuse
```

### 2 · Backend — Docker (recommended)

```bash
cd olea-backend
cp .env.example .env          # add your OPENAI_API_KEY
docker compose up --build      # API on http://localhost:8000
```

### 3 · Frontend — Expo Dev Server

```bash
cd frontend
npm install
npx expo start                 # press w for web, a for Android, i for iOS
```

### 4 · Access

| Interface         | URL                         |
| :---------------- | :-------------------------- |
| 📱 Frontend (web) | http://localhost:8081       |
| ⚙️ API Gateway    | http://localhost:8000       |
| 📖 Swagger Docs   | http://localhost:8000/docs  |
| 🔄 ReDoc          | http://localhost:8000/redoc |

---

## ⚡ OCR Pipeline

The OCR service is a multi-stage pipeline built for messy, real-world insurance documents:

```
📷 Image Upload
      │
      ▼
┌─────────────────────┐
│  Pillow Preprocessor │  Grayscale → contrast → sharpen → threshold
└─────────┬───────────┘
          ▼
┌─────────────────────┐
│  Tesseract OCR      │  Primary engine (fast, CPU-only)
│  ─── fallback ───── │
│  EasyOCR            │  GPU-optional fallback
└─────────┬───────────┘
          ▼
┌─────────────────────┐
│  Field Parser       │  Line splitting → fuzzy alias matching
│  + RapidFuzz        │  27 canonical fields × N aliases each
└─────────┬───────────┘
          ▼
┌─────────────────────┐
│  Type Caster        │  "65,000" → 65000.0  "yes" → True
│  + Validator        │  Categorical fuzzy match to valid values
└─────────┬───────────┘
          ▼
   { fields, confidences, statuses }
```

---

## 📁 Project Structure

```
data-dangereuse/
│
├── 📱 frontend/                      # Expo / React Native app
│   ├── app/
│   │   ├── (tabs)/
│   │   │   ├── index.tsx             # Home → Scanner → Form → Result
│   │   │   └── _layout.tsx           # Tab navigation
│   │   └── _layout.tsx               # Root layout
│   ├── services/
│   │   └── api.ts                    # API client (OCR + Predict + Explain)
│   ├── package.json
│   └── tsconfig.json
│
├── ⚙️ olea-backend/                   # FastAPI monolith
│   ├── app/
│   │   ├── api/routers/
│   │   │   ├── ocr.py                # POST /ocr/extract{-multiple}
│   │   │   ├── predictions.py        # POST /predictions/from-features
│   │   │   ├── explainability.py     # GET  /explain/{id}
│   │   │   └── forms.py              # Form CRUD
│   │   ├── services/
│   │   │   ├── ocr/                  # OCR pipeline
│   │   │   │   ├── field_map.py      #   27 fields × aliases
│   │   │   │   ├── preprocessor.py   #   Image enhancement
│   │   │   │   ├── extractor.py      #   Tesseract / EasyOCR
│   │   │   │   └── field_parser.py   #   Fuzzy matching + casting
│   │   │   ├── prediction_service.py # Feature eng + XGBoost
│   │   │   └── explainability_service.py # SHAP + OpenAI
│   │   ├── schemas/                  # Pydantic models
│   │   ├── models/                   # SQLAlchemy ORM
│   │   ├── db/                       # Async engine + sessions
│   │   └── main.py                   # App factory
│   ├── models/prediction/
│   │   └── model.pkl                 # Serialized XGBoost
│   ├── tests/                        # pytest suite
│   ├── Dockerfile
│   ├── docker-compose.yml
│   └── requirements.txt
│
├── ARCHI.png                         # Architecture diagram
├── user_flow.png                     # User flow diagram
└── README.md
```

---

## 📊 Dataset Features (29 columns)

<details>
<summary>Click to expand full feature reference</summary>

| Column                            | Type        | Description                            |
| --------------------------------- | ----------- | -------------------------------------- |
| `User_ID`                         | string      | Unique customer identifier             |
| `Adult_Dependents`                | int         | Number of adult dependents             |
| `Child_Dependents`                | int         | Number of child dependents             |
| `Infant_Dependents`               | int         | Number of infant dependents            |
| `Estimated_Annual_Income`         | float       | Yearly household income                |
| `Employment_Status`               | categorical | Primary applicant's employment type    |
| `Region_Code`                     | categorical | Anonymized geographic region           |
| `Existing_Policyholder`           | bool        | Has active policy with company         |
| `Previous_Claims_Filed`           | int         | Total prior claims                     |
| `Years_Without_Claims`            | int         | Consecutive claim-free years           |
| `Previous_Policy_Duration_Months` | int         | Duration of prior policy               |
| `Policy_Cancelled_Post_Purchase`  | bool        | History of post-purchase cancellations |
| `Deductible_Tier`                 | categorical | Out-of-pocket deductible level         |
| `Payment_Schedule`                | categorical | Premium payment frequency              |
| `Vehicles_on_Policy`              | int         | Number of vehicles covered             |
| `Custom_Riders_Requested`         | int         | Special add-ons requested              |
| `Grace_Period_Extensions`         | int         | Payment deadline extensions used       |
| `Days_Since_Quote`                | int         | Days from quote to finalization        |
| `Underwriting_Processing_Days`    | int         | Underwriting approval duration         |
| `Policy_Amendments_Count`         | int         | Quote modifications before signing     |
| `Acquisition_Channel`             | categorical | How the policy was sold                |
| `Broker_Agency_Type`              | categorical | Scale of brokerage firm                |
| `Broker_ID`                       | categorical | Sales agent identifier                 |
| `Employer_ID`                     | categorical | Customer's employer identifier         |
| `Policy_Start_Year`               | int         | Coverage start year                    |
| `Policy_Start_Month`              | int         | Coverage start month                   |
| `Policy_Start_Week`               | int         | Coverage start week of year            |
| `Policy_Start_Day`                | int         | Coverage start day of month            |

</details>

---

## 📜 License

MIT License — see [LICENSE](LICENSE) for details.

---

<div align="center">

### Built with 💔 and dangerous amounts of ☕ by

# Team CrèmeTartinéeDangereuse

[![GitHub](https://img.shields.io/badge/GitHub-Ala--ADN%2Fdata--dangereuse-181717?style=for-the-badge&logo=github)](https://github.com/Ala-ADN/data-dangereuse)

`DataQuest Hackathon 2026`

<sub>🛡️ CERTUS — because choosing insurance shouldn't require one.</sub>

</div>
