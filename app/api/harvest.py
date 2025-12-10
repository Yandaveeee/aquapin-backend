from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db.connection import get_db
# CRITICAL FIX: Import the model, do not define it here!
from app.models.harvest import HarvestLog 
from app.models.stocking import StockingLog
from app.schemas.harvest import HarvestCreate, HarvestResponse

router = APIRouter()

@router.post("/", response_model=HarvestResponse)
def create_harvest_log(log: HarvestCreate, db: Session = Depends(get_db)):
    # 1. Get the original stocking info to calculate dates
    stocking = db.query(StockingLog).filter(StockingLog.id == log.stocking_id).first()
    if not stocking:
        raise HTTPException(status_code=404, detail="Stocking ID not found")

    # 2. Calculate Days Cultured
    days_diff = (log.harvest_date - stocking.stocking_date).days
    
    if days_diff < 0:
        raise HTTPException(status_code=400, detail="Harvest date cannot be before stocking date!")

    # 3. Calculate Revenue
    revenue = log.total_weight_kg * log.market_price_per_kg

    # 4. Save
    new_harvest = HarvestLog(
        stocking_id=log.stocking_id,
        harvest_date=log.harvest_date,
        total_weight_kg=log.total_weight_kg,
        market_price_per_kg=log.market_price_per_kg,
        revenue=revenue,
        days_cultured=days_diff,
        fish_size=log.fish_size # Save the new size
    )
    
    db.add(new_harvest)
    db.commit()
    db.refresh(new_harvest)
    
    return new_harvest