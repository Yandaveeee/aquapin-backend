from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.db.connection import get_db
from app.models.stocking import StockingLog
from app.models.harvest import HarvestLog
from app.models.pond import Pond 
from app.schemas.stocking import StockingCreate, StockingResponse

router = APIRouter()

# --- GET ACTIVE STOCKINGS (The one causing the error) ---
@router.get("/active")
def get_active_stockings(db: Session = Depends(get_db)):
    try:
        # 1. Find which stockings are already harvested
        harvested_ids = db.query(HarvestLog.stocking_id).all()
        # Convert list of tuples [(1,), (2,)] -> [1, 2]
        harvested_ids = [h[0] for h in harvested_ids]

        # 2. Find stockings NOT in that list
        if harvested_ids:
            active_stockings = db.query(StockingLog).filter(StockingLog.id.notin_(harvested_ids)).all()
        else:
            active_stockings = db.query(StockingLog).all()
        
        results = []
        for stock in active_stockings:
            # Get Pond Name safely
            pond = db.query(Pond).filter(Pond.id == stock.pond_id).first()
            pond_name = pond.name if pond else f"Pond {stock.pond_id}"
            
            results.append({
                "id": stock.id,
                "label": f"{pond_name} - {stock.fry_type} ({stock.fry_quantity}pcs)",
                "date": stock.stocking_date
            })
        
        return results

    except Exception as e:
        print(f"❌ STOCKING ERROR: {e}") # Look at your terminal for this!
        raise HTTPException(status_code=500, detail=str(e))

# --- CREATE STOCKING ---
@router.post("/", response_model=StockingResponse)
def create_stocking_log(log: StockingCreate, db: Session = Depends(get_db)):
    try:
        new_log = StockingLog(
            pond_id=log.pond_id,
            stocking_date=log.stocking_date,
            fry_type=log.fry_type,
            fry_quantity=log.fry_quantity
        )
        
        db.add(new_log)
        db.commit()
        db.refresh(new_log)
        return new_log
        
    except Exception as e:
        print(f"❌ CREATE ERROR: {e}")
        raise HTTPException(status_code=500, detail="Could not save stocking log")