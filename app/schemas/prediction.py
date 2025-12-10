from pydantic import BaseModel

class PredictionInput(BaseModel):
    fry_quantity: int
    days_cultured: int
    area_sqm: float

class PredictionOutput(BaseModel):
    predicted_yield_kg: float
    estimated_revenue: float