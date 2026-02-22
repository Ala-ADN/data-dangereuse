# CERTUS Backend

FastAPI backend serving the insurance recommendation API. Python 3.12, async SQLite, XGBoost inference.

## Services

| Service | Purpose |
|---------|---------|
| user_service | CRUD operations for user accounts |
| form_service | CRUD operations for insurance application forms |
| prediction_service | Runs XGBoost inference on form data and computes feature importance |
| ocr_service | Preprocesses document images, extracts text via Tesseract, parses structured fields |
| explainability_service | Generates plain-English explanations of predictions using OpenAI GPT-4o-mini |

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | /health | Health check |
| POST | /api/v1/users/ | Create user |
| GET | /api/v1/users/ | List users |
| GET | /api/v1/users/{id} | Get user |
| PATCH | /api/v1/users/{id} | Update user |
| DELETE | /api/v1/users/{id} | Delete user |
| POST | /api/v1/forms/ | Create form |
| GET | /api/v1/forms/ | List forms |
| GET | /api/v1/forms/{id} | Get form |
| PATCH | /api/v1/forms/{id} | Update form |
| DELETE | /api/v1/forms/{id} | Delete form |
| POST | /api/v1/predictions/ | Run prediction from existing form |
| POST | /api/v1/predictions/from-features | Run prediction from raw features |
| GET | /api/v1/predictions/{id} | Get prediction |
| POST | /api/v1/ocr/extract | Extract fields from single document |
| POST | /api/v1/ocr/extract-multiple | Extract and merge fields from multiple documents |
| GET | /api/v1/explain/{id} | Get AI explanation for a prediction |

## Run

```bash
# Development
docker compose up

# Production
docker compose -f docker-compose.prod.yml up -d
```

Runs on port 8000. Requires a `.env` file with `OPENAI_API_KEY` for the explainability service.
