from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text, desc
from shapely.geometry import Polygon
from geoalchemy2.shape import from_shape, to_shape
from typing import List

from app.db.connection import get_db
from app.models.pond import Pond
from app.models.stocking import StockingLog
from app.models.harvest import HarvestLog
from app.schemas.pond import PondCreate, PondResponse

router = APIRouter()

# 1. FETCH ALL PONDS (GET)
@router.get("/", response_model=List[PondResponse])
def get_all_ponds(db: Session = Depends(get_db)):
    ponds = db.query(Pond).all()
    results = []

    for pond in ponds:
        # Convert PostGIS shape back to Coordinates
        try:
            shapely_poly = to_shape(pond.geometry)
            
            # --- FIX IS HERE: Use (y, x) for Tuples, not [y, x] ---
            coords = [(y, x) for x, y in shapely_poly.exterior.coords][:-1]
            # ------------------------------------------------------
            
        except Exception:
            coords = []

        # Check Stocking Status
        last_stock = db.query(StockingLog).filter(StockingLog.pond_id == pond.id).order_by(desc(StockingLog.stocking_date)).first()
        
        fish_type = "(None)"
        stock_date = None 
        
        if last_stock:
            is_harvested = db.query(HarvestLog).filter(HarvestLog.stocking_id == last_stock.id).first()
            if not is_harvested:
                fish_type = f"({last_stock.fry_type})"
                stock_date = last_stock.stocking_date

        # Create Response Object
        pond_obj = PondResponse(
            id=pond.id,
            name=f"{pond.name} {fish_type}",
            location_desc=pond.location_desc,
            area_sqm=pond.area_sqm,
            created_at=pond.created_at,
            last_stocked_at=stock_date,
            image_base64=pond.image_base64 
        )
        pond_obj.coordinates = coords 
        results.append(pond_obj)

    return results

# 2. CREATE NEW POND (POST)
@router.post("/", response_model=PondResponse)
def create_pond(pond_data: PondCreate, db: Session = Depends(get_db)):
    try:
        coords = pond_data.coordinates
        
        if len(coords) < 3:
            raise HTTPException(status_code=400, detail="A pond must have at least 3 points")

        if coords[0] != coords[-1]:
            coords.append(coords[0])

        flipped_coords = [(lon, lat) for lat, lon in coords]
        shapely_poly = Polygon(flipped_coords)

        new_pond = Pond(
            name=pond_data.name,
            location_desc=pond_data.location_desc,
            image_base64=pond_data.image_base64, 
            geometry=from_shape(shapely_poly, srid=4326),
            area_sqm=0.0 
        )
        db.add(new_pond)
        db.commit()
        db.refresh(new_pond)

        try:
            sql = text("UPDATE ponds SET area_sqm = ST_Area(geometry::geography) WHERE id = :id RETURNING area_sqm")
            result = db.execute(sql, {"id": new_pond.id})
            calculated_area = result.scalar()
            db.commit()
            new_pond.area_sqm = round(calculated_area, 2)
        except Exception:
            new_pond.area_sqm = 0.0

        new_pond.coordinates = [] 
        return new_pond

    except Exception as e:
        print(f"SERVER ERROR: {e}")
        raise HTTPException(status_code=500, detail=str(e))