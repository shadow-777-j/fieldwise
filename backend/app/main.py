from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api import analytics, farms, observations, system
from app.config.settings import get_settings
from app.database.init_db import init_db

settings = get_settings()


@asynccontextmanager
async def lifespan(_app: FastAPI):
    init_db()
    yield


app = FastAPI(
    title="FIELDWISE AI API",
    description="Satellite Intelligence for Resilient Farming — NASA Space Apps 2026 (Field Shift)",
    version=settings.app_version,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        *settings.cors_origin_list,
        "https://fieldwise.joelantony869.workers.dev",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(system.router)
app.include_router(farms.router)
app.include_router(observations.router)
app.include_router(analytics.router)

