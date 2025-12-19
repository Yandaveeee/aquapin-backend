from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.orm import Session
from typing import List
import math
from sqlalchemy import desc

from app.db.connection import get_db
from app.models.pond import Pond
from app.models.stocking import StockingLog
from app.models.harvest import HarvestLog
from app.schemas.pond import PondCreate, PondResponse

router = APIRouter()

# --- HELPER: Calculate Area in Python (Shoelace Formula) ---
def calculate_polygon_area(coords):
    if len(coords) < 3:
        return 0.0
    
    area = 0.0
    METERS_PER_DEGREE = 111320.0 
    
    for i in range(len(coords)):
        j = (i + 1) % len(coords)
        lat1, lon1 = coords[i]
        lat2, lon2 = coords[j]
        
        x1 = lon1 * METERS_PER_DEGREE * math.cos(math.radians(lat1))
        y1 = lat1 * METERS_PER_DEGREE
        x2 = lon2 * METERS_PER_DEGREE * math.cos(math.radians(lat2))
        y2 = lat2 * METERS_PER_DEGREE
        
        area += (x1 * y2) - (x2 * y1)
        
    return abs(area) / 2.0

# 1. GET ALL PONDS (UPDATED: Now populates stocking status!)
@router.get("/", response_model=List[PondResponse])
def get_all_ponds(
    db: Session = Depends(get_db), 
    x_user_id: str = Header(...) 
):
    # 1. Get all ponds for this user
    ponds = db.query(Pond).filter(Pond.owner_id == x_user_id).all()
    
    # 2. Check status for EACH pond
    for pond in ponds:
        last_stock = db.query(StockingLog).filter(StockingLog.pond_id == pond.id).order_by(desc(StockingLog.stocking_date)).first()
        
        if last_stock:
            # Check if this batch was already harvested
            is_harvested = db.query(HarvestLog).filter(HarvestLog.stocking_id == last_stock.id).first()
            
            # If NOT harvested yet, mark as active
            if not is_harvested:
                pond.last_stocked_at = last_stock.stocking_date
                
    return ponds

# 2. CREATE NEW POND
@router.post("/", response_model=PondResponse)
def create_pond(
    pond_data: PondCreate, 
    db: Session = Depends(get_db),
    x_user_id: str = Header(...) 
):
    try:
        calculated_area = calculate_polygon_area(pond_data.coordinates)
        
        new_pond = Pond(
            name=pond_data.name,
            location_desc=pond_data.location_desc,
            image_base64=pond_data.image_base64,
            coordinates=pond_data.coordinates, 
            area_sqm=round(calculated_area, 2),
            owner_id=x_user_id 
        )
        
        db.add(new_pond)
        db.commit()
        db.refresh(new_pond)
        
        return new_pond

    except Exception as e:
        print(f"SERVER ERROR: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# 3. GET SINGLE POND
@router.get("/{pond_id}", response_model=PondResponse)
def get_pond(
    pond_id: int, 
    db: Session = Depends(get_db), 
    x_user_id: str = Header(...)
):
    pond = db.query(Pond).filter(Pond.id == pond_id, Pond.owner_id == x_user_id).first()
    if not pond:
        raise HTTPException(status_code=404, detail="Pond not found")

    last_stock = db.query(StockingLog).filter(StockingLog.pond_id == pond.id).order_by(desc(StockingLog.stocking_date)).first()
    
    stock_date = None
    if last_stock:
        is_harvested = db.query(HarvestLog).filter(HarvestLog.stocking_id == last_stock.id).first()
        if not is_harvested:
            stock_date = last_stock.stocking_date

    pond.last_stocked_at = stock_date
    return pond