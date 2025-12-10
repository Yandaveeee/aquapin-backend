from pydantic import BaseModel
from datetime import date

# Input Schema (What the phone sends)
class StockingCreate(BaseModel):
    pond_id: int
    stocking_date: date
    fry_type: str
    fry_quantity: int

# Output Schema (What the server replies)
class StockingResponse(BaseModel):
    id: int
    pond_id: int
    stocking_date: date
    fry_type: str
    fry_quantity: int
    estimated_survival_rate: float

    class Config:
        from_attributes = True