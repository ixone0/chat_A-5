#client/client.py
import os
from dotenv import load_dotenv
import packet
from connection import create_connection

load_dotenv()

CLIENT_ID = os.getenv("CLIENT_ID")

client = create_connection()

# -------- SYNC ข้อความเก่า --------
client.send(packet.encode({
    "type": "sync",
    "client_id": CLIENT_ID
}))

history = packet.decode(client.recv(4096))

if history["type"] == "history":
    print("\n--- Chat History ---")
    for m in history["messages"]:
        print(m["content"])


# -------- ส่งข้อความใหม่ --------
while True:
    msg = input(">> ")

    client.send(packet.encode({
        "type": "message",
        "client_id": CLIENT_ID,
        "content": msg
    }))

    response = packet.decode(client.recv(4096))
    print("[SERVER]", response)
