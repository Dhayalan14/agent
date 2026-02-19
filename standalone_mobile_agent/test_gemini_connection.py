
import asyncio
import websockets
import json

# Key from .env
API_KEY = 'AIzaSyDkBVbl5O5uBzS0Aa1-QZJNdBqOLhJdMVs'

MODELS_TO_TEST = [
    "models/gemini-2.0-flash-exp",
    "models/gemini-2.0-flash-thinking-exp",
    "models/gemini-1.5-flash-latest"
]

async def test_connection(model_name):
    # Try v1alpha for experimental models if v1beta fails? Or stick to v1beta.
    # The error "not found for API version v1beta" suggested model might be alpha or just wrong name.
    # But let's stick to v1beta for now as it is standard.
    url = f"wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key={API_KEY}"
    print(f"\nTesting model: {model_name}")
    
    try:
        async with websockets.connect(url) as ws:
            print("Connected to WebSocket.")
            
            setup_msg = {
                "setup": {
                    "model": model_name,
                    "generationConfig": {
                        "responseModalities": ["AUDIO"],
                        "speechConfig": {
                            "voiceConfig": {
                                "prebuiltVoiceConfig": {
                                    "voiceName": "Aoede"
                                }
                            }
                        }
                    }
                }
            }
            
            await ws.send(json.dumps(setup_msg))
            print("Sent setup message.")
            
            try:
                response = await asyncio.wait_for(ws.recv(), timeout=5.0)
                print(f"Received response: {response}")
                return True
            except asyncio.TimeoutError:
                print("Timeout waiting for response.")
                return False
            except websockets.exceptions.ConnectionClosed as e:
                print(f"Connection closed: {e}")
                return False
                
    except Exception as e:
        print(f"Error: {e}")
        return False

async def main():
    for model in MODELS_TO_TEST:
        success = await test_connection(model)
        if success:
            print(f"SUCCESS: Model {model} works!")
            return

if __name__ == "__main__":
    asyncio.run(main())
