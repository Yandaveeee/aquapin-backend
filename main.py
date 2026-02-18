import os
import logging
from fastapi import FastAPI, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from sqlalchemy import text
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from dotenv import load_dotenv

from app.db.connection import engine, Base, get_db

# 1. IMPORT MODELS
from app import models 

# 2. IMPORT API ROUTERS
from app.api import ponds, stocking, harvest, predictions, analytics, chat, mortality, history, auth

# --- Logging ---
logger = logging.getLogger("aquapin")

# --- Load env ---
load_dotenv()

# --- Rate Limiter ---
limiter = Limiter(key_func=get_remote_address)

app = FastAPI(title="AquaPin API", version="1.0.0")
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# 3. ENABLE CORS (Restricted to known origins)
allowed_origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["*"],
)

# 4. GLOBAL EXCEPTION HANDLER
# Catches unhandled exceptions and returns a safe generic message
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled error on {request.method} {request.url.path}: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": "An internal server error occurred."}
    )

# 5. CREATE TABLES (Resilient)
try:
    Base.metadata.create_all(bind=engine)
    logger.info("Database tables created successfully.")
except Exception as e:
    logger.error(f"CRITICAL: Database connection failed during startup: {e}")
    # We continue startup so the /test-db endpoint can be reached for debugging

@app.get("/")
def read_root():
    return {"message": "AquaPin System is Online 🚀"}

@app.get("/test-db")
def test_db_connection(db: Session = Depends(get_db)):
    try:
        result = db.execute(text("SELECT 1"))
        return {"status": "success", "db_connected": True}
    except Exception as e:
        logger.error(f"Database connection test failed: {e}")
        return {"status": "error", "message": "Database connection failed"}

@app.get("/init-db")
def init_db():
    try:
        Base.metadata.create_all(bind=engine)
        return {"status": "success", "message": "Tables created successfully"}
    except Exception as e:
        return {"status": "error", "message": str(e)}

# 6. REGISTER ROUTERS
app.include_router(ponds.router, prefix="/api/ponds", tags=["Ponds"])
app.include_router(stocking.router, prefix="/api/stocking", tags=["Stocking"])
app.include_router(harvest.router, prefix="/api/harvest", tags=["Harvest"])
app.include_router(predictions.router, prefix="/api/predict", tags=["AI Prediction"])
app.include_router(analytics.router, prefix="/api/analytics", tags=["Analytics"])
app.include_router(chat.router, prefix="/api/chat", tags=["AI Chat"])
app.include_router(mortality.router, prefix="/api/mortality", tags=["Mortality"])
app.include_router(history.router, prefix="/api/history", tags=["History"])
app.include_router(auth.router, prefix="/api/auth", tags=["Authentication"])