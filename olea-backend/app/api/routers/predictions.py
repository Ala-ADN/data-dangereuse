from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.schemas.prediction import PredictionRequest, PredictionFromFeaturesRequest, PredictionResponse
from app.services import form_service, prediction_service

router = APIRouter(prefix="/predictions", tags=["predictions"])


@router.post("/", response_model=PredictionResponse, status_code=201)
async def create_prediction(payload: PredictionRequest, db: AsyncSession = Depends(get_db)):
    """Run prediction on an existing form's data."""
    form = await form_service.get_form(db, payload.form_id)
    if not form:
        raise HTTPException(status_code=404, detail="Form not found")
    return await prediction_service.run_prediction(db, form.id, form.data)


@router.post("/from-features", response_model=PredictionResponse, status_code=201)
async def predict_from_features(payload: PredictionFromFeaturesRequest, db: AsyncSession = Depends(get_db)):
    """Run prediction directly from features sent by the frontend.

    Creates a form record automatically, then runs prediction + explainability.
    """
    from app.schemas.form import FormCreate

    features = payload.model_dump()
    form = await form_service.create_form(db, FormCreate(form_type="insurance_application", data=features))
    return await prediction_service.run_prediction(db, form.id, features)


@router.get("/{prediction_id}", response_model=PredictionResponse)
async def get_prediction(prediction_id: UUID, db: AsyncSession = Depends(get_db)):
    prediction = await prediction_service.get_prediction(db, prediction_id)
    if not prediction:
        raise HTTPException(status_code=404, detail="Prediction not found")
    return prediction
