import os
import google.generativeai as genai
from fastapi import APIRouter
from pydantic import BaseModel
from dotenv import load_dotenv

# 1. LOAD ENV
load_dotenv()

router = APIRouter()

class ChatRequest(BaseModel):
    message: str

class ChatResponse(BaseModel):
    response: str

GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")
model = None

# 2. INITIALIZE AI WITH DIAGNOSTICS
if GOOGLE_API_KEY:
    try:
        genai.configure(api_key=GOOGLE_API_KEY)
        
        # --- DIAGNOSTIC: PRINT WHAT THE KEY CAN SEE ---
        print("🔍 DIAGNOSTIC: Checking available models for this Key...")
        available_models = []
        try:
            for m in genai.list_models():
                if 'generateContent' in m.supported_generation_methods:
                    print(f"   --> Found: {m.name}")
                    available_models.append(m.name)
        except Exception as e:
            print(f"   ❌ DIAGNOSTIC FAILED: API Key might be invalid. Error: {e}")
        # -----------------------------------------------

        # 3. SMART MODEL SELECTION
        # It tries 'flash' first (fastest). If unavailable, falls back to 'pro'.
        if 'models/gemini-1.5-flash' in available_models:
            model = genai.GenerativeModel('gemini-1.5-flash')
            print("✅ Loaded Model: gemini-1.5-flash")
        elif 'models/gemini-pro' in available_models:
            model = genai.GenerativeModel('gemini-pro')
            print("✅ Loaded Model: gemini-pro")
        else:
            # If list_models failed, try Flash blindly as a last resort
            print("⚠️ Could not verify model list. Trying Flash blindly...")
            model = genai.GenerativeModel('gemini-1.5-flash')

    except Exception as e:
        print(f"⚠️ AI Setup Critical Failure: {e}")
else:
    print("⚠️ NO API KEY FOUND. Chat will work in Offline Mode only.")

# OFFLINE BACKUP DATA
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
    
    # PLAN A: ONLINE AI
    if model:
        try:
            system_instruction = (
                "You are an expert aquaculture consultant named AquaBot. "
                "Keep answers short, practical, and easy to understand. "
                f"\n\nUser Question: {user_msg}"
            )
            response = model.generate_content(system_instruction)
            return {"response": response.text}
        except Exception as e:  
            print(f"❌ GOOGLE AI CRASHED: {e}") 

    # PLAN B: OFFLINE FALLBACK
    user_msg_lower = user_msg.lower()
    for keyword, answer in OFFLINE_KNOWLEDGE.items():
        if keyword in user_msg_lower:
            return {"response": f"[Offline Mode] {answer}"}
    
    return {"response": "I cannot reach the AI server right now. Please check your internet connection."}