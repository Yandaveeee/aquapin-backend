from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func, extract
from app.db.connection import get_db
from app.models.harvest import HarvestLog
from app.models.mortality import MortalityLog

router = APIRouter()

@router.get("/summary")
def get_analytics(db: Session = Depends(get_db)):
    # 1. Basic Stats
    total_revenue = db.query(func.sum(HarvestLog.revenue)).scalar() or 0.0
    total_kg = db.query(func.sum(HarvestLog.total_weight_kg)).scalar() or 0.0
    
    # 2. Total Losses (The Professor's Request)
    total_loss_qty = db.query(func.sum(MortalityLog.quantity_lost)).scalar() or 0
    total_loss_kg = db.query(func.sum(MortalityLog.weight_lost_kg)).scalar() or 0.0

    # 3. Yearly Harvest Data
    # Query: SELECT year, SUM(weight) FROM harvest GROUP BY year
    yearly_data = db.query(
        extract('year', HarvestLog.harvest_date).label('year'),
        func.sum(HarvestLog.total_weight_kg).label('total_kg')
    ).group_by('year').all()

    # Format for Chart
    years = [str(int(row.year)) for row in yearly_data]
    weights = [row.total_kg for row in yearly_data]

    # 4. Disaster Analysis (Most common cause)
    common_cause = db.query(
        MortalityLog.cause, func.count(MortalityLog.cause)
    ).group_by(MortalityLog.cause).order_by(func.count(MortalityLog.cause).desc()).first()

    recommendation = "No incidents recorded."
    if common_cause:
        cause_name = common_cause[0]
        # Same logic as mortality.py
        if cause_name == "Flood": recommendation = "Priority: Upgrade dike infrastructure."
        elif cause_name == "Disease": recommendation = "Priority: Review water quality protocol."
        elif cause_name == "Heat": recommendation = "Priority: Deepen ponds."

    return {
        "total_revenue": total_revenue,
        "total_kg": total_kg,
        "total_loss_qty": total_loss_qty,
        "total_loss_kg": total_loss_kg,
        "yearly_chart": {
            "labels": years,
            "data": weights
        },
        "system_recommendation": recommendation
    }