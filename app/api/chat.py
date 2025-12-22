import os
import io
from PIL import Image
import google.generativeai as genai
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Depends
from pydantic import BaseModel
from dotenv import load_dotenv
from sqlalchemy.orm import Session
from app.db.connection import get_db
from app.models.chat import ChatHistory 

load_dotenv()
router = APIRouter()

# Response model
class ChatResponse(BaseModel):
    response: str

GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")
MODEL_NAME = 'gemini-flash-latest'
model = None

# --- AI SETUP ---
if GOOGLE_API_KEY:
    try:
        genai.configure(api_key=GOOGLE_API_KEY)
        model = genai.GenerativeModel(MODEL_NAME)
        print(f"✅ AI Vision Ready. Connected to: {MODEL_NAME}")
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

# --- NEW ROUTE: GET HISTORY ---
@router.get("/history")
def get_chat_history(db: Session = Depends(get_db)):
    """Fetch the last 50 chat messages from the database."""
    history = db.query(ChatHistory).order_by(ChatHistory.timestamp.asc()).limit(50).all()
    
    # Convert DB objects to JSON-friendly list
    return [
        {
            "id": msg.id,
            "sender": msg.sender,
            "text": msg.message,
            "image": msg.image_url,
            "timestamp": msg.timestamp
        } 
        for msg in history
    ]

# --- UPDATED CHAT ROUTE (Now Saves to DB) ---
@router.post("/", response_model=ChatResponse)
async def chat_with_aquabot(
    message: str = Form(...),           
    image: UploadFile = File(None),
    db: Session = Depends(get_db) # <--- Inject Database Session
):
    """
    Analyzes text AND optional image inputs, AND saves to database.
    """
    user_msg = message
    pil_image = None
    image_filename = None
    
    # 1. Process Image
    if image:
        try:
            contents = await image.read()
            pil_image = Image.open(io.BytesIO(contents))
            image_filename = image.filename # We save the filename to DB
            print(f"📸 Image received: {image_filename}")
        except Exception as e:
            print(f"❌ Image processing failed: {e}")
    
    # --- SAVE USER MESSAGE TO DB ---
    try:
        user_record = ChatHistory(sender='user', message=user_msg, image_url=image_filename)
        db.add(user_record)
        db.commit() # Save now so it's safe
    except Exception as e:
        print(f"⚠️ Database Error (User): {e}")

    ai_response_text = ""

    # 2. TRY ONLINE AI
    if model:
        try:
            system_instruction = "You are an expert aquaculture consultant named AquaBot. Keep answers short and practical."
            prompt_parts = [system_instruction]
            if pil_image:
                prompt_parts.append("Analyze this image based on the user's question.")
                prompt_parts.append(pil_image)
            prompt_parts.append(f"User Question: {user_msg}")

            response = model.generate_content(prompt_parts)
            ai_response_text = response.text
            
        except Exception as e:
            print(f"❌ AI ERROR: {e}")
            if "429" in str(e):
                ai_response_text = "I am busy right now. Please ask in 10 seconds."
            else:
                ai_response_text = "I cannot reach the AI server right now."

    # 3. FALLBACK TO OFFLINE (If AI failed or no model)
    if not ai_response_text or "I cannot reach" in ai_response_text:
        user_msg_lower = user_msg.lower()
        found_offline = False
        for keyword, answer in OFFLINE_KNOWLEDGE.items():
            if keyword in user_msg_lower:
                ai_response_text = f"[Offline Mode] {answer}"
                found_offline = True
                break
        
        if not found_offline and not ai_response_text:
             ai_response_text = "I cannot reach the server and I don't have an offline answer for that."

    # --- SAVE BOT RESPONSE TO DB ---
    try:
        bot_record = ChatHistory(sender='bot', message=ai_response_text)
        db.add(bot_record)
        db.commit()
    except Exception as e:
        print(f"⚠️ Database Error (Bot): {e}")

    return {"response": ai_response_text}