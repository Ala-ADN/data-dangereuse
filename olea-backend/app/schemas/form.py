from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class FormCreate(BaseModel):
    form_type: str
    data: dict


class FormUpdate(BaseModel):
    form_type: str | None = None
    status: str | None = None
    data: dict | None = None


class FormResponse(BaseModel):
    id: UUID
    form_type: str
    status: str
    data: dict
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
