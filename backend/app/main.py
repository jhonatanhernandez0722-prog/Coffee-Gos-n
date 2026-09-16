from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pathlib import Path
import os

from app.api.v1.router import api_router
from app.core.config import settings

app = FastAPI(
    title="Coffee Gosen API",
    description="API REST para ventas, inventario, clientes y finanzas.",
    version="0.1.0",
)

media_directory = Path("/tmp/coffee-gosen-media") if settings.environment == "production" or os.getenv("VERCEL") else Path(__file__).resolve().parents[1] / "storage"
media_directory.mkdir(parents=True, exist_ok=True)
app.mount("/media", StaticFiles(directory=media_directory), name="media")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix="/api/v1")


@app.get("/", tags=["health"])
def root_health() -> dict[str, str]:
    return {"status": "ok", "service": "coffee-gosen-api"}