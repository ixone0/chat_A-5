# server/server.py
import socket
import threading
import os
from dotenv import load_dotenv
import json

from services.auth_service import login_user, register_user
from services.conversation_service import handle_create_conversation, get_user_conversations
from services.user_service import change_custom_id
from db import find_user_by_custom_id, send_friend_request, get_pending_requests, accept_friend_request
from services.message_service import (
    create_message_service,
    get_conversation_members_service
)
from services.call_service import (
    start_call_service,
    join_call_service,
    leave_call_service,
    end_call_service
)
from services.friend_service import handle_get_friends, handle_start_direct_chat
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


def send_packet(conn, data: dict):
    """
    Helper: encode packet and send with newline delimiter.
    Uses conn.sendall to ensure full send.
    """
    try:
        # packet.encode should return bytes
        encoded = packet.encode(data) + b"\n"
        conn.sendall(encoded)
    except Exception as e:
        # don't raise here (caller may be in network handling)
        print(f"[SEND ERROR] {e}")


def handle_client(conn, addr):
    print(f"[NEW CONNECTION] {addr} connected.")
    user_id = None
    buffer = b""  # buffer for incoming bytes (framing by newline)

    try:
        while True:
            try:
                data = conn.recv(4096)
                if not data:
                    print(f"[INFO] {addr} closed connection (no data).")
                    break

                # append to buffer and process any full packets separated by '\n'
                buffer += data

                # debug: show raw bytes chunk received (optional, can be noisy)
                print(f"[RAW CHUNK] from {addr}: {data!r}")

                # process all complete packets
                while b"\n" in buffer:
                    raw_packet, buffer = buffer.split(b"\n", 1)

                    if not raw_packet.strip():
                        continue

                    # debug raw packet
                    print(f"[RAW PACKET] {addr}: {raw_packet!r}")

                    try:
                        pkt = packet.decode(raw_packet)
                    except Exception as e:
                        print(f"[ERROR] Failed to decode packet from {addr}: {e}")
                        send_packet(conn, {
                            "type": "error",
                            "message": "Invalid packet format"
                        })
                        # continue to next packet (if any)
                        continue

                    print(f"[PKT] {addr}: {pkt}")

                    request_id = pkt.get("request_id")
                    pkt_type = pkt.get("type")
                    print("HANDLING TYPE:", pkt_type)
                    # ---------------- REGISTER ----------------
                    if pkt_type == "register":
                        try:
                            response = register_user(pkt)
                        except Exception:
                            print(f"[EXC register_user] {traceback.format_exc()}")
                            response = {"status": "error", "message": "Server error during register"}

                        response["type"] = "register_response"
                        response["request_id"] = request_id
                        send_packet(conn, response)

                    # ---------------- LOGIN ----------------
                    elif pkt_type == "login":
                        try:
                            user = login_user(pkt)
                        except Exception:
                            print(f"[EXC login_user] {traceback.format_exc()}")
                            send_packet(conn, {
                                "type": "login_response",
                                "request_id": request_id,
                                "status": "error",
                                "message": "Server error during login"
                            })
                            continue

                        if user:
                            user_id = str(user["user_id"])
                            online_users[user_id] = conn

                            send_packet(conn, {
                                "type": "login_response",
                                "request_id": request_id,
                                "status": "success",
                                "user_id": user_id,
                                "username": user["username"],
                                "custom_id": user.get("custom_id"),
                                "message": "Login Success"
                            })
                        else:
                            send_packet(conn, {
                                "type": "login_response",
                                "request_id": request_id,
                                "status": "error",
                                "message": "Login failed"
                            })

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
                        send_packet(conn, response)

                    # ---------------- CREATE CONVERSATION ----------------
                    elif pkt_type == "create_conversation":
                        if user_id:
                            try:
                                response = handle_create_conversation(pkt, user_id)
                            except Exception:
                                print(f"[EXC create_conversation] {traceback.format_exc()}")
                                response = {"status": "error", "message": "Server error"}
                            send_packet(conn, response)
                        else:
                            send_packet(conn, {
                                "status": "error",
                                "message": "Unauthorized"
                            })

                    # ---------------- SEARCH USER ----------------
                    elif pkt_type == "search_user":
                        target_id = pkt.get("target_id")
                        try:
                            found_user = find_user_by_custom_id(target_id)
                        except Exception:
                            found_user = None

                        if found_user:
                            send_packet(conn, {
                                "type": "search_user_response",
                                "request_id": request_id,
                                "status": "success",
                                "data": found_user
                            })
                        else:
                            send_packet(conn, {
                                "type": "search_user_response",
                                "request_id": request_id,
                                "status": "error",
                                "message": "User not found"
                            })

                    # ---------------- SEND FRIEND REQUEST ----------------
                    elif pkt_type == "send_friend_request":
                        target_custom_id = pkt.get("target_id")  # รับเป็น Custom ID แทน UUID

                        if user_id and target_custom_id:
                            try:
                                result = send_friend_request(user_id, target_custom_id)
                                status_ok = result.get("success", False)
                                message = result.get("message", "")
                            except Exception as e:
                                status_ok = False
                                message = str(e)

                            send_packet(conn, {
                                "type": "send_friend_request_response",
                                "request_id": request_id,
                                "status": "success" if status_ok else "error",
                                "message": message
                            })
                        else:
                            send_packet(conn, {
                                "type": "error",
                                "message": "Invalid data"
                            })

                    # ---------------- GET PENDING REQUESTS ----------------
                    elif pkt_type == "get_pending_requests":
                        try:
                            reqs = get_pending_requests(user_id)
                            send_packet(conn, {
                                "type": "get_pending_requests_response",
                                "request_id": request_id,
                                "status": "success",
                                "data": reqs
                            })
                        except Exception as e:
                            send_packet(conn, {
                                "type": "get_pending_requests_response",
                                "request_id": request_id,
                                "status": "error",
                                "message": str(e)
                            })

                    # ---------------- ACCEPT FRIEND ----------------
                    elif pkt_type == "accept_friend":
                        sender_id = pkt.get("sender_id")
                        try:
                            result = accept_friend_request(user_id, sender_id)
                            send_packet(conn, {
                                "type": "accept_friend_response",
                                "request_id": request_id,
                                "status": "success" if result.get("success", False) else "error",
                                "message": result.get("message", "")
                            })
                        except Exception as e:
                            send_packet(conn, {
                                "type": "accept_friend_response",
                                "request_id": request_id,
                                "status": "error",
                                "message": str(e)
                            })

                    # ---------------- SEND MESSAGE ----------------
                    elif pkt_type == "send_message":
                        conversation_id = pkt.get("conversation_id")
                        text = pkt.get("text")

                        if not user_id:
                            send_packet(conn, {
                                "type": "send_message_response",
                                "request_id": request_id,
                                "status": "error",
                                "message": "Unauthorized"
                            })
                            continue

                        if not conversation_id or not text:
                            send_packet(conn, {
                                "type": "send_message_response",
                                "request_id": request_id,
                                "status": "error",
                                "message": "Invalid data"
                            })
                            continue

                        try:
                            message = create_message_service(conversation_id, user_id, text)
                        except Exception as e:
                            send_packet(conn, {
                                "type": "send_message_response",
                                "request_id": request_id,
                                "status": "error",
                                "message": str(e)
                            })
                            continue

                        # ส่ง response กลับไปหาคนที่กด send ก่อน
                        send_packet(conn, {
                            "type": "send_message_response",
                            "request_id": request_id,
                            "status": "success",
                            "message": message
                        })

                        # แล้ว broadcast ไปสมาชิกคนอื่น
                        try:
                            members = get_conversation_members_service(conversation_id)
                        except Exception:
                            members = []

                        for member_id in members:
                            member_id = str(member_id)
                            if member_id in online_users:
                                try:
                                    send_packet(online_users[member_id], {
                                        "type": "receive_message",
                                        "conversation_id": conversation_id,
                                        "message": message
                                    })
                                except Exception:
                                    # ignore send errors to specific clients
                                    pass

                    # ---------------- GET MY CONVERSATIONS ----------------
                                        # ---------------- GET MY CONVERSATIONS ----------------
                    elif pkt_type == "get_my_conversations":
                        # ถ้าไม่ล็อกอิน
                        if not user_id:
                            send_packet(conn, {
                                "type": "get_my_conversations_response",
                                "request_id": request_id,
                                "status": "error",
                                "message": "Unauthorized"
                            })
                            continue

                        try:
                            conversations = get_user_conversations(user_id)

                            send_packet(conn, {
                                "type": "get_my_conversations_response",
                                "request_id": request_id,
                                "status": "success",
                                "data": conversations
                            })
                        except Exception as e:
                            print(f"[EXC get_my_conversations] {traceback.format_exc()}")
                            send_packet(conn, {
                                "type": "get_my_conversations_response",
                                "request_id": request_id,
                                "status": "error",
                                "message": str(e)
                            })


                    # ---------------- GET MESSAGES ----------------
                    elif pkt_type == "get_messages":
                        conversation_id = pkt.get("conversation_id")

                        if not user_id:
                            send_packet(conn, {
                                "type": "get_messages_response",
                                "request_id": request_id,
                                "status": "error",
                                "message": "Unauthorized"
                            })
                            continue

                        try:
                            from services.message_service import get_messages_by_conversation
                            messages = get_messages_by_conversation(conversation_id)

                            send_packet(conn, {
                                "type": "get_messages_response",
                                "request_id": request_id,
                                "status": "success",
                                "conversation_id": conversation_id,
                                "messages": messages
                            })
                        except Exception as e:
                            send_packet(conn, {
                                "type": "get_messages_response",
                                "request_id": request_id,
                                "status": "error",
                                "message": str(e)
                            })

                    # ---------------- OPEN DIRECT / START DIRECT CHAT ----------------
                    elif pkt_type == "open_direct" or pkt_type == "start_direct_chat":
                        friend_id = pkt.get("friend_id")
                        try:
                            response = handle_start_direct_chat(user_id, friend_id)
                            response["request_id"] = request_id
                            send_packet(conn, response)
                        except Exception as e:
                            send_packet(conn, {
                                "type": "start_direct_chat_response",
                                "request_id": request_id,
                                "status": "error",
                                "message": str(e)
                            })

                    # ---------------- GET FRIENDS ----------------
                    elif pkt_type == "get_friends":
                        try:
                            response = handle_get_friends(user_id)
                            response["request_id"] = request_id
                            send_packet(conn, response)
                        except Exception as e:
                            send_packet(conn, {
                                "type": "friends_list",
                                "request_id": request_id,
                                "status": "error",
                                "message": str(e)
                            })
                            
                    elif pkt_type == "start_call":
                        try:
                            response = start_call_service(pkt, user_id)
                            response["request_id"] = request_id
                            send_packet(conn, response)
                        except Exception as e:
                            send_packet(conn, {
                                "type": "start_call_response",
                                "status": "error",
                                "message": str(e)
                            })
                            
                    elif pkt_type == "join_call":
                        try:
                            response = join_call_service(pkt, user_id)
                            response["request_id"] = request_id
                            send_packet(conn, response)
                        except Exception as e:
                            send_packet(conn, {
                                "type": "join_call_response",
                                "status": "error",
                                "message": str(e)
                            })
                    
                    elif pkt_type == "leave_call":
                        try:
                            response = leave_call_service(pkt, user_id)
                            response["request_id"] = request_id
                            send_packet(conn, response)
                        except Exception as e:
                            send_packet(conn, {
                                "type": "leave_call_response",
                                "status": "error",
                                "message": str(e)
                            })

                    elif pkt_type == "end_call":
                        try:
                            response = end_call_service(pkt, user_id)
                            response["request_id"] = request_id
                            send_packet(conn, response)
                        except Exception as e:
                            send_packet(conn, {
                                "type": "end_call_response",
                                "status": "error",
                                "message": str(e)
                            })
                    else:
                        send_packet(conn, {
                            "type": "error",
                            "message": "Unknown packet type",
                            "request_id": request_id
                        })

            except ConnectionResetError:
                print(f"[CONN RESET] {addr}")
                break
            except Exception as e:
                # ถ้าเกิด exception ภายใน loop ที่ไม่ได้ถูกจับข้างบน
                print(f"[UNHANDLED IN LOOP] {addr}: {traceback.format_exc()}")
                # พยายามส่ง error response ถ้าเป็นไปได้
                try:
                    send_packet(conn, {
                        "type": "error",
                        "message": "Internal server error"
                    })
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
