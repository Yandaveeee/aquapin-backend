from sqlalchemy import Column, Integer, String, Float, ForeignKey, DateTime, Text
from sqlalchemy.sql import func
from geoalchemy2 import Geometry
from app.db.connection import Base

class Pond(Base):
    __tablename__ = "ponds"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, nullable=True) 
    name = Column(String, nullable=False)
    # NEW COLUMN HERE:
    location_desc = Column(String, nullable=True) 
    
    image_base64 = Column(Text, nullable=True)

    geometry = Column(Geometry("POLYGON", srid=4326))
    area_sqm = Column(Float)
    created_at = Column(DateTime(timezone=True), server_default=func.now())