import google.generativeai as genai

# --- PASTE YOUR KEY BELOW ---
MY_API_KEY = "AIzaSyC9ZURLJFhUO7HvxvFctwReHnFzUSCeUns" 

print("1. Configuring Google AI...")
try:
    genai.configure(api_key=MY_API_KEY)
    print("   - Configuration Success.")
except Exception as e:
    print(f"   - CONFIG FAILED: {e}")
    exit()

print("2. initializing Model...")
try:
    model = genai.GenerativeModel('gemini-1.5-flash')
    print("   - Model Init Success.")
except Exception as e:
    print(f"   - MODEL INIT FAILED: {e}")
    exit()

print("3. Sending Test Message...")
try:
    response = model.generate_content("Hello, are you working?")
    print(f"\n✅ SUCCESS! The AI replied:\n{response.text}")
except Exception as e:
    print(f"\n❌ FAILED. Here is the exact error:\n{e}")