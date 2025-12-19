from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime, date  # <--- 1. Import 'date'

# Input Schema (What the App sends)
class PondCreate(BaseModel):
    name: str
    location_desc: Optional[str] = "Unknown Location"
    coordinates: List[List[float]] 
    image_base64: Optional[str] = None

# Output Schema (What the App receives)
class PondResponse(PondCreate):
    id: int
    area_sqm: float
    owner_id: str
    created_at: Optional[datetime] = None
    
    # 2. ADD THIS FIELD (Crucial for status to work)
    last_stocked_at: Optional[date] = None 

    class Config:
        from_attributes = True