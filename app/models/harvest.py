from sqlalchemy import Column, Integer, Float, Date, ForeignKey, String
from app.db.connection import Base

class HarvestLog(Base):
    __tablename__ = "harvest_logs"

    id = Column(Integer, primary_key=True, index=True)
    # We link to the Stocking ID, not just the Pond ID.
    # This tells us exactly WHICH batch of fish we are harvesting.
    stocking_id = Column(Integer, ForeignKey("stocking_logs.id", ondelete="CASCADE"))
    
    harvest_date = Column(Date, nullable=False)
    total_weight_kg = Column(Float, nullable=False) # The Target Variable for AI
    market_price_per_kg = Column(Float)
    revenue = Column(Float)
    days_cultured = Column(Integer) # We will calculate this automatically

    fish_size = Column(String, nullable=True) # e.g., "Fingerling", "Standard", "Large"