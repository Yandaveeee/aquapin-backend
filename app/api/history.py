from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
from datetime import date

from app.db.connection import get_db
from app.models.stocking import StockingLog
from app.models.harvest import HarvestLog
from app.models.pond import Pond

router = APIRouter()

# --- Schema for History Item ---
class HistoryItem(BaseModel):
    stocking_id: int
    fry_type: str
    quantity_stocked: int
    stock_date: date
    harvest_date: date
    total_weight_kg: float
    revenue: float
    fish_size: Optional[str] = "Standard" # <--- NEW FIELD

    class Config:
        from_attributes = True

# --- GET HISTORY FOR A SPECIFIC POND ---
@router.get("/{pond_id}", response_model=List[HistoryItem])
def get_pond_history(
    pond_id: int,
    db: Session = Depends(get_db),
    x_user_id: str = Header(...)
):
    # 1. Verify Pond Ownership
    pond = db.query(Pond).filter(Pond.id == pond_id, Pond.owner_id == x_user_id).first()
    if not pond:
        raise HTTPException(status_code=404, detail="Pond not found")

    # 2. Get all Stocking Logs for this pond
    stocking_logs = db.query(StockingLog).filter(StockingLog.pond_id == pond_id).all()

    history_list = []

    # 3. Find Matches (Stock + Harvest = Closed Cycle)
    for stock in stocking_logs:
        harvest = db.query(HarvestLog).filter(HarvestLog.stocking_id == stock.id).first()

        if harvest:
            calculated_revenue = harvest.total_weight_kg * harvest.market_price_per_kg
            
            history_list.append({
                "stocking_id": stock.id,
                "fry_type": stock.fry_type,
                "quantity_stocked": stock.fry_quantity,
                "stock_date": stock.stocking_date,
                "harvest_date": harvest.harvest_date,
                "total_weight_kg": harvest.total_weight_kg,
                "revenue": calculated_revenue,
                "fish_size": harvest.fish_size # <--- ADDED THIS
            })

    # 4. Sort by newest harvest first
    history_list.sort(key=lambda x: x['harvest_date'], reverse=True)

    return history_list