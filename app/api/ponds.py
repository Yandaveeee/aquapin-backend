from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.orm import Session
from typing import List
import math

from app.db.connection import get_db
from app.models.pond import Pond
from app.schemas.pond import PondCreate, PondResponse

router = APIRouter()

# --- HELPER: Calculate Area in Python (Shoelace Formula) ---
def calculate_polygon_area(coords):
    # coords is a list of [lat, lng]
    if len(coords) < 3:
        return 0.0
    
    area = 0.0
    # Approximate conversion: 1 deg = 111,320 meters
    # This is rough but sufficient for a feasibility study
    METERS_PER_DEGREE = 111320.0 
    
    for i in range(len(coords)):
        j = (i + 1) % len(coords)
        lat1, lon1 = coords[i]
        lat2, lon2 = coords[j]
        
        # Simple projection to meters
        x1 = lon1 * METERS_PER_DEGREE * math.cos(math.radians(lat1))
        y1 = lat1 * METERS_PER_DEGREE
        x2 = lon2 * METERS_PER_DEGREE * math.cos(math.radians(lat2))
        y2 = lat2 * METERS_PER_DEGREE
        
        area += (x1 * y2) - (x2 * y1)
        
    return abs(area) / 2.0

# 1. GET ALL PONDS (Private Mode)
@router.get("/", response_model=List[PondResponse])
def get_all_ponds(
    db: Session = Depends(get_db), 
    x_user_id: str = Header(...) # <--- READS THE USER ID FROM HEADER
):
    # FILTER: Only return ponds that belong to this user
    ponds = db.query(Pond).filter(Pond.owner_id == x_user_id).all()
    return ponds

# 2. CREATE NEW POND
@router.post("/", response_model=PondResponse)
def create_pond(
    pond_data: PondCreate, 
    db: Session = Depends(get_db),
    x_user_id: str = Header(...) # <--- ATTACHES USER ID TO NEW POND
):
    try:
        # Calculate Area in Python
        calculated_area = calculate_polygon_area(pond_data.coordinates)
        
        new_pond = Pond(
            name=pond_data.name,
            location_desc=pond_data.location_desc,
            image_base64=pond_data.image_base64,
            coordinates=pond_data.coordinates, # Save JSON directly
            area_sqm=round(calculated_area, 2),
            owner_id=x_user_id # Save the Owner
        )
        
        db.add(new_pond)
        db.commit()
        db.refresh(new_pond)
        
        return new_pond

    except Exception as e:
        print(f"SERVER ERROR: {e}")
        raise HTTPException(status_code=500, detail=str(e))