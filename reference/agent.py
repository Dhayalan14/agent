"""
LiveKit Voice Agent with PDF RAG
"""

import asyncio
import os
from dotenv import load_dotenv
from livekit import rtc, api
from livekit.agents import Agent, AgentSession, RoomInputOptions, function_tool, RunContext
from livekit.plugins import google

from rag import retrieve_context, get_vectorstore

load_dotenv()


INSTRUCTION = """You are a helpful AI assistant that answers questions based on uploaded PDF documents.

IMPORTANT RULES:
1. ALWAYS use the search_pdf tool to find information BEFORE answering any question about the document.
2. NEVER say "no PDF is uploaded" without first using the check_pdf_status tool to verify.
3. When the user asks a question, search the PDF first, then answer based on what you find.
4. Be helpful and conversational."""


class Assistant(Agent):
    def __init__(self):
        super().__init__(instructions=INSTRUCTION)
    
    @function_tool()
    async def check_pdf_status(self, ctx: RunContext) -> str:
        """Check if a PDF has been uploaded and is ready for questions."""
        # Prevent user interruption while checking
        ctx.disallow_interruptions()
        vs = get_vectorstore()
        if vs:
            count = vs._collection.count()
            return f"PDF is loaded with {count} text chunks. Ready to answer questions!"
        return "No PDF has been uploaded yet."
    
    @function_tool()
    async def search_pdf(self, ctx: RunContext, query: str) -> str:
        """Search the uploaded PDF for relevant information. Always use this before answering questions."""
        # Prevent user interruption while searching - this is critical!
        ctx.disallow_interruptions()
        print(f"   🔒 Interruptions disabled for search")
        result = retrieve_context(query)
        print(f"   ✅ Search complete, returning {len(result)} chars")
        return result


async def main():
    key = os.getenv("LIVEKIT_API_KEY")
    secret = os.getenv("LIVEKIT_API_SECRET")
    url = os.getenv("LIVEKIT_URL")
    
    token = api.AccessToken(key, secret) \
        .with_identity("Agent") \
        .with_grants(api.VideoGrants(room_join=True, room="my-room", can_publish=True, can_subscribe=True))
    
    room = rtc.Room()
    await room.connect(url, token.to_jwt())
    print(f"✅ Connected to room: {room.name}")
    
    session = AgentSession(
        llm=google.beta.realtime.RealtimeModel(
            voice="Puck",
            api_key=os.getenv("GOOGLE_API_KEY")
        )
    )
    
    await session.start(room=room, agent=Assistant(), room_input_options=RoomInputOptions())
    print("🎙️ Agent is ready!")
    
    # Check PDF status and greet appropriately
    vs = get_vectorstore()
    if vs:
        count = vs._collection.count()
        greeting = f"Hello! I can see you've already uploaded a PDF with {count} text chunks. Feel free to ask me any questions about it!"
    else:
        greeting = "Hello! I'm your PDF assistant. Please upload a PDF document first, then I can answer your questions about it."
    
    await session.generate_reply(instructions=greeting)
    
    while True:
        await asyncio.sleep(1)


if __name__ == "__main__":
    asyncio.run(main())
