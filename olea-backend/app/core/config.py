from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    APP_NAME: str = "Olea Insurance API"
    APP_VERSION: str = "0.1.0"
    DEBUG: bool = False

    DATABASE_URL: str = "sqlite+aiosqlite:///./olea.db"

    OCR_MODEL_PATH: str = "/models/ocr"
    PREDICTION_MODEL_PATH: str = "/models/prediction"

    CORS_ORIGINS: list[str] = ["*"]

    class Config:
        env_file = ".env"


settings = Settings()
