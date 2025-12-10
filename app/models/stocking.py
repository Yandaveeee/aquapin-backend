from sqlalchemy import Column, Integer, String, Float, ForeignKey, Date
from sqlalchemy.orm import relationship
from app.db.connection import Base

class StockingLog(Base):
    __tablename__ = "stocking_logs"

    id = Column(Integer, primary_key=True, index=True)
    pond_id = Column(Integer, ForeignKey("ponds.id", ondelete="CASCADE"))
    stocking_date = Column(Date, nullable=False)
    fry_type = Column(String, nullable=False) # e.g. 'Tilapia'
    fry_quantity = Column(Integer, nullable=False)
    estimated_survival_rate = Column(Float, default=0.85)

    # Relationship (Optional, but good for later)
    # pond = relationship("Pond", back_populates="stockings")