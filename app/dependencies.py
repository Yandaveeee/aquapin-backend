# backend/app/dependencies.py
import re
import logging
from fastapi import Header, HTTPException
from sqlalchemy import text
from app.db.connection import SessionLocal

logger = logging.getLogger("aquapin")

# Strict UUID v4 pattern to prevent SQL injection
UUID_PATTERN = re.compile(
    r'^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
)

def get_tenant_db(x_user_id: str = Header(None)):
    """
    Reads 'x-user-id' header and switches PostgreSQL schema.
    Validates that user ID is a proper UUID to prevent SQL injection.
    """
    if x_user_id is None:
        raise HTTPException(status_code=400, detail="User ID header missing")

    # SECURITY: Validate UUID format before using in SQL
    if not UUID_PATTERN.match(x_user_id):
        raise HTTPException(status_code=400, detail="Invalid user ID format")

    db = SessionLocal()
    try:
        # Safe: x_user_id is now guaranteed to be a valid UUID
        schema_name = f"tenant_{x_user_id}"
        db.execute(text(f"SET search_path TO {schema_name}"))
        yield db
    except Exception as e:
        logger.error(f"Schema switch error for user {x_user_id}: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail="Database connection error")
    finally:
        db.close()