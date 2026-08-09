from datetime import UTC, datetime
from typing import Literal

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from apps.api.routers import proctoring
from apps.api.routers import interviews
from apps.api.routers import audit
from apps.api.routers import admin


class HealthResponse(BaseModel):
    status: Literal["ok"]
    service: str
    version: str
    timestamp: datetime


class ReadinessResponse(BaseModel):
    status: Literal["ready"]
    dependencies: dict[str, Literal["configured"]]


app = FastAPI(
    title="CoreLink API",
    description="CoreLink AI Interview Platform service boundary.",
    version="0.1.0",
    root_path="/api",
    docs_url="/docs",
    redoc_url=None,
)

# Include routers
app.include_router(proctoring.router, prefix="/proctoring", tags=["proctoring"])
app.include_router(interviews.router, prefix="/interviews", tags=["interviews"])
app.include_router(audit.router, prefix="/audit", tags=["audit"])
app.include_router(admin.router, prefix="/admin", tags=["admin"])

app.add_middleware(
    CORSMiddleware,
    allow_origins=[],
    allow_credentials=False,
    allow_methods=["GET"],
    allow_headers=["Accept", "Content-Type"],
)


@app.get("/health", response_model=HealthResponse, tags=["system"])
async def health() -> HealthResponse:
    return HealthResponse(
        status="ok",
        service="corelink-api",
        version=app.version,
        timestamp=datetime.now(UTC),
    )


@app.get("/ready", response_model=ReadinessResponse, tags=["system"])
async def readiness() -> ReadinessResponse:
    # Step 1 verifies configuration only. Active dependency probes arrive with
    # the persistence and queue features that consume these services.
    return ReadinessResponse(
        status="ready",
        dependencies={
            "postgres": "configured",
            "redis": "configured",
            "object_storage": "configured",
        },
    )
