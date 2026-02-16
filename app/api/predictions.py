import logging
import joblib
import os
from fastapi import APIRouter, HTTPException
from app.schemas.prediction import PredictionInput, PredictionOutput

logger = logging.getLogger("aquapin")
router = APIRouter()

# Load the model ONCE when the server starts
MODEL_PATH = "ml_engine/models/yield_predictor.pkl"

try:
    model = joblib.load(MODEL_PATH)
    logger.info("ML Model Loaded Successfully")
except Exception as e:
    logger.warning(f"Could not load ML model: {e}")
    model = None

@router.post("/", response_model=PredictionOutput)
def predict_yield(data: PredictionInput):
    if not model:
        raise HTTPException(status_code=500, detail="Model not loaded. Train it first!")

    try:
        # The model expects a list of lists: [[fry, days, area]]
        features = [[data.fry_quantity, data.days_cultured, data.area_sqm]]
        
        # Predict
        prediction_kg = model.predict(features)[0]
        
        # Simple Revenue Estimation (e.g., 150 PHP per kg)
        revenue = prediction_kg * 150 
        
        return {
            "predicted_yield_kg": round(prediction_kg, 2),
            "estimated_revenue": round(revenue, 2)
        }
    except Exception as e:
        logger.error(f"Prediction failed: {e}")
        raise HTTPException(status_code=500, detail="Prediction failed")