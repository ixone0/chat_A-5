import socket
import threading
import os
from dotenv import load_dotenv
import json

from services.auth_service import login_user, register_user
from services.conversation_service import handle_create_conversation
from services.user_service import change_custom_id

import packet

import traceback
import sys

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
            try:
                data = conn.recv(4096)
                if not data:
                    print(f"[INFO] {addr} closed connection (no data).")
                    break

                # debug: แสดง raw data เพื่อยืนยันว่าได้รับอะไร
                print(f"[RAW DATA] from {addr}: {data!r}")

                try:
                    pkt = packet.decode(data)
                except Exception as e:
                    print(f"[ERROR] Failed to decode packet from {addr}: {e}")
                    # ส่ง response แจ้ง error แล้ว continue
                    conn.send(packet.encode({
                        "type": "error",
                        "message": "Invalid packet format"
                    }))
                    continue

                print(f"[PKT] {addr}: {pkt}")

                pkt_type = pkt.get("type")

                # ---------------- REGISTER ----------------
                if pkt_type == "register":
                    try:
                        response = register_user(pkt)
                    except Exception as e:
                        print(f"[EXC register_user] {traceback.format_exc()}")
                        response = {"status": "error", "message": "Server error during register"}
                    response["type"] = "register_response"
                    conn.send(packet.encode(response))

                # ---------------- LOGIN ----------------
                elif pkt_type == "login":
                    try:
                        user = login_user(pkt)
                    except Exception as e:
                        # จับ error จาก DB / bcrypt ฯลฯ แล้วตอบกลับ client แทนปิด connection เงียบๆ
                        print(f"[EXC login_user] {traceback.format_exc()}")
                        conn.send(packet.encode({
                            "type": "login_response",
                            "status": "error",
                            "message": "Server error during login"
                        }))
                        # ไม่ break — รอคำสั่งต่อไปหรือ client ปิด
                        continue

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
                    try:
                        result = change_custom_id(
                            pkt.get("user_id"),
                            pkt.get("new_id")
                        )
                        response = {
                            "type": "update_user_id_response",
                            "success": result.get("success", False),
                            "message": result.get("message", "")
                        }
                    except Exception:
                        print(f"[EXC update_user_id] {traceback.format_exc()}")
                        response = {
                            "type": "update_user_id_response",
                            "success": False,
                            "message": "Server error"
                        }
                    conn.send(packet.encode(response))

                # ---------------- CREATE CONVERSATION ----------------
                elif pkt_type == "create_conversation":
                    if user_id:
                        try:
                            response = handle_create_conversation(pkt, user_id)
                        except Exception:
                            print(f"[EXC create_conversation] {traceback.format_exc()}")
                            response = {"status": "error", "message": "Server error"}
                        conn.send(packet.encode(response))
                    else:
                        conn.send(packet.encode({
                            "status": "error",
                            "message": "Unauthorized"
                        }))

                # ---------------- SEND MESSAGE ----------------
                elif pkt_type == "send_message":
                    pass

                else:
                    conn.send(packet.encode({
                        "type": "error",
                        "message": "Unknown packet type"
                    }))

            except ConnectionResetError:
                print(f"[CONN RESET] {addr}")
                break
            except Exception as e:
                # ถ้าเกิด exception ภายใน loop ที่ไม่ได้ถูกจับข้างบน
                print(f"[UNHANDLED IN LOOP] {addr}: {traceback.format_exc()}")
                # พยายามส่ง error response ถ้าเป็นไปได้
                try:
                    conn.send(packet.encode({
                        "type": "error",
                        "message": "Internal server error"
                    }))
                except Exception:
                    pass
                break

    except Exception as e:
        print(f"[EXCEPTION] {addr} disconnected: {e}")
        print(traceback.format_exc())

    finally:
        if user_id and user_id in online_users:
            del online_users[user_id]

        conn.close()
        print(f"[CLOSED] connection with {addr}")


while True:
    conn, addr = server.accept()
    thread = threading.Thread(target=handle_client, args=(conn, addr))
    thread.start()
