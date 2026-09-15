from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Coffee Gosen API"
    database_url: str = "postgresql+psycopg://coffee:coffee@localhost:5432/coffee_gosen"
    secret_key: str = "change-me-in-local-env"
    access_token_expire_minutes: int = 30
    cors_origins: list[str] = ["http://localhost:3000", "http://127.0.0.1:3000"]
    environment: str = "development"
    allow_demo_access: bool = False
    aseo_pin: str = "2468"

    model_config = SettingsConfigDict(
        env_file=Path(__file__).resolve().parents[2] / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @property
    def sqlalchemy_database_url(self) -> str:
        if self.database_url.startswith("postgresql://"):
            return self.database_url.replace("postgresql://", "postgresql+psycopg://", 1)
        return self.database_url


settings = Settings()