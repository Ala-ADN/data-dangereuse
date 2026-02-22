from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.db.base import Base
from app.db.session import engine
from app.api.routers import forms, predictions, ocr, explainability, users
from app.services import cache_service, mlflow_service


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    await cache_service.init_cache()
    mlflow_service.init_mlflow()
    yield
    # Shutdown
    await cache_service.close_cache()
    await engine.dispose()


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(forms.router, prefix="/api/v1")
app.include_router(predictions.router, prefix="/api/v1")
app.include_router(ocr.router, prefix="/api/v1")
app.include_router(explainability.router, prefix="/api/v1")
app.include_router(users.router, prefix="/api/v1")


@app.get("/health")
async def health():
    cache_stats = await cache_service.get_cache_stats()
    mlflow_status = mlflow_service.get_mlflow_status()
    return {
        "status": "ok",
        "cache": cache_stats,
        "mlflow": mlflow_status,
    }
