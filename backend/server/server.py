import socket
import threading
import os
from dotenv import load_dotenv
import json

from services.auth_service import login_user, register_user
from services.conversation_service import handle_create_conversation
from services.user_service import change_custom_id

import packet

load_dotenv()

online_users = {}

HOST = "0.0.0.0"
PORT = int(os.getenv("PORT", 8082))

server = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
server.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
server.bind((HOST, PORT))
server.listen()

print(f"Server started on {HOST}:{PORT}...")


def handle_client(conn, addr):
    print(f"[NEW CONNECTION] {addr} connected.")
    user_id = None

    try:
        while True:
            data = conn.recv(4096)
            if not data:
                break

            pkt = packet.decode(data)
            pkt_type = pkt.get("type")

            # ---------------- REGISTER ----------------
            if pkt_type == "register":
                response = register_user(pkt)
                response["type"] = "register_response"
                conn.send(packet.encode(response))

            # ---------------- LOGIN ----------------
            elif pkt_type == "login":

                user = login_user(pkt)

                if user:
                    user_id = str(user["user_id"])
                    online_users[user_id] = conn

                    conn.send(packet.encode({
                        "type": "login_response",
                        "status": "success",
                        "user_id": user_id,
                        "username": user["username"],
                        "custom_id": user.get("custom_id"),
                        "message": "Login Success"
                    }))

                else:
                    conn.send(packet.encode({
                        "type": "login_response",
                        "status": "error",
                        "message": "Login failed"
                    }))


            # ---------------- UPDATE CUSTOM ID ----------------
            elif pkt_type == "update_user_id":

                result = change_custom_id(
                    pkt.get("user_id"),
                    pkt.get("new_id")
                )

                response = {
                    "type": "update_user_id_response",
                    "success": result.get("success", False),
                    "message": result.get("message", "")
                }

                conn.send(packet.encode(response))

            # ---------------- CREATE CONVERSATION ----------------
            elif pkt_type == "create_conversation":
                if user_id:
                    response = handle_create_conversation(pkt, user_id)
                    conn.send(packet.encode(response))
                else:
                    conn.send(packet.encode({
                        "status": "error",
                        "message": "Unauthorized"
                    }))

            # ---------------- SEND MESSAGE ----------------
            elif pkt_type == "send_message":
                pass

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
