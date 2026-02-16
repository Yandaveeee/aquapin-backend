import logging
from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.orm import Session
from app.db.connection import get_db
from app.models.mortality import MortalityLog
from app.schemas.mortality import MortalityCreate, MortalityResponse
from app.security import validate_user_id, verify_stocking_ownership

logger = logging.getLogger("aquapin")
router = APIRouter()

# KNOWLEDGE BASE FOR RECOMMENDATIONS
SOLUTIONS = {
    "Flood": "Recommendation: Install overflow pipes and raise dike height by 1 meter before rainy season.",
    "Disease": "Recommendation: Isolate pond immediately. Reduce feeding and apply salt/probiotics. Check water pH.",
    "Heat": "Recommendation: Increase water depth to 1.5m to keep bottom cool. Run aerators at noon.",
    "Theft": "Recommendation: Install motion-sensor lights or fencing around the perimeter.",
    "Unknown": "Recommendation: Monitor water parameters daily to identify the root cause."
}

# Allowed cause values to prevent arbitrary input
ALLOWED_CAUSES = {"Flood", "Disease", "Heat", "Theft", "Unknown"}

@router.post("/", response_model=MortalityResponse)
def report_loss(
    log: MortalityCreate,
    db: Session = Depends(get_db),
    x_user_id: str = Depends(validate_user_id)  # SECURITY: Validates UUID format
):
    # 1. SECURITY: Verify this stocking belongs to the user's pond (IDOR fix)
    verify_stocking_ownership(log.stocking_id, x_user_id, db)

    # 2. Validate cause value
    if log.cause not in ALLOWED_CAUSES:
        raise HTTPException(status_code=400, detail=f"Invalid cause. Must be one of: {', '.join(ALLOWED_CAUSES)}")

    # 3. Save the Loss
    try:
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

        # 4. Generate Intelligent Solution
        suggestion = SOLUTIONS.get(log.cause, SOLUTIONS["Unknown"])

        return {
            "id": new_loss.id,
            "cause": new_loss.cause,
            "solution": suggestion
        }

    except Exception as e:
        logger.error(f"Mortality report failed for user {x_user_id}: {e}")
        raise HTTPException(status_code=500, detail="Could not save loss report")