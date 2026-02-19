
from memory import MemoryManager
import os
import sys

# Clean up any existing test file
if os.path.exists("test_memory_2.json"):
    try:
        os.remove("test_memory_2.json")
    except:
        pass

# Initialize memory with a test file
mem = MemoryManager("test_memory_2.json")

# Test saving
print("Saving name...")
mem.set("name", "Dhayalan")
mem.set("birthday", "January 1st")

# Test retrieving
print("Retrieving name:", mem.get("name"))
assert mem.get("name") == "Dhayalan"

# Test persistence (reload from file)
print("Reloading memory...")
mem2 = MemoryManager("test_memory_2.json")
print("Retrieving birthday from new instance:", mem2.get("birthday"))
assert mem2.get("birthday") == "January 1st"

# Test get_all
all_data = mem2.get_all()
print("All data:", all_data)
assert "name" in all_data
assert "birthday" in all_data

# Clean up
try:
    os.remove("test_memory_2.json")
except:
    pass

print("Memory tests passed!")
