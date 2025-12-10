import google.generativeai as genai

# --- PASTE YOUR KEY HERE ---
MY_API_KEY = "AIzaSyC9ZURLJFhUO7HvxvFctwReHnFzUSCeUns"

genai.configure(api_key=MY_API_KEY)

print("Searching for available models...")
try:
    # This asks Google: "What models can I use?"
    for m in genai.list_models():
        if 'generateContent' in m.supported_generation_methods:
            print(f" - {m.name}")
            
except Exception as e:
    print(f"Error listing models: {e}")