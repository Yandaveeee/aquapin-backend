from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

# Input Schema (What the App sends)
class PondCreate(BaseModel):
    name: str
    location_desc: Optional[str] = "Unknown Location"
    # FIXED: List[List[float]] matches [[18.2, 121.5], [18.3, 121.6]]
    coordinates: List[List[float]] 
    image_base64: Optional[str] = None

# Output Schema (What the App receives)
class PondResponse(PondCreate):
    id: int
    area_sqm: float
    owner_id: str
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True