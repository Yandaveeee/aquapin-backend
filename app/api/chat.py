import os
import google.generativeai as genai
from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter()

class ChatRequest(BaseModel):
    message: str

class ChatResponse(BaseModel):
    response: str

# 1. SETUP GOOGLE GEMINI (The "Smart Brain")
# PASTE YOUR API KEY HERE INSIDE THE QUOTES
GOOGLE_API_KEY = "AIzaSyAQLaqGh3Kz-09Yha-k1ICvKFuzEDohIlM"

try:
    genai.configure(api_key=GOOGLE_API_KEY)
    
    # UPDATE THIS LINE:
    model = genai.GenerativeModel('gemini-2.5-flash') 
    
    print("✅ Google Gemini AI Loaded")
except Exception as e:
    print(f"⚠️ AI Setup Failed: {e}")
    model = None

# 2. THE OFFLINE BACKUP (The "Safe Brain")
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
            # We give the AI a "Persona" so it stays on topic
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
            print("⚠️ Switching to Offline Mode.")

    # PLAN B: FALLBACK TO DICTIONARY (Offline)
    user_msg_lower = user_msg.lower()
    for keyword, answer in OFFLINE_KNOWLEDGE.items():
        if keyword in user_msg_lower:
            return {"response": f"[Offline Mode] {answer}"}
    
    return {"response": "I cannot reach the AI server right now, and I don't have a pre-saved answer for that. Please check your internet connection."}