from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db.connection import get_db
from app.models.mortality import MortalityLog
from app.schemas.mortality import MortalityCreate, MortalityResponse

router = APIRouter()

# KNOWLEDGE BASE FOR RECOMMENDATIONS
SOLUTIONS = {
    "Flood": "Recommendation: Install overflow pipes and raise dike height by 1 meter before rainy season.",
    "Disease": "Recommendation: Isolate pond immediately. Reduce feeding and apply salt/probiotics. Check water pH.",
    "Heat": "Recommendation: Increase water depth to 1.5m to keep bottom cool. Run aerators at noon.",
    "Theft": "Recommendation: Install motion-sensor lights or fencing around the perimeter.",
    "Unknown": "Recommendation: Monitor water parameters daily to identify the root cause."
}

@router.post("/", response_model=MortalityResponse)
def report_loss(log: MortalityCreate, db: Session = Depends(get_db)):
    # 1. Save the Loss
    new_loss = MortalityLog(
        stocking_id=log.stocking_id,
        loss_date=log.loss_date,
        quantity_lost=log.quantity_lost,
        weight_lost_kg=log.weight_lost_kg,
        cause=log.cause,
        action_taken=log.action_taken
    )
    db.add(new_loss)
    db.commit()
    db.refresh(new_loss)

    # 2. Generate Intelligent Solution
    suggestion = SOLUTIONS.get(log.cause, SOLUTIONS["Unknown"])

    return {
        "id": new_loss.id,
        "cause": new_loss.cause,
        "solution": suggestion
    }