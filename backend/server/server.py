#server/server.py
import socket
import threading
import os
from dotenv import load_dotenv
import json

from services.auth_service import login_user, register_user
from services.conversation_service import handle_create_conversation
from services.user_service import change_custom_id
from db import find_user_by_custom_id, send_friend_request, get_pending_requests, accept_friend_request
from services.message_service import (
    create_message_service,
    get_conversation_members_service
)

from services.friend_service import handle_get_friends,handle_start_direct_chat
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

                request_id = pkt.get("request_id")
                pkt_type = pkt.get("type")

                # ---------------- REGISTER ----------------
                if pkt_type == "register":
                    try:
                        response = register_user(pkt)
                    except Exception as e:
                        print(f"[EXC register_user] {traceback.format_exc()}")
                        response = {"status": "error", "message": "Server error during register"}

                    response["type"] = "register_response"
                    response["request_id"] = request_id   # ✅ เพิ่มบรรทัดนี้

                    conn.send(packet.encode(response))

                # ---------------- LOGIN ----------------
                elif pkt_type == "login":
                    try:
                        user = login_user(pkt)
                    except Exception as e:
                        print(f"[EXC login_user] {traceback.format_exc()}")
                        conn.send(packet.encode({
                            "type": "login_response",
                            "request_id": request_id,   # ✅ เพิ่ม
                            "status": "error",
                            "message": "Server error during login"
                        }))
                        continue

                    if user:
                        user_id = str(user["user_id"])
                        online_users[user_id] = conn

                        conn.send(packet.encode({
                            "type": "login_response",
                            "request_id": request_id,   # ✅ เพิ่ม
                            "status": "success",
                            "user_id": user_id,
                            "username": user["username"],
                            "custom_id": user.get("custom_id"),
                            "message": "Login Success"
                        }))
                    else:
                        conn.send(packet.encode({
                            "type": "login_response",
                            "request_id": request_id,   # ✅ เพิ่ม
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


                
                # ---------------- SEARCH USER ----------------
                elif pkt_type == "search_user":
                    target_id = pkt.get("target_id")
                    found_user = find_user_by_custom_id(target_id)

                    if found_user:
                        conn.send(packet.encode({
                            "type": "search_user_response",
                            "request_id": request_id, 
                            "status": "success",
                            "data": found_user
                        }))
                    else:
                        conn.send(packet.encode({
                            "type": "search_user_response",
                            "request_id": request_id,
                            "status": "error",
                            "message": "User not found"
                        }))

                # ---------------- SEND FRIEND REQUEST ----------------
                elif pkt_type == "send_friend_request":
                    target_custom_id = pkt.get("target_id") # รับเป็น Custom ID แทน UUID
                    
                    if user_id and target_custom_id:
                        result = send_friend_request(user_id, target_custom_id)
                        
                        conn.send(packet.encode({
                            "type": "send_friend_request_response",
                            "request_id": request_id,
                            "status": "success" if result["success"] else "error",
                            "message": result["message"]
                        }))
                    else:
                        conn.send(packet.encode({
                            "type": "error", "message": "Invalid data"
                        }))

                # ---------------- GET PENDING REQUESTS ----------------
                elif pkt_type == "get_pending_requests":
                    reqs = get_pending_requests(user_id)
                    conn.send(packet.encode({
                        "type": "get_pending_requests_response",
                        "request_id": request_id,
                        "status": "success",
                        "data": reqs
                    }))

                # ---------------- ACCEPT FRIEND ----------------
                elif pkt_type == "accept_friend":
                    sender_id = pkt.get("sender_id")
                    result = accept_friend_request(user_id, sender_id)
                    
                    conn.send(packet.encode({
                        "type": "accept_friend_response",
                        "request_id": request_id,
                        "status": "success" if result["success"] else "error",
                        "message": result["message"]
                    }))

                # ---------------- SEND MESSAGE ----------------
                elif pkt_type == "send_message":
                    conversation_id = pkt.get("conversation_id")
                    text = pkt.get("text")

                    if not user_id:
                        conn.send(packet.encode({
                            "type": "send_message_response",
                            "request_id": request_id,
                            "status": "error",
                            "message": "Unauthorized"
                        }))
                        continue

                    if not conversation_id or not text:
                        conn.send(packet.encode({
                            "type": "send_message_response",
                            "request_id": request_id,
                            "status": "error",
                            "message": "Invalid data"
                        }))
                        continue

                    try:
                        message = create_message_service(conversation_id, user_id, text)
                    except Exception as e:
                        conn.send(packet.encode({
                            "type": "send_message_response",
                            "request_id": request_id,
                            "status": "error",
                            "message": str(e)
                        }))
                        continue

                    # ✅ ส่ง response กลับไปหาคนที่กด send ก่อน
                    conn.send(packet.encode({
                        "type": "send_message_response",
                        "request_id": request_id,
                        "status": "success",
                        "message": message
                    }))

                    # ✅ แล้วค่อย broadcast ไปสมาชิกคนอื่น
                    members = get_conversation_members_service(conversation_id)

                    for member_id in members:
                        member_id = str(member_id)

                        if member_id in online_users:
                            try:
                                online_users[member_id].send(
                                    packet.encode({
                                        "type": "receive_message",
                                        "conversation_id": conversation_id,
                                        "message": message
                                    })
                                )
                            except:
                                pass
                # ---------------- GET MY CONVERSATIONS ----------------
                elif pkt_type == "get_my_conversations":
                    if not user_id:
                        conn.send(packet.encode({
                            "type": "get_my_conversations_response",
                            "request_id": request_id,
                            "status": "error",
                            "message": "Unauthorized"
                        }))
                        continue

                    try:
                        from services.conversation_service import get_user_conversations
                        conversations = get_user_conversations(user_id)

                        conn.send(packet.encode({
                            "type": "get_my_conversations_response",
                            "request_id": request_id,
                            "status": "success",
                            "data": conversations
                        }))
                    except Exception as e:
                        conn.send(packet.encode({
                            "type": "get_my_conversations_response",
                            "request_id": request_id,
                            "status": "error",
                            "message": str(e)
                        }))

                # ---------------- GET MESSAGES ----------------
                elif pkt_type == "get_messages":
                    conversation_id = pkt.get("conversation_id")

                    if not user_id:
                        conn.send(packet.encode({
                            "type": "get_messages_response",
                            "request_id": request_id,
                            "status": "error",
                            "message": "Unauthorized"
                        }))
                        continue

                    try:
                        from services.message_service import get_messages_by_conversation
                        messages = get_messages_by_conversation(conversation_id)

                        conn.send(packet.encode({
                            "type": "get_messages_response",
                            "request_id": request_id,
                            "status": "success",
                            "conversation_id": conversation_id,
                            "messages": messages
                        }))
                    except Exception as e:
                        conn.send(packet.encode({
                            "type": "get_messages_response",
                            "request_id": request_id,
                            "status": "error",
                            "message": str(e)
                        }))
                elif pkt_type == "open_direct":
                    friend_id = pkt.get("friend_id")
                    response = handle_start_direct_chat(user_id, friend_id)
                    response["request_id"] = request_id
                    conn.send(packet.encode(response))

                elif pkt_type == "get_friends":
                    response = handle_get_friends(user_id)
                    response["request_id"] = request_id
                    conn.send(packet.encode(response))

                elif pkt_type == "start_direct_chat":
                    response = handle_start_direct_chat(user_id, pkt["friend_id"])
                    response["request_id"] = request_id
                    conn.send(packet.encode(response))


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
