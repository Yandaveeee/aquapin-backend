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
    x_user_id: str = Header(...) # <--- 1. SECURITY: Require User ID
):
    # --- STEP 1: FILTER BY USER ---
    user_ponds = db.query(Pond).filter(Pond.owner_id == x_user_id).all()
    pond_ids = [p.id for p in user_ponds]
    
    if not pond_ids:
        return {
            "total_ponds": 0, "total_revenue": 0, "total_harvested_kg": 0, "survival_rate": 0, 
            "yearly_chart": {"labels": [], "data": []}, "system_recommendation": "No data yet."
        }

    # Get all stockings for this user
    stockings = db.query(StockingLog).filter(StockingLog.pond_id.in_(pond_ids)).all()
    stocking_ids = [s.id for s in stockings]

    if not stocking_ids:
         return {
            "total_ponds": len(user_ponds), "total_revenue": 0, "total_harvested_kg": 0, "survival_rate": 0,
            "yearly_chart": {"labels": [], "data": []}, "system_recommendation": "Start stocking to see insights."
        }

    # --- STEP 2: CALCULATE BASIC STATS (Securely) ---
    
    # Revenue & Weight (Join with StockingLog to filter by user)
    # We calculate revenue manually (weight * price) to be safe if 'revenue' column is missing
    harvest_stats = db.query(
        func.sum(HarvestLog.total_weight_kg * HarvestLog.market_price_per_kg).label('revenue'),
        func.sum(HarvestLog.total_weight_kg).label('kg')
    ).filter(HarvestLog.stocking_id.in_(stocking_ids)).first()

    total_revenue = harvest_stats.revenue or 0.0
    total_harvested_kg = harvest_stats.kg or 0.0

    # Survival Rate
    total_stocked = db.query(func.sum(StockingLog.fry_quantity)).filter(StockingLog.id.in_(stocking_ids)).scalar() or 0
    total_dead = db.query(func.sum(MortalityLog.quantity_lost)).filter(MortalityLog.stocking_id.in_(stocking_ids)).scalar() or 0
    
    survival_rate = 0.0
    if total_stocked > 0:
        survival_rate = ((total_stocked - total_dead) / total_stocked) * 100

    # --- STEP 3: ADVANCED FEATURES (From your code) ---

    # Yearly Chart Data (Filtered by User)
    yearly_data = db.query(
        extract('year', HarvestLog.harvest_date).label('year'),
        func.sum(HarvestLog.total_weight_kg).label('total_kg')
    ).filter(HarvestLog.stocking_id.in_(stocking_ids))\
     .group_by('year').all()

    years = [str(int(row.year)) for row in yearly_data]
    weights = [row.total_kg for row in yearly_data]

    # AI Recommendation (Disaster Analysis)
    common_cause = db.query(
        MortalityLog.cause, func.count(MortalityLog.cause)
    ).filter(MortalityLog.stocking_id.in_(stocking_ids))\
     .group_by(MortalityLog.cause).order_by(func.count(MortalityLog.cause).desc()).first()

    recommendation = "Operations are normal."
    if common_cause:
        cause_name = common_cause[0]
        if cause_name == "Flood": recommendation = "Priority: Upgrade dike infrastructure to prevent flood loss."
        elif cause_name == "Disease": recommendation = "Priority: Review water quality protocol immediately."
        elif cause_name == "Heat": recommendation = "Priority: Deepen ponds to stabilize temperature."
        elif cause_name == "Theft": recommendation = "Priority: Increase security or install lighting."

    # --- STEP 4: RETURN MATCHING JSON ---
    return {
        "total_ponds": len(user_ponds),
        "total_revenue": round(total_revenue, 2),
        "total_harvested_kg": round(total_harvested_kg, 2), # <--- Matches Frontend
        "survival_rate": round(survival_rate, 1),
        "yearly_chart": {
            "labels": years,
            "data": weights
        },
        "system_recommendation": recommendation
    }