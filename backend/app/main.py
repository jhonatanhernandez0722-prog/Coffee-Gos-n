from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from pathlib import Path
import os
from sqlalchemy.exc import SQLAlchemyError

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
    allow_origin_regex=settings.cors_origin_regex,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix="/api/v1")


@app.exception_handler(SQLAlchemyError)
async def database_error_handler(_: Request, __: SQLAlchemyError) -> JSONResponse:
    return JSONResponse(status_code=500, content={"detail": "La base de datos no pudo completar la operación."})


@app.exception_handler(Exception)
async def unexpected_error_handler(_: Request, __: Exception) -> JSONResponse:
    return JSONResponse(status_code=500, content={"detail": "El servidor no pudo completar la operación."})


@app.get("/", tags=["health"])
def root_health() -> dict[str, str]:
    return {"status": "ok", "service": "coffee-gosen-api"}