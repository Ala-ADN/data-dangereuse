from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.form import Form
from app.schemas.form import FormCreate, FormUpdate


async def create_form(db: AsyncSession, payload: FormCreate) -> Form:
    form = Form(form_type=payload.form_type, data=payload.data)
    db.add(form)
    await db.commit()
    await db.refresh(form)
    return form


async def get_form(db: AsyncSession, form_id: UUID) -> Form | None:
    return await db.get(Form, form_id)


async def list_forms(db: AsyncSession, skip: int = 0, limit: int = 50) -> list[Form]:
    result = await db.execute(select(Form).offset(skip).limit(limit).order_by(Form.created_at.desc()))
    return list(result.scalars().all())


async def update_form(db: AsyncSession, form_id: UUID, payload: FormUpdate) -> Form | None:
    form = await db.get(Form, form_id)
    if not form:
        return None
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(form, field, value)
    await db.commit()
    await db.refresh(form)
    return form


async def delete_form(db: AsyncSession, form_id: UUID) -> bool:
    form = await db.get(Form, form_id)
    if not form:
        return False
    await db.delete(form)
    await db.commit()
    return True
