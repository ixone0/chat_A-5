#server/server.py
import socket
import threading
import os
from dotenv import load_dotenv

from db import save_message, get_messages
import packet

load_dotenv()

HOST = "0.0.0.0"
PORT = int(os.getenv("PORT"))

server = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
server.bind((HOST, PORT))
server.listen()

print("Server started...")

def handle_client(conn, addr):
    print("Connected:", addr)

    while True:
        try:
            data = conn.recv(4096)
            if not data:
                break

            pkt = packet.decode(data)

            # -------- ส่งข้อความ --------
            if pkt["type"] == "message":
                save_message(
                    pkt["client_id"],
                    addr[0],
                    pkt["content"]
                )

                conn.send(packet.encode({"status": "saved"}))

            # -------- sync history --------
            elif pkt["type"] == "sync":
                rows = get_messages(pkt["client_id"])

                messages = [
                    {"content": r[0], "time": str(r[1])}
                    for r in rows
                ]

                conn.send(packet.encode({
                    "type": "history",
                    "messages": messages
                }))

        except Exception as e:
            print("Error:", e)
            break

    conn.close()

while True:
    conn, addr = server.accept()
    thread = threading.Thread(target=handle_client, args=(conn, addr))
    thread.start()
