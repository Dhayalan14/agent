
"""
Simple Voice Agent Server
FastAPI server for LiveKit token generation
"""

from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from livekit import api
from dotenv import load_dotenv
import uvicorn
import os
import uuid

load_dotenv()

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)


@app.get("/")
async def home():
    return FileResponse("index.html")


@app.get("/token")
async def get_token():
    token = (
        api.AccessToken(os.getenv("LIVEKIT_API_KEY"), os.getenv("LIVEKIT_API_SECRET"))
        .with_identity("user-" + uuid.uuid4().hex[:8])
        .with_grants(api.VideoGrants(room_join=True, room="my-room"))
        .to_jwt()
    )
    return {"token": token, "url": os.getenv("LIVEKIT_URL")}


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
