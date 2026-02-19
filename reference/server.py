"""
PDF RAG Server
FastAPI server for PDF upload and LiveKit token generation
"""

from fastapi import FastAPI, UploadFile, File
from fastapi.responses import FileResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_chroma import Chroma
from langchain_core.documents import Document
from livekit import api
from dotenv import load_dotenv
import fitz
import os
import uuid
import shutil

from rag import get_embeddings, PERSIST_DIR

load_dotenv()

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)

splitter = RecursiveCharacterTextSplitter(chunk_size=500, chunk_overlap=50)


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


@app.post("/upload")
async def upload_pdf(file: UploadFile = File(...)):
    if not file.filename.lower().endswith('.pdf'):
        return JSONResponse(status_code=400, content={"success": False, "error": "Only PDF files allowed"})
    
    try:
        # Clear previous
        if os.path.exists(PERSIST_DIR):
            shutil.rmtree(PERSIST_DIR)
        
        # Extract text
        pdf_bytes = await file.read()
        with fitz.open(stream=pdf_bytes, filetype="pdf") as doc:
            text = "\n".join(page.get_text() for page in doc)
        
        if not text.strip():
            return JSONResponse(status_code=400, content={"success": False, "error": "No text found"})
        
        # Create vectorstore
        chunks = splitter.split_text(text)
        docs = [Document(page_content=chunk) for chunk in chunks]
        Chroma.from_documents(docs, get_embeddings(), persist_directory=PERSIST_DIR)
        
        return {"success": True, "chunks": len(chunks), "pdf_name": file.filename}
    except Exception as e:
        return JSONResponse(status_code=500, content={"success": False, "error": str(e)})


@app.get("/rag/status")
async def rag_status():
    if not os.path.exists(PERSIST_DIR):
        return {"is_loaded": False, "chunk_count": 0}
    try:
        vs = Chroma(persist_directory=PERSIST_DIR, embedding_function=get_embeddings())
        return {"is_loaded": True, "chunk_count": vs._collection.count()}
    except:
        return {"is_loaded": False, "chunk_count": 0}