# Standalone Mobile Agent

This version runs **entirely in your mobile browser**. It does not require a PC server.

### How to use on your phone:

1.  **Hosting (Easiest)**:
    - You can upload these files (`index.html`, `app.js`, `manifest.json`) to a free host like **GitHub Pages**, **Netlify**, or **Vercel**.
    - Once hosted, open the link on your phone.

2.  **Local Testing**:
    - If you are on the same Wi-Fi, you can run a simple server on your PC just to view the files:
      `python -m http.server 8000`
    - Then visit `http://YOUR_PC_IP:8000` on your phone.

3.  **Setup**:
    - Click the **Gear icon (⚙️ Settings)** in the app.
    - Paste your **Google Gemini API Key**.
    - Click "Save & Close".

4.  **Start Talking**:
    - Click the **Microphone (🎤)** button.
    - Grant permission to use the microphone.
    - The status will change to "Live". Start talking!

### Features:
- **No Python Backend**: All logic is in the browser.
- **Persistent Memory**: It saves your name and details using your phone's browser storage (`localStorage`). Even if you close the browser, it will remember you.
- **PWA Support**: On your phone, use your browser's menu to select "Add to Home Screen" to install it as a standalone app icon.
