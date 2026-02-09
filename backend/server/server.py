#server/server.py
from services.auth_service import login_user
from services.message_service import send_message_service
from services.conversation_service import handle_create_conversation

import socket
import threading
import os
from dotenv import load_dotenv

from db import save_message, get_messages
import packet

load_dotenv()

online_users = {} # เก็บ mapping ระหว่าง user_id -> socket object

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
            if user_id:
                online_users[user_id] = conn
                conn.send(packet.encode({"status": "ok", "user_id": user_id}))
            else:
                conn.send(packet.encode({"status": "error", "message": "Login failed"}))

        # ---------------- SEND MESSAGE ----------------
        elif pkt_type == "send_message":

            send_message_service(pkt, user_id, online_users)

        # ---------------- LOAD HISTORY ----------------
        elif pkt_type == "history":

            rows = get_messages(pkt["conversation_id"])

            conn.send(packet.encode(rows))

        # ---------------- CREATE CONVERSATION ----------------
        elif pkt_type == "create_conversation":
            # เรียก service และรับ response กลับมา
            response = handle_create_conversation(pkt, user_id)
            
            # ส่งผลลัพธ์กลับหาคนสร้าง
            conn.send(packet.encode(response))
            
            # (Optional) แจ้งเตือนคนอื่นๆ ที่โดนดึงเข้ากลุ่ม
            # โดยการเช็คจาก online_users ถ้าใครออนไลน์อยู่ก็ส่ง packet ไปบอก
        

    conn.close()

while True:
    conn, addr = server.accept()
    thread = threading.Thread(target=handle_client, args=(conn, addr))
    thread.start()
