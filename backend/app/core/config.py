import json
from pathlib import Path
from typing import Annotated

from pydantic import field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Coffee Gosen API"
    database_url: str = "postgresql+psycopg://coffee:coffee@localhost:5432/coffee_gosen"
    secret_key: str = "change-me-in-local-env"
    access_token_expire_minutes: int = 180
    cors_origins: Annotated[list[str], NoDecode] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "https://frontend-jade-phi-5kpqyple00.vercel.app",
    ]
    environment: str = "development"
    allow_demo_access: bool = False
    aseo_pin: str = "2468"
    imagekit_private_key: str | None = None
    imagekit_public_key: str | None = None
    imagekit_url_endpoint: str | None = None
    imagekit_folder: str = "/coffee-gosen/products"

    model_config = SettingsConfigDict(
        env_file=Path(__file__).resolve().parents[2] / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @field_validator("cors_origins", mode="before")
    @classmethod
    def parse_cors_origins(cls, value: object) -> list[str]:
        if isinstance(value, list):
            return [str(origin).strip() for origin in value if str(origin).strip()]
        if not isinstance(value, str):
            return []
        raw_value = value.strip()
        if not raw_value:
            return []
        try:
            parsed = json.loads(raw_value)
            if isinstance(parsed, list):
                return [str(origin).strip() for origin in parsed if str(origin).strip()]
        except json.JSONDecodeError:
            pass
        return [origin.strip() for origin in raw_value.split(",") if origin.strip()]

    @property
    def sqlalchemy_database_url(self) -> str:
        if self.database_url.startswith("postgresql://"):
            return self.database_url.replace("postgresql://", "postgresql+psycopg://", 1)
        return self.database_url


settings = Settings()