import os
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv

# 1. Load the password from the .env file
load_dotenv()
DATABASE_URL = os.getenv("DATABASE_URL")

# 2. Create the Engine (The actual connection)
engine = create_engine(DATABASE_URL)

# 3. Create a SessionLocal class
# Each time a user requests data, we open a "Session", do the work, then close it.
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# 4. Base class for our Models
Base = declarative_base()

# 5. Dependency (We use this in every API endpoint)
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()