import os

# Read the secret from environment variable
key = os.environ.get('GEMINI_KEY')

if not key:
    print("Error: GEMINI_KEY environment variable not set.")
    exit(1)

file_path = 'app.js'

try:
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Perform replacement
    if '__GEMINI_API_KEY__' in content:
        new_content = content.replace('__GEMINI_API_KEY__', key)
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(new_content)
        print(f"Success: Replaced placeholder in {file_path}")
    else:
        print(f"Warning: Placeholder '__GEMINI_API_KEY__' not found in {file_path}")

except Exception as e:
    print(f"Error processing {file_path}: {e}")
    exit(1)
