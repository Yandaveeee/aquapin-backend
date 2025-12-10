from sqlalchemy import Column, Integer, String, Float, ForeignKey, Date, Text
from app.db.connection import Base

class MortalityLog(Base):
    __tablename__ = "mortality_logs"

    id = Column(Integer, primary_key=True, index=True)
    stocking_id = Column(Integer, ForeignKey("stocking_logs.id", ondelete="CASCADE"))
    
    loss_date = Column(Date, nullable=False)
    quantity_lost = Column(Integer, nullable=False)
    weight_lost_kg = Column(Float, nullable=False)
    cause = Column(String, nullable=False) # Flood, Disease, Heat
    action_taken = Column(Text, nullable=True)