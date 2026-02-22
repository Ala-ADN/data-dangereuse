from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.schemas.form import FormCreate, FormUpdate, FormResponse
from app.services import form_service

router = APIRouter(prefix="/forms", tags=["forms"])


@router.post("/", response_model=FormResponse, status_code=201)
async def create_form(payload: FormCreate, db: AsyncSession = Depends(get_db)):
    return await form_service.create_form(db, payload)


@router.get("/", response_model=list[FormResponse])
async def list_forms(skip: int = 0, limit: int = 50, db: AsyncSession = Depends(get_db)):
    return await form_service.list_forms(db, skip=skip, limit=limit)


@router.get("/{form_id}", response_model=FormResponse)
async def get_form(form_id: UUID, db: AsyncSession = Depends(get_db)):
    form = await form_service.get_form(db, form_id)
    if not form:
        raise HTTPException(status_code=404, detail="Form not found")
    return form


@router.patch("/{form_id}", response_model=FormResponse)
async def update_form(form_id: UUID, payload: FormUpdate, db: AsyncSession = Depends(get_db)):
    form = await form_service.update_form(db, form_id, payload)
    if not form:
        raise HTTPException(status_code=404, detail="Form not found")
    return form


@router.delete("/{form_id}", status_code=204)
async def delete_form(form_id: UUID, db: AsyncSession = Depends(get_db)):
    deleted = await form_service.delete_form(db, form_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Form not found")
