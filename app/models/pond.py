from sqlalchemy import Column, Integer, String, Float, JSON, DateTime, Text
from sqlalchemy.sql import func
from app.db.connection import Base

# Note: We do NOT need geoalchemy2 anymore because we use JSON
# This matches the data sent by your mobile app perfectly.

class Pond(Base):
    __tablename__ = "ponds"

    id = Column(Integer, primary_key=True, index=True)
    
    # PRIVACY LOCK: Stores the user UUID
    owner_id = Column(String, index=True, nullable=False) 
    
    name = Column(String, nullable=False)
    location_desc = Column(String, nullable=True)
    
    # STORES: [[18.2, 121.5], [18.3, 121.6], ...]
    coordinates = Column(JSON)  
    
    area_sqm = Column(Float)
    image_base64 = Column(Text, nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())