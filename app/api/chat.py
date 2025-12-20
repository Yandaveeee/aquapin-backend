import os
import io
from PIL import Image # Import Pillow to handle images
import google.generativeai as genai
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from pydantic import BaseModel
from dotenv import load_dotenv

load_dotenv()
router = APIRouter()

# Response model remains the same
class ChatResponse(BaseModel):
    response: str

GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")

# We stick with the model that worked for you
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

# --- THE NEW VISION API ENDPOINT ---
# Note: We changed from JSON body to Form data and File upload
@router.post("/", response_model=ChatResponse)
async def chat_with_aquabot(
    message: str = Form(...),           # Accepts text part of form
    image: UploadFile = File(None)      # Accepts optional file upload
):
    """
    Analyzes text AND optional image inputs.
    """
    user_msg = message
    pil_image = None

    # 1. Process Image if uploaded
    if image:
        try:
            # Read the uploaded file bytes
            contents = await image.read()
            # Convert bytes to a PIL Image object that Gemini understands
            pil_image = Image.open(io.BytesIO(contents))
            print(f"📸 Image received: {image.filename}")
        except Exception as e:
            print(f"❌ Image processing failed: {e}")
            raise HTTPException(status_code=400, detail="Invalid image file.")

    # 2. TRY ONLINE AI (VISION OR TEXT)
    if model:
        try:
            system_instruction = "You are an expert aquaculture consultant named AquaBot. Keep answers short and practical."
            
            # Prepare input for Gemini
            prompt_parts = [system_instruction]
            if pil_image:
                prompt_parts.append("Analyze this image based on the user's question.")
                prompt_parts.append(pil_image) # Add the image directly
            prompt_parts.append(f"User Question: {user_msg}")

            print("🤔 Sending to AI...")
            # Generate content with text and image parts
            response = model.generate_content(prompt_parts)
            return {"response": response.text}
            
        except Exception as e:
            print(f"❌ AI ERROR: {e}")
            error_str = str(e)
            if "404" in error_str:
                 return {"response": "System Error: AI Model not found."}
            if "429" in error_str:
                return {"response": "I am busy right now. Please ask in 10 seconds."}
            # If it's a safety block on the image
            if "finish_reason" in error_str and "SAFETY" in error_str:
                 return {"response": "I cannot analyze that image due to safety guidelines."}

    # 3. FALLBACK TO OFFLINE (Text only)
    if pil_image:
         return {"response": "[Offline Mode] I cannot analyze images while offline."}

    user_msg_lower = user_msg.lower()
    for keyword, answer in OFFLINE_KNOWLEDGE.items():
        if keyword in user_msg_lower:
            return {"response": f"[Offline Mode] {answer}"}
    
    return {"response": "I cannot reach the AI server right now. Please check your internet connection."}