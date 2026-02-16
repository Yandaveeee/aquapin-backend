import logging
from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.orm import Session
from app.db.connection import get_db
from app.models.harvest import HarvestLog
from app.models.stocking import StockingLog
from app.models.pond import Pond
from app.schemas.harvest import HarvestCreate, HarvestResponse
from app.security import validate_user_id, verify_stocking_ownership

logger = logging.getLogger("aquapin")
router = APIRouter()

@router.post("/", response_model=HarvestResponse)
def create_harvest_log(
    log: HarvestCreate,
    db: Session = Depends(get_db),
    x_user_id: str = Depends(validate_user_id)  # SECURITY: Validates UUID format
):
    # 1. SECURITY: Verify this stocking belongs to the user's pond (IDOR fix)
    stocking = verify_stocking_ownership(log.stocking_id, x_user_id, db)

    # 2. Calculate Days Cultured
    days_diff = (log.harvest_date - stocking.stocking_date).days
    
    if days_diff < 0:
        raise HTTPException(status_code=400, detail="Harvest date cannot be before stocking date!")

    # 3. Calculate Revenue
    revenue = log.total_weight_kg * log.market_price_per_kg

    # 4. Save
    try:
        new_harvest = HarvestLog(
            stocking_id=log.stocking_id,
            harvest_date=log.harvest_date,
            total_weight_kg=log.total_weight_kg,
            market_price_per_kg=log.market_price_per_kg,
            revenue=revenue,
            days_cultured=days_diff,
            fish_size=log.fish_size
        )
        
        db.add(new_harvest)
        db.commit()
        db.refresh(new_harvest)
        
        return new_harvest

    except Exception as e:
        logger.error(f"Harvest creation failed for user {x_user_id}: {e}")
        raise HTTPException(status_code=500, detail="Could not save harvest log")