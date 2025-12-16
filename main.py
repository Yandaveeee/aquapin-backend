from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.db.connection import engine, Base, get_db

# 1. IMPORT ALL MODELS (Required so SQLAlchemy knows they exist)
from app.models.pond import Pond
from app.models.stocking import StockingLog
from app.models.harvest import HarvestLog
from app.models.mortality import MortalityLog

# 2. IMPORT ALL API ROUTERS
from app.api import ponds, stocking, harvest, predictions, analytics, chat, mortality 

app = FastAPI(title="AquaPin API", version="1.0.0")

# 3. ENABLE CORS (Mobile Access)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows ALL origins
    allow_credentials=True,
    allow_methods=["*"],  # Allows all methods (GET, POST, etc.)
    allow_headers=["*"],  # Allows all headers
)

# 4. CRITICAL: Enable PostGIS Extension BEFORE creating tables
try:
    with engine.connect() as connection:
        connection.execute(text("CREATE EXTENSION IF NOT EXISTS postgis"))
        connection.commit()
        print("✅ PostGIS Extension enabled successfully!")
except Exception as e:
    print(f"⚠️ Could not enable PostGIS: {e}")

# 5. CREATE TABLES (Now safe to run)
Base.metadata.create_all(bind=engine)

@app.get("/")
def read_root():
    return {"message": "AquaPin System is Online 🚀"}

@app.get("/test-db")
def test_db_connection(db: Session = Depends(get_db)):
    try:
        # Simple query to verify PostGIS is working
        result = db.execute(text("SELECT postgis_full_version()"))
        return {"status": "success", "postgis_version": result.scalar()}
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