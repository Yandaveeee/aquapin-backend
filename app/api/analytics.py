from fastapi import APIRouter, Depends, Header
from sqlalchemy.orm import Session
from sqlalchemy import func, extract
from app.db.connection import get_db
from app.models.pond import Pond
from app.models.stocking import StockingLog
from app.models.harvest import HarvestLog
from app.models.mortality import MortalityLog

router = APIRouter()

@router.get("/summary")
def get_analytics(
    db: Session = Depends(get_db),
    x_user_id: str = Header(...) # Security: Filter by user
):
    # 1. Get User's Ponds
    user_ponds = db.query(Pond).filter(Pond.owner_id == x_user_id).all()
    pond_ids = [p.id for p in user_ponds]
    
    # Defaults if no data
    empty_stats = {
        "total_revenue": 0, "total_kg": 0, 
        "total_loss_qty": 0, "total_loss_kg": 0,
        "yearly_chart": {"labels": [], "data": []}, 
        "system_recommendation": "No data available."
    }

    if not pond_ids:
        return empty_stats

    # Get stockings to link everything together
    stockings = db.query(StockingLog).filter(StockingLog.pond_id.in_(pond_ids)).all()
    stocking_ids = [s.id for s in stockings]

    if not stocking_ids:
         return empty_stats

    # 2. CALCULATE METRICS
    
    # Revenue & Harvest Weight
    harvest_stats = db.query(
        func.sum(HarvestLog.total_weight_kg * HarvestLog.market_price_per_kg).label('revenue'),
        func.sum(HarvestLog.total_weight_kg).label('kg')
    ).filter(HarvestLog.stocking_id.in_(stocking_ids)).first()

    # Mortality Stats (The missing piece!)
    mortality_stats = db.query(
        func.sum(MortalityLog.quantity_lost).label('qty'),
        func.sum(MortalityLog.weight_lost_kg).label('kg')
    ).filter(MortalityLog.stocking_id.in_(stocking_ids)).first()

    # 3. YEARLY CHART DATA
    yearly_data = db.query(
        extract('year', HarvestLog.harvest_date).label('year'),
        func.sum(HarvestLog.total_weight_kg).label('total_kg')
    ).filter(HarvestLog.stocking_id.in_(stocking_ids))\
     .group_by('year').all()

    years = [str(int(row.year)) for row in yearly_data]
    weights = [row.total_kg for row in yearly_data]

    # 4. RECOMMENDATION SYSTEM
    common_cause = db.query(
        MortalityLog.cause, func.count(MortalityLog.cause)
    ).filter(MortalityLog.stocking_id.in_(stocking_ids))\
     .group_by(MortalityLog.cause).order_by(func.count(MortalityLog.cause).desc()).first()

    recommendation = "Operations are healthy."
    if common_cause:
        cause_name = common_cause[0]
        if cause_name == "Flood": recommendation = "Priority: Upgrade dike infrastructure."
        elif cause_name == "Disease": recommendation = "Priority: Review water quality protocol."
        elif cause_name == "Heat": recommendation = "Priority: Increase water depth."
        elif cause_name == "Theft": recommendation = "Priority: Install security lighting."

    # 5. RETURN EXACT KEYS FOR YOUR FRONTEND
    return {
        "total_revenue": harvest_stats.revenue or 0.0,
        "total_kg": harvest_stats.kg or 0.0,            # <--- Renamed to match frontend
        "total_loss_qty": mortality_stats.qty or 0,     # <--- Added back
        "total_loss_kg": mortality_stats.kg or 0.0,     # <--- Added back
        "yearly_chart": {
            "labels": years,
            "data": weights
        },
        "system_recommendation": recommendation
    }