# backend/app/dependencies.py
from fastapi import Header, HTTPException
from sqlalchemy import text
from app.db.connection import SessionLocal

def get_tenant_db(x_user_id: str = Header(None)):
    """
    Reads 'x-user-id' header and switches PostgreSQL schema.
    """
    if x_user_id is None:
        raise HTTPException(status_code=400, detail="User ID header missing")

    db = SessionLocal()
    try:
        # Switch to the user's private schema
        schema_name = f"tenant_{x_user_id}"
        db.execute(text(f"SET search_path TO {schema_name}"))
        yield db
    except Exception as e:
        print(f"Schema Error: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail="Database connection error")
    finally:
        db.close()