from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.db.connection import engine, Base, get_db # <--- Base is imported here

# 1. IMPORT MODELS
# This runs the __init__.py inside models/, which registers the tables to Base
from app import models 

# 2. IMPORT API ROUTERS
from app.api import ponds, stocking, harvest, predictions, analytics, chat, mortality 

app = FastAPI(title="AquaPin API", version="1.0.0")

# 3. ENABLE CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 4. DATABASE RESET (CRITICAL FOR PRIVACY UPDATE)
# ERROR FIX: Use 'Base.metadata', NOT 'models.Base.metadata'

# Uncomment the next line to WIPE the database (Run once, then comment out)
Base.metadata.drop_all(bind=engine)

# 5. CREATE TABLES
# ERROR FIX: Use 'Base.metadata', NOT 'models.Base.metadata'
Base.metadata.create_all(bind=engine)

@app.get("/")
def read_root():
    return {"message": "AquaPin System is Online 🚀"}

@app.get("/test-db")
def test_db_connection(db: Session = Depends(get_db)):
    try:
        result = db.execute(text("SELECT 1"))
        return {"status": "success", "db_connected": True}
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