# backend/app/security.py
"""
Centralized security utilities for the AquaPin API.
- UUID validation for user IDs
- Ownership verification for stocking records
- Structured logging setup
"""

import re
import logging
from fastapi import Header, HTTPException, Depends
from sqlalchemy.orm import Session

from app.db.connection import get_db
from app.models.stocking import StockingLog
from app.models.pond import Pond

# --- Logging Setup ---
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("aquapin")

# UUID v4 regex pattern
UUID_PATTERN = re.compile(
    r'^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
)


def validate_user_id(x_user_id: str = Header(...)) -> str:
    """
    FastAPI dependency that extracts and validates the x-user-id header.
    Ensures the value is a valid UUID v4 format to prevent injection attacks.
    """
    if not x_user_id or not UUID_PATTERN.match(x_user_id):
        raise HTTPException(
            status_code=400,
            detail="Invalid or missing user ID"
        )
    return x_user_id


def verify_stocking_ownership(
    stocking_id: int,
    user_id: str,
    db: Session
) -> StockingLog:
    """
    Verify that a stocking record belongs to a pond owned by the given user.
    Raises 404 if not found or not owned. Returns the stocking record if valid.
    """
    stocking = (
        db.query(StockingLog)
        .join(Pond, StockingLog.pond_id == Pond.id)
        .filter(
            StockingLog.id == stocking_id,
            Pond.owner_id == user_id
        )
        .first()
    )
    if not stocking:
        raise HTTPException(
            status_code=404,
            detail="Stocking record not found or access denied"
        )
    return stocking
