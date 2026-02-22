from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.schemas.explainability import ExplainabilityRequest, ExplainabilityResponse
from app.services import prediction_service, explainability_service, form_service

router = APIRouter(prefix="/explain", tags=["explainability"])


@router.post("/", response_model=ExplainabilityResponse)
async def explain(payload: ExplainabilityRequest, db: AsyncSession = Depends(get_db)):
    prediction = await prediction_service.get_prediction(db, payload.prediction_id)
    if not prediction:
        raise HTTPException(status_code=404, detail="Prediction not found")

    form = await form_service.get_form(db, prediction.form_id)
    form_data = form.data if form else None

    result = await explainability_service.explain_prediction(
        prediction.id, prediction.result, form_data=form_data,
    )
    return result
