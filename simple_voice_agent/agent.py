
import asyncio
import os
import json
from dotenv import load_dotenv
from livekit import rtc, api
from livekit.agents import Agent, AgentSession, RoomInputOptions, function_tool, RunContext
from livekit.plugins import google

from memory import MemoryManager

load_dotenv()


INSTRUCTION = """
You are a friendly and intelligent Voice AI assistant.
Your goal is to have natural, human-like conversations with the user.

You have a special ability: **Long-Term Memory**.
- When the user shares personal details (like their name, favorite color, birthday, or upcoming events), you should use the `save_user_detail` tool to remember them.
- If the user asks about something you might have stored (e.g., "When is my appointment?"), use the `get_user_detail` tool to retrieve it.

**Personality Guidelines:**
- Be warm, concise, and helpful.
- Speak naturally; avoid robotic lists or stiff phrasing.
- meaningful interactions are better than long monologues.
- Do not explicitly mention that you are "checking your memory" or "saving a file" unless asked. Just do it naturally.
"""


class Assistant(Agent):
    def __init__(self, memory: MemoryManager):
        super().__init__(instructions=INSTRUCTION)
        self.memory = memory
    
    @function_tool()
    async def save_user_detail(self, ctx: RunContext, key: str, value: str) -> str:
        """Save a specific detail about the user (e.g., name, birthday, preference)."""
        return self.memory.set(key, value)

    @function_tool()
    async def get_user_detail(self, ctx: RunContext, key: str) -> str:
        """Retrieve a specific detail about the user."""
        return self.memory.get(key)


async def main():
    key = os.getenv("LIVEKIT_API_KEY")
    secret = os.getenv("LIVEKIT_API_SECRET")
    url = os.getenv("LIVEKIT_URL")
    
    if not key or not secret or not url:
        print("Error: LiveKit credentials not found in .env file")
        return

    # Initialize memory
    memory = MemoryManager()
    
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
    
    await session.start(room=room, agent=Assistant(memory), room_input_options=RoomInputOptions())
    print("🎙️ Agent is ready!")
    
    # Inject current memory into the session context
    current_memory = memory.get_all()
    if current_memory:
        # We summarize the memory for the agent so it knows context immediately
        memory_str = ", ".join([f"{k}: {v}" for k, v in current_memory.items()])
        initial_context = f"FYI, here is what you remember about this user: {memory_str}"
        await session.generate_reply(instructions=initial_context)
    else:
        greeting = "Hello! I'm your AI assistant. How can I help you today?"
        await session.generate_reply(instructions=greeting)
    
    while True:
        await asyncio.sleep(1)


if __name__ == "__main__":
    asyncio.run(main())
