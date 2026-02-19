"""
RAG State Module
Handles vector storage and retrieval for PDF documents
"""

import os
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_chroma import Chroma


PERSIST_DIR = os.path.join(os.path.dirname(__file__), ".chromadb_shared")
_embeddings = None


def get_embeddings():
    global _embeddings
    if _embeddings is None:
        print("🔍 Loading embedding model...")
        _embeddings = HuggingFaceEmbeddings(model_name="all-MiniLM-L6-v2")
    return _embeddings


def get_vectorstore():
    """Get vectorstore with fresh connection each time."""
    print(f"🔍 Checking vectorstore at: {PERSIST_DIR}")
    print(f"   Directory exists: {os.path.exists(PERSIST_DIR)}")
    
    if not os.path.exists(PERSIST_DIR):
        print("   ❌ Directory does not exist")
        return None
    
    # List directory contents for debugging
    try:
        contents = os.listdir(PERSIST_DIR)
        print(f"   📁 Contents: {contents}")
    except Exception as e:
        print(f"   ⚠️ Cannot list directory: {e}")
    
    try:
        # Always create fresh connection to see latest data
        vs = Chroma(persist_directory=PERSIST_DIR, embedding_function=get_embeddings())
        count = vs._collection.count()
        print(f"   📊 Chunk count: {count}")
        return vs if count > 0 else None
    except Exception as e:
        print(f"   ❌ Error loading vectorstore: {e}")
        return None


def retrieve_context(query: str, k: int = 3) -> str:
    print(f"\n🔎 Searching PDF for: '{query}'")
    vs = get_vectorstore()
    if not vs:
        print("   ⚠️ No vectorstore available")
        return "No PDF has been loaded yet. Please upload a PDF first."
    
    try:
        docs = vs.similarity_search(query, k=k)
        if not docs:
            return "No relevant information found in the PDF."
        return "\n\n---\n\n".join(d.page_content for d in docs)
    except Exception as e:
        return f"Error: {str(e)}"
