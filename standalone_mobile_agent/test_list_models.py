
import requests
import json

# Valid key from .env
API_KEY = 'AIzaSyDkBVbl5O5uBzS0Aa1-QZJNdBqOLhJdMVs'
URL = f"https://generativelanguage.googleapis.com/v1beta/models?key={API_KEY}"

def list_models():
    try:
        response = requests.get(URL)
        if response.status_code == 200:
            models = response.json().get('models', [])
            print(f"Found {len(models)} models:")
            for m in models:
                print(f"- {m['name']}: {m['displayName']}")
                methods = m.get('supportedGenerationMethods', [])
                if 'bidiGenerateContent' in methods:
                    print(f"  *** SUPPORTS bidiGenerateContent ***")
                if 'generateContent' in methods:
                    print(f"  * supports generateContent")
        else:
            print(f"Error: {response.status_code} - {response.text}")
    except Exception as e:
        print(f"Exception: {e}")

if __name__ == "__main__":
    list_models()
