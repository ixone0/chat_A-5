#server/server.py
import socket
import threading
import os
from dotenv import load_dotenv
import json

# Import Services
from services.auth_service import login_user, register_user
from services.conversation_service import handle_create_conversation
from services.user_service import change_custom_id
# หมายเหตุ: services.message_service กับ db.py คุณต้องแก้ให้รองรับ UUID ด้วยนะ
# ถ้ายังไม่มีไฟล์ message_service ให้ comment บรรทัดนี้ไปก่อน
# from services.message_service import send_message_service 

import packet

load_dotenv()

online_users = {} # user_id (str) -> socket object

HOST = "0.0.0.0"
PORT = int(os.getenv("PORT", 8082))

server = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
server.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1) # ป้องกัน Address already in use
server.bind((HOST, PORT))
server.listen()

print(f"Server started on {HOST}:{PORT}...")

def handle_incoming_packet(conn, data_bytes):
    try:
        pkt = json.loads(data_bytes.decode())
    except Exception as e:
        print("Invalid packet:", e)
        return

    pkt_type = pkt.get("type")

    if pkt_type == "update_user_id":
        user_id = pkt.get("user_id")
        new_id = pkt.get("new_id")
        result = change_custom_id(user_id, new_id)  # returns dict {"success": True/False, "message": ...}

        # keep the same request_id if provided so electron can match
        resp = {
            "type": "update_user_id_response",
            "success": bool(result.get("success")),
            "message": result.get("message", "")
        }
        if "request_id" in pkt:
            resp["request_id"] = pkt["request_id"]

        conn.send(json.dumps(resp).encode())
        return
    
def handle_client(conn, addr):
    print(f"[NEW CONNECTION] {addr} connected.")
    user_id = None

    try:
        while True:
            data = conn.recv(4096)
            if not data: break
            
            pkt = packet.decode(data)
            pkt_type = pkt.get("type")

            # ---------------- REGISTER ----------------
            if pkt_type == "register":
                response = register_user(pkt)
                response["type"] = "register_response"
                conn.send(packet.encode(response))

            # ---------------- LOGIN ----------------
            elif pkt_type == "login":
                user_id = login_user(pkt) # user_id เป็น string UUID
                if user_id:
                    online_users[user_id] = conn
                    print(f"[LOGIN] User {user_id} logged in.")
                    conn.send(packet.encode({
                        "type": "login_response", 
                        "status": "success",  # ใช้ success ให้ตรงกับที่ frontend เช็ค
                        "user_id": user_id, 
                        "username": pkt.get("username"), # ส่งชื่อกลับไปโชว์ด้วย
                        "message": "Login Success"
                    }))
                else:
                    conn.send(packet.encode({
                        "type": "login_response",
                        "status": "error", 
                        "message": "Login failed"
                    }))

            # ---------------- CREATE CONVERSATION ----------------
            elif pkt_type == "create_conversation":
                if user_id:
                    response = handle_create_conversation(pkt, user_id)
                    conn.send(packet.encode(response))
                else:
                    conn.send(packet.encode({"status": "error", "message": "Unauthorized"}))

            # ---------------- SEND MESSAGE (ตัวอย่าง) ----------------
            elif pkt_type == "send_message":
                # ต้องไปแก้ message_service ให้รองรับ UUID ก่อนเปิดใช้นะครับ
                # send_message_service(pkt, user_id, online_users)
                pass
            
            elif pkt["type"] == "update_user_id":
                result = change_custom_id(
                    pkt.get("user_id"),
                    pkt.get("new_id")
                )

                conn.send(packet.encode({
                    "type": "update_user_id_response",
                    "success": result
                }))




    except Exception as e:
        print(f"[EXCEPTION] {addr} disconnected: {e}")
    finally:
        if user_id and user_id in online_users:
            del online_users[user_id]
        conn.close()

while True:
    conn, addr = server.accept()
    thread = threading.Thread(target=handle_client, args=(conn, addr))
    thread.start()