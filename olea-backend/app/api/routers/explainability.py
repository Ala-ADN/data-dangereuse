from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.schemas.explainability import ExplainabilityResponse
from app.services import explainability_service

router = APIRouter(prefix="/explain", tags=["explainability"])


@router.get("/{prediction_id}", response_model=ExplainabilityResponse)
async def get_explanation(prediction_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await explainability_service.get_explanation(db, prediction_id)
    if not result:
        raise HTTPException(status_code=404, detail="Prediction not found")
    return result
