
import json
import os

MEMORY_FILE = "user_memory.json"

class MemoryManager:
    def __init__(self, file_path=MEMORY_FILE):
        self.file_path = file_path
        self._load()

    def _load(self):
        if os.path.exists(self.file_path):
            try:
                with open(self.file_path, "r") as f:
                    self.data = json.load(f)
            except json.JSONDecodeError:
                self.data = {}
        else:
            self.data = {}

    def save(self):
        with open(self.file_path, "w") as f:
            json.dump(self.data, f, indent=4)

    def set(self, key: str, value: str):
        """Save a piece of information."""
        self.data[key] = value
        self.save()
        return f"Saved: {key} = {value}"

    def get(self, key: str) -> str:
        """Retrieve a piece of information."""
        return self.data.get(key, "Information not found.")

    def get_all(self) -> dict:
        """Get all stored information as a dictionary."""
        return self.data

    def delete(self, key: str):
        """Delete a piece of information."""
        if key in self.data:
            del self.data[key]
            self.save()
            return f"Deleted: {key}"
        return "Key not found."
