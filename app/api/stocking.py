from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.orm import Session
from typing import List
from app.db.connection import get_db
from app.models.stocking import StockingLog
from app.models.harvest import HarvestLog
from app.models.pond import Pond 
from app.schemas.stocking import StockingCreate, StockingResponse

router = APIRouter()

# --- GET ACTIVE STOCKINGS (Fixed for Loss Report) ---
@router.get("/active")
def get_active_stockings(
    db: Session = Depends(get_db),
    x_user_id: str = Header(...) 
):
    try:
        # 1. Get ONLY this user's ponds
        user_ponds = db.query(Pond).filter(Pond.owner_id == x_user_id).all()
        user_pond_ids = [p.id for p in user_ponds]

        if not user_pond_ids:
            return []

        # 2. Find harvested IDs
        harvested_ids = db.query(HarvestLog.stocking_id).all()
        harvested_ids = [h[0] for h in harvested_ids]

        # 3. Filter Stockings
        query = db.query(StockingLog).filter(StockingLog.pond_id.in_(user_pond_ids))
        if harvested_ids:
            query = query.filter(StockingLog.id.notin_(harvested_ids))
            
        active_stockings = query.all()
        
        # 4. Build Response
        results = []
        for stock in active_stockings:
            pond = next((p for p in user_ponds if p.id == stock.pond_id), None)
            pond_name = pond.name if pond else f"Pond {stock.pond_id}"
            
            results.append({
                "id": stock.id,
                "pond_id": stock.pond_id,  # <--- Fixes the Frontend Filter
                "label": f"{pond_name} - {stock.fry_type} ({stock.fry_quantity}pcs)",
                "date": stock.stocking_date,
                "fry_type": stock.fry_type,
                "fry_quantity": stock.fry_quantity
            })
        
        return results

    except Exception as e:
        print(f"❌ STOCKING ERROR: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# --- CREATE STOCKING (Fixed: Removed invalid DB write) ---
@router.post("/", response_model=StockingResponse)
def create_stocking_log(
    log: StockingCreate, 
    db: Session = Depends(get_db),
    x_user_id: str = Header(...) 
):
    try:
        pond = db.query(Pond).filter(Pond.id == log.pond_id, Pond.owner_id == x_user_id).first()
        if not pond:
             raise HTTPException(status_code=404, detail="Pond not found or access denied")

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
        
    except HTTPException as he:
        raise he
    except Exception as e:
        print(f"❌ CREATE ERROR: {e}")
        raise HTTPException(status_code=500, detail="Could not save stocking log")