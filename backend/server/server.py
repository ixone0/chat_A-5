#server/server.py
from services.auth_service import login_user
from services.message_service import send_message_service

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

    user_id = None

    while True:
        data = conn.recv(4096)
        pkt = packet.decode(data)

        pkt_type = pkt.get("type")

        # ---------------- LOGIN ----------------
        if pkt_type == "login":

            user_id = login_user(pkt)

            online_users[user_id] = conn

            conn.send(packet.encode({"status": "ok"}))

        # ---------------- SEND MESSAGE ----------------
        elif pkt_type == "send_message":

            send_message_service(pkt, user_id, online_users)

        # ---------------- LOAD HISTORY ----------------
        elif pkt_type == "history":

            rows = get_messages(pkt["conversation_id"])

            conn.send(packet.encode(rows))

        

    conn.close()

while True:
    conn, addr = server.accept()
    thread = threading.Thread(target=handle_client, args=(conn, addr))
    thread.start()
