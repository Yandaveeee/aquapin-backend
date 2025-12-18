# backend/app/models/__init__.py

# 1. Import the Pond
from .pond import Pond

# 2. Import the Logs (Notice we use the actual class names now)
from .harvest import HarvestLog
from .stocking import StockingLog
from .mortality import MortalityLog

# This file now correctly exposes all your tables to main.py