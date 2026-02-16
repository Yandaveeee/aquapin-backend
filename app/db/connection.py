import os
import logging
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv

logger = logging.getLogger("aquapin")

# 1. Load environment variables (for local dev)
load_dotenv()

# 2. Get the Database URL
db_url = os.getenv("DATABASE_URL", "")

# --- CRITICAL FIX FOR RENDER ---
# Render provides 'postgres://' but SQLAlchemy needs 'postgresql://'
if db_url.startswith("postgres://"):
    db_url = db_url.replace("postgres://", "postgresql://", 1)

# 3. Create the Engine
if not db_url:
    raise ValueError("DATABASE_URL is not set. Please check your .env file or Render Environment Variables.")

engine = create_engine(
    db_url,
    pool_size=5,           # Max persistent connections
    max_overflow=10,       # Extra connections allowed under load
    pool_recycle=1800,     # Recycle connections after 30 minutes (prevents stale connections)
    pool_pre_ping=True,    # Test connections before using (auto-reconnect on failure)
)

# 4. Session & Base
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# 5. Dependency
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()