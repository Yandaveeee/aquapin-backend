from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import text

from app.db.connection import engine, Base, get_db

# 1. IMPORT ALL MODELS
from app.models.pond import Pond
from app.models.stocking import StockingLog
from app.models.harvest import HarvestLog
from app.models.mortality import MortalityLog # <--- Ensure this is here

# 2. IMPORT ALL API ROUTERS
from app.api import ponds, stocking, harvest, predictions, analytics, chat, mortality # <--- Ensure mortality is here

# Create Tables
Base.metadata.create_all(bind=engine)

app = FastAPI(title="AquaPin API", version="1.0.0")

# Enable Web/Mobile Access
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def read_root():
    return {"message": "AquaPin System is Online 🚀"}

@app.get("/test-db")
def test_db_connection(db: Session = Depends(get_db)):
    try:
        result = db.execute(text("SELECT postgis_full_version()"))
        return {"status": "success", "postgis_version": result.scalar()}
    except Exception as e:
        return {"status": "error", "message": str(e)}

# 3. REGISTER ROUTERS (This creates the URLs)
app.include_router(ponds.router, prefix="/api/ponds", tags=["Ponds"])
app.include_router(stocking.router, prefix="/api/stocking", tags=["Stocking"])
app.include_router(harvest.router, prefix="/api/harvest", tags=["Harvest"])
app.include_router(predictions.router, prefix="/api/predict", tags=["AI Prediction"])
app.include_router(analytics.router, prefix="/api/analytics", tags=["Analytics"])
app.include_router(chat.router, prefix="/api/chat", tags=["AI Chat"])

# --- THIS WAS LIKELY MISSING OR NOT SAVED ---
app.include_router(mortality.router, prefix="/api/mortality", tags=["Mortality"])