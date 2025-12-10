from pydantic import BaseModel
from datetime import date

class MortalityCreate(BaseModel):
    stocking_id: int
    loss_date: date
    quantity_lost: int
    weight_lost_kg: float
    cause: str # Dropdown: Flood, Disease, Heat, Theft
    action_taken: str

class MortalityResponse(BaseModel):
    id: int
    cause: str
    solution: str # The system will generate this!