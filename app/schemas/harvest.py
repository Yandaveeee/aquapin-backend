from pydantic import BaseModel
from datetime import date
from typing import Optional

# INPUT (From Phone)
class HarvestCreate(BaseModel):
    stocking_id: int
    harvest_date: date
    total_weight_kg: float
    market_price_per_kg: float
    # NEW FIELD: This was missing!
    fish_size: Optional[str] = "Standard"

# OUTPUT (To Phone)
class HarvestResponse(BaseModel):
    id: int
    days_cultured: int
    revenue: float
    fish_size: Optional[str] # Add this too

    class Config:
        from_attributes = True