import os
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv

# 1. Load environment variables (for local dev)
load_dotenv()

# 2. Get the Database URL
# Default to an empty string to prevent immediate crash if missing
db_url = os.getenv("DATABASE_URL", "")

# --- CRITICAL FIX FOR RENDER ---
# Render provides 'postgres://' but SQLAlchemy needs 'postgresql://'
if db_url.startswith("postgres://"):
    db_url = db_url.replace("postgres://", "postgresql://", 1)

# 3. Create the Engine
# If no URL is found (e.g. forgot to set var), valid error handling or fallback
if not db_url:
    raise ValueError("DATABASE_URL is not set. Please check your .env file or Render Environment Variables.")

engine = create_engine(db_url)

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