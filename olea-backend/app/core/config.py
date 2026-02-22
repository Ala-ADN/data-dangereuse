from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    APP_NAME: str = "Olea Insurance API"
    APP_VERSION: str = "0.1.0"
    DEBUG: bool = False

    DATABASE_URL: str = "sqlite+aiosqlite:///./olea.db"

    OCR_MODEL_PATH: str = "/models/ocr"
    PREDICTION_MODEL_PATH: str = "/models/prediction"

    OPENAI_API_KEY: str = ""

    # Redis cache
    REDIS_URL: str = "redis://localhost:6379/0"
    CACHE_TTL: int = 86400  # 24 hours

    # MLflow
    MLFLOW_TRACKING_URI: str = ""

    CORS_ORIGINS: list[str] = ["*"]

    class Config:
        env_file = ".env"


settings = Settings()
