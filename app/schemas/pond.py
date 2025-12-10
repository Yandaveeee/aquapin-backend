from pydantic import BaseModel
from typing import List, Tuple, Optional
from datetime import datetime, date

class PondCreate(BaseModel):
    name: str
    location_desc: Optional[str] = "Unknown Location"
    coordinates: List[Tuple[float, float]]
    # NEW:
    image_base64: Optional[str] = None

class PondResponse(BaseModel):
    id: int
    name: str
    location_desc: Optional[str]
    area_sqm: Optional[float]
    created_at: datetime
    coordinates: List[Tuple[float, float]] = []
    last_stocked_at: Optional[date] = None
    # NEW:
    image_base64: Optional[str] = None

    class Config:
        from_attributes = True