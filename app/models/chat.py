from sqlalchemy import Column, Integer, String, Text, DateTime
from app.db.connection import Base
from datetime import datetime

class ChatHistory(Base):
    __tablename__ = "chat_history"

    id = Column(Integer, primary_key=True, index=True)
    sender = Column(String(10), nullable=False) # 'user' or 'bot'
    message = Column(Text, nullable=False)
    image_url = Column(String(255), nullable=True) # To save photo URLs
    timestamp = Column(DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "sender": self.sender,
            "text": self.message,
            "image": self.image_url,
            "timestamp": self.timestamp.isoformat()
        }