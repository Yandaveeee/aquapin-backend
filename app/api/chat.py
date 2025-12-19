import os
import google.generativeai as genai
from fastapi import APIRouter
from pydantic import BaseModel
from dotenv import load_dotenv  # <--- 1. IMPORT THIS

# 2. LOAD THE .ENV FILE
load_dotenv() 

router = APIRouter()

class ChatRequest(BaseModel):
    message: str

class ChatResponse(BaseModel):
    response: str

# 3. GET THE KEY SECURELY
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")

model = None

# 4. INITIALIZE AI
if GOOGLE_API_KEY:
    try:
        genai.configure(api_key=GOOGLE_API_KEY)
        model = genai.GenerativeModel('gemini-1.5-flash') 
        print("✅ Google Gemini AI Loaded")
    except Exception as e:
        print(f"⚠️ AI Setup Failed: {e}")
else:
    print("⚠️ NO API KEY FOUND. Chat will work in Offline Mode only.")

# OFFLINE BACKUP
OFFLINE_KNOWLEDGE = {
    "green": "Green water indicates algae. Reduce feeding and turn on aerators.",
    "brown": "Brown water means mud/solids. Apply agricultural lime (apog).",
    "gasping": "Fish gasping means LOW OXYGEN. Aerate immediately!",
    "feed": "Feed 3-5% of body weight daily. Split into morning/afternoon.",
    "growth": "For faster growth, use high-protein feed and maintain high oxygen levels."
}

@router.post("/", response_model=ChatResponse)
def chat_with_aquabot(request: ChatRequest):
    user_msg = request.message
    
    # PLAN A: TRY GOOGLE GEMINI (Online)
    if model:
        try:
            system_instruction = (
                "You are an expert aquaculture consultant named AquaBot. "
                "You help farmers with fish ponds, tilapia, bangus, and water quality. "
                "Keep answers short, practical, and easy to understand. "
                "If the question is NOT about fish farming, politely refuse to answer."
                f"\n\nUser Question: {user_msg}"
            )
            response = model.generate_content(system_instruction)
            return {"response": response.text}
        except Exception as e:  
            print(f"❌ GOOGLE AI CRASHED: {e}") 

    # PLAN B: FALLBACK TO DICTIONARY (Offline)
    user_msg_lower = user_msg.lower()
    for keyword, answer in OFFLINE_KNOWLEDGE.items():
        if keyword in user_msg_lower:
            return {"response": f"[Offline Mode] {answer}"}
    
    return {"response": "I cannot reach the AI server right now. Please check your internet connection."}