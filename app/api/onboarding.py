# backend/app/api/onboarding.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
from pydantic import BaseModel
from app.db.connection import SessionLocal

router = APIRouter()

# Schema for receiving the name from React Native
class UserStart(BaseModel):
    name: str

def get_public_db():
    """Separate connection just for creating users in the public list"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@router.post("/start")
def start_app(user: UserStart, db: Session = Depends(get_public_db)):
    try:
        # 1. Insert Name into Public Directory (using raw SQL for simplicity)
        # In a real app, use a proper SQLAlchemy model for 'users'
        result = db.execute(
            text("INSERT INTO public.users (username, email) VALUES (:name, 'placeholder') RETURNING id"),
            {"name": user.name}
        )
        new_user_id = result.fetchone()[0]
        
        # 2. Create the Private Schema immediately
        # This calls the SQL function we wrote previously
        db.execute(text(f"SELECT provision_new_tenant({new_user_id})"))
        db.commit()

        # 3. Return the ID to the mobile app
        return {
            "msg": "Welcome!",
            "user_id": new_user_id, # The app must save this!
            "schema": f"tenant_{new_user_id}"
        }

    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))