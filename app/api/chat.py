import os
import google.generativeai as genai
from fastapi import APIRouter
from pydantic import BaseModel
from dotenv import load_dotenv

load_dotenv()
router = APIRouter()

class ChatRequest(BaseModel):
    message: str

class ChatResponse(BaseModel):
    response: str

GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")

# --- UPDATE: USE THE MODEL FOUND IN YOUR LOGS ---
# Your logs showed you have access to 2.0, so we use that.
MODEL_NAME = 'gemini-2.0-flash' 

model = None

if GOOGLE_API_KEY:
    try:
        genai.configure(api_key=GOOGLE_API_KEY)
        model = genai.GenerativeModel(MODEL_NAME)
        print(f"✅ AI Configured. Connected to: {MODEL_NAME}")
    except Exception as e:
        print(f"⚠️ AI Configuration Error: {e}")
else:
    print("⚠️ NO API KEY FOUND.")

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
    
    # 1. TRY ONLINE AI
    if model:
        try:
            # We use the updated model name here
            response = model.generate_content(
                f"You are an expert aquaculture consultant named AquaBot. Keep answers short and practical. User Question: {user_msg}"
            )
            return {"response": response.text}
        except Exception as e:
            print(f"❌ AI GENERATION FAILED: {e}")
            # If 2.0 fails, it might be a region issue, but this is unlikely given your logs.

    # 2. FALLBACK TO OFFLINE
    user_msg_lower = user_msg.lower()
    for keyword, answer in OFFLINE_KNOWLEDGE.items():
        if keyword in user_msg_lower:
            return {"response": f"[Offline Mode] {answer}"}
    
    return {"response": "I cannot reach the AI server. Please check your internet connection."}