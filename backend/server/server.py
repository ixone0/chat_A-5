# server/server.py
import socket
import threading
import os
from dotenv import load_dotenv
import json
import traceback

from services.auth_service import login_user, register_user
from services.conversation_service import handle_create_conversation, get_user_conversations
from services.user_service import change_custom_id
from db import find_user_by_custom_id, send_friend_request, get_pending_requests, accept_friend_request
from services.message_service import (
    create_message_service,
    get_conversation_members_service
)
from services.s3_service import upload_file_to_s3
from repository.attachment_repo import insert_attachment
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
from state.online_users import online_users

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
                            member_id_str = str(member_id)
                            if member_id_str in online_users:
                                try:
                                    send_packet(online_users[member_id_str], {
                                        "type": "receive_message",
                                        "conversation_id": conversation_id,
                                        "message": message
                                    })
                                except Exception:
                                    # ignore send errors to specific clients
                                    pass

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
                    # ---------------- SEND FILE ----------------
                    elif pkt_type == "send_file":
                        if not user_id:
                            send_packet(conn, {
                                "type": "send_file_response",
                                "request_id": request_id,
                                "status": "error",
                                "message": "Unauthorized"
                            })
                            continue

                        conversation_id = pkt.get("conversation_id")
                        file_name       = pkt.get("file_name", "file")
                        mime_type       = pkt.get("mime_type", "application/octet-stream")
                        b64_data        = pkt.get("data", "")

                        if not conversation_id or not b64_data:
                            send_packet(conn, {
                                "type": "send_file_response",
                                "request_id": request_id,
                                "status": "error",
                                "message": "Missing conversation_id or file data"
                            })
                            continue

                        try:
                            # 1. Upload ไฟล์ขึ้น S3
                            s3_result = upload_file_to_s3(
                                b64_data, file_name, mime_type, user_id
                            )

                            # 2. สร้าง message ใน DB
                            result = create_message_service(
                                conversation_id, user_id,
                                content=s3_result["file_url"],
                            )

                            if result.get("status") != "success":
                                raise Exception(result.get("message", "Failed to create message"))

                            # ดึง message dict จากข้างใน result
                            msg_data = result.get("message", {})

                            print("[DEBUG] msg_data:", msg_data)

                            # 3. override msg_type เป็น file
                            msg_data["msg_type"] = "file"

                            # 4. บันทึก attachment metadata
                            attachment = insert_attachment(
                                message_id=str(msg_data["id"]),
                                file_name=file_name,
                                s3_key=s3_result["s3_key"],
                                file_url=s3_result["file_url"],
                                mime_type=mime_type,
                                file_size=s3_result["file_size"]
                            )

                            msg_data["attachment"] = attachment

                            # 5. ตอบกลับ sender
                            send_packet(conn, {
                                "type": "send_file_response",
                                "request_id": request_id,
                                "status": "success",
                                "message": msg_data
                            })

                            # 6. Broadcast ไปสมาชิกในห้อง
                            try:
                                members = get_conversation_members_service(conversation_id)
                            except Exception:
                                members = []

                            for member_id in members:
                                member_id = str(member_id)
                                if member_id != user_id and member_id in online_users:
                                    try:
                                        send_packet(online_users[member_id], {
                                            "type": "receive_message",
                                            "conversation_id": conversation_id,
                                            "message": msg_data
                                        })
                                    except Exception:
                                        pass

                        except ValueError as ve:
                            send_packet(conn, {
                                "type": "send_file_response",
                                "request_id": request_id,
                                "status": "error",
                                "message": str(ve)
                            })
                        except Exception:
                            print(f"[EXC send_file] {traceback.format_exc()}")
                            send_packet(conn, {
                                "type": "send_file_response",
                                "request_id": request_id,
                                "status": "error",
                                "message": "Server error during file upload"
                            })

                    # ---------------- GET FRIENDS ----------------
                    elif pkt_type == "get_friends":
                        try:
                            response = handle_get_friends(user_id)
                            response["request_id"] = request_id
                            # Attach online status to each friend
                            if response.get("status") == "success":
                                friends_list = response.get("friends") or response.get("data") or []
                                for f in friends_list:
                                    f["is_online"] = str(f.get("id", "")) in online_users
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
                            print("START CALL")
                            call = start_call_service(pkt, user_id)   # อาจขว้าง exception
                            call_id = call["call_id"]
                            conversation_id = pkt["conversation_id"]
                            print("CALL ID:", call_id)

                            # ตอบกลับ caller ว่าสร้าง call สำเร็จ
                            send_packet(conn, {
                                "type": "start_call_response",
                                "request_id": request_id,
                                "status": "ok",
                                "call_id": call_id,
                                "conversation_id": conversation_id
                            })

                            # ส่ง event ไปหาสมาชิก
                            members = get_conversation_members_service(conversation_id)

                            for m in members:
                                target_id = str(m)
                                if target_id == user_id:
                                    continue
                                callee_conn = online_users.get(target_id)
                                if not callee_conn:
                                    print(f"user {target_id} not online")
                                    continue

                                payload = {
                                    "type": "incoming_call",
                                    "call_id": call_id,
                                    "conversation_id": conversation_id,
                                    "from_user": user_id,        # ใช้ชื่อฟิลด์ให้ชัดเจน/คงที่
                                    "call_type": pkt.get("call_type", "voice")
                                }
                                try:
                                    send_packet(callee_conn, payload)
                                except Exception as e:
                                    # แยก logging ให้ชัดเจน ถ้าการส่งล้มเหลว อย่าให้ทั้ง handler ล่ม
                                    print(f"Failed to send incoming_call to {target_id}: {e}")
                                    # อาจจะ mark user offline หรือลบจาก online_users
                                    try:
                                        callee_conn.close()
                                    except Exception:
                                        pass
                                    online_users.pop(target_id, None)

                        except Exception as e:
                            import traceback
                            traceback.print_exc()
                            send_packet(conn, {
                                "type": "error",
                                "request_id": request_id,
                                "message": "Internal server error",
                                "detail": str(e)   # ใน dev ให้ใส่ detail แต่ใน production ระวังความลับ
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
                            
                    elif pkt_type == "webrtc_offer":
                        call_id = pkt.get("call_id")
                        offer = pkt.get("offer")

                        print("[RELAY OFFER] Received offer:", call_id)
                        print(f"[RELAY OFFER] Sender user_id: {user_id}")

                        # 🔥 หาอีกฝั่ง
                        conversation_id = pkt.get("conversation_id")
                        call_type = pkt.get("call_type", "audio")  # ✅ Get call type
                        print(f"[RELAY OFFER] Conversation ID: {conversation_id}, Call Type: {call_type}")
                        
                        try:
                            members = get_conversation_members_service(conversation_id)
                            print(f"[RELAY OFFER] Members: {members}")
                            print(f"[RELAY OFFER] Online users: {list(online_users.keys())}")

                            for user in members:
                                print(f"[RELAY OFFER] Checking user {user}: is_not_sender={user != user_id}, is_online={user in online_users}")
                                if user != user_id and user in online_users:
                                    print(f"[RELAY OFFER] >>> Sending offer to user {user}")
                                    send_packet(online_users[user], {
                                        "type": "webrtc_offer",
                                        "call_id": call_id,
                                        "offer": offer,
                                        "conversation_id": conversation_id,
                                        "call_type": call_type  # ✅ Include call type
                                    })
                                    print(f"[RELAY OFFER] >>> Sent to {user}")
                            print("[RELAY OFFER] Done relaying")
                        except Exception as e:
                            print(f"[ERROR RELAY OFFER] {traceback.format_exc()}")
                    elif pkt_type == "webrtc_answer":
                        call_id = pkt.get("call_id")
                        answer = pkt.get("answer")
                        conversation_id = pkt.get("conversation_id")
                        print(f"[RELAY ANSWER] Received answer: {call_id}, sender: {user_id}")

                        try:
                            members = get_conversation_members_service(conversation_id)
                            print(f"[RELAY ANSWER] Members: {members}, Online: {list(online_users.keys())}")

                            for user in members:
                                print(f"[RELAY ANSWER] Checking user {user}: is_not_sender={user != user_id}, is_online={user in online_users}")
                                if user != user_id and user in online_users:
                                    print(f"[RELAY ANSWER] >>> Sending answer to user {user}")
                                    send_packet(online_users[user], {
                                        "type": "webrtc_answer",
                                        "call_id": call_id,
                                        "answer": answer
                                    })
                            print("[RELAY ANSWER] Done relaying")
                        except Exception as e:
                            print(f"[ERROR RELAY ANSWER] {traceback.format_exc()}")
                                
                    elif pkt_type == "ice_candidate":
                        call_id = pkt.get("call_id")
                        candidate = pkt.get("candidate")
                        conversation_id = pkt.get("conversation_id")
                        print(f"[RELAY ICE] Received candidate for call {call_id}, sender: {user_id}")

                        try:
                            members = get_conversation_members_service(conversation_id)
                            print(f"[RELAY ICE] Members: {members}")

                            for user in members:
                                if user != user_id and user in online_users:
                                    print(f"[RELAY ICE] Sending candidate to {user}")
                                    send_packet(online_users[user], {
                                        "type": "ice_candidate",
                                        "call_id": call_id,
                                        "candidate": candidate
                                    })
                        except Exception as e:
                            print(f"[ERROR RELAY ICE] {traceback.format_exc()}")

                    # ============ CREATE GROUP CHAT (NEW) ============
                    elif pkt_type == "create_group_chat":
                        if not user_id:
                            send_packet(conn, {
                                "type": "create_group_chat_response",
                                "request_id": request_id,
                                "status": "error",
                                "message": "Unauthorized"
                            })
                            continue
                            
                        try:
                            from services.conversation_service import handle_create_group_chat
                            result = handle_create_group_chat(pkt, user_id)
                            result["request_id"] = request_id
                            
                            # 1. ตอบกลับคนสร้างว่า "สร้างสำเร็จแล้ว"
                            send_packet(conn, result)
                            
                            # 2. 🔥 แจ้งเตือนเพื่อนทุกคนที่ถูกดึงเข้ากลุ่ม (Real-time Broadcast)
                            if result.get("status") == "success":
                                conv_id = result.get("conversation_id")
                                members = result.get("members", [])
                                title = result.get("title", "")
                                
                                for member_id in members:
                                    member_id_str = str(member_id)
                                    # ข้ามคนสร้าง เพราะเพิ่งส่งตอบกลับไปด้านบน
                                    if member_id_str != user_id and member_id_str in online_users:
                                        try:
                                            send_packet(online_users[member_id_str], {
                                                "type": "new_group_notification",
                                                "conversation_id": conv_id,
                                                "title": title,
                                                "message": f"You were added to a new group: {title}"
                                            })
                                        except Exception:
                                            pass
                        except Exception as e:
                            import traceback
                            print(f"[EXC create_group_chat] {traceback.format_exc()}")
                            send_packet(conn, {
                                "type": "create_group_chat_response",
                                "request_id": request_id,
                                "status": "error",
                                "message": str(e)
                            })

                    # ============ RENAME GROUP (ปรับปรุงเพิ่มการเช็คสิทธิ์) ============
                    elif pkt_type == "rename_group":
                        conv_id = pkt.get("conversation_id")
                        new_title = pkt.get("new_title")
                        
                        if not user_id: # เช็คว่า login หรือยัง
                            send_packet(conn, {"type": "rename_group_response", "status": "error", "message": "Unauthorized"})
                            continue

                        try:
                            from repository.conversation_repo import update_conversation_title_db, get_user_conversations_db
                            
                            # 🛡️ เช็คก่อนว่าคนที่ส่งมา เป็น Owner ของห้องนี้จริงไหม?
                            user_convs = get_user_conversations_db(user_id)
                            is_owner = any(c['id'] == conv_id and c['role'] == 'owner' for c in user_convs)
                            
                            if not is_owner:
                                send_packet(conn, {"type": "rename_group_response", "status": "error", "message": "Only owner can rename group"})
                                continue

                            success = update_conversation_title_db(conv_id, new_title)
                            
                            if success:
                                # ตอบกลับคนเปลี่ยน
                                send_packet(conn, {"type": "rename_group_response", "request_id": request_id, "status": "success", "new_title": new_title})
                                
                                # Broadcast บอกทุกคน
                                members = get_conversation_members_service(conv_id)
                                for m_id in members:
                                    m_id_str = str(m_id)
                                    if m_id_str in online_users:
                                        send_packet(online_users[m_id_str], {
                                            "type": "group_renamed_notification",
                                            "conversation_id": conv_id,
                                            "new_title": new_title
                                        })
                            else:
                                send_packet(conn, {"type": "rename_group_response", "status": "error", "message": "Update failed"})
                        except Exception as e:
                            send_packet(conn, {"type": "rename_group_response", "status": "error", "message": str(e)})

                    # ============ GET GROUP MEMBERS ============
                    elif pkt_type == "get_group_members":
                        conv_id = pkt.get("conversation_id")
                        if not user_id:
                            send_packet(conn, {"type": "get_group_members_response", "request_id": request_id, "status": "error", "message": "Unauthorized"})
                            continue
                        try:
                            from repository.conversation_repo import get_group_members_detail_db
                            members_detail = get_group_members_detail_db(conv_id)
                            send_packet(conn, {
                                "type": "get_group_members_response",
                                "request_id": request_id,
                                "status": "success",
                                "conversation_id": conv_id,
                                "members": members_detail
                            })
                        except Exception as e:
                            send_packet(conn, {"type": "get_group_members_response", "request_id": request_id, "status": "error", "message": str(e)})

                    # ============ ADD GROUP MEMBERS (Owner/Admin) ============
                    elif pkt_type == "add_group_members":
                        conv_id = pkt.get("conversation_id")
                        new_members = pkt.get("members", [])
                        if not user_id:
                            send_packet(conn, {"type": "add_group_members_response", "request_id": request_id, "status": "error", "message": "Unauthorized"})
                            continue
                        try:
                            from repository.conversation_repo import is_conversation_admin_or_owner, add_members_to_group_db
                            if not is_conversation_admin_or_owner(conv_id, user_id):
                                send_packet(conn, {"type": "add_group_members_response", "request_id": request_id, "status": "error", "message": "Only owner/admin can add members"})
                                continue

                            added = add_members_to_group_db(conv_id, new_members)
                            send_packet(conn, {
                                "type": "add_group_members_response",
                                "request_id": request_id,
                                "status": "success",
                                "conversation_id": conv_id,
                                "added_members": added
                            })

                            # System message
                            if added:
                                try:
                                    from repository.message_repo import insert_system_message
                                    insert_system_message(conv_id, f"{len(added)} member(s) were added to the group")
                                except Exception:
                                    pass

                            # Broadcast แจ้งคนที่ถูกเพิ่ม
                            for member_id in added:
                                m_str = str(member_id)
                                if m_str in online_users:
                                    try:
                                        send_packet(online_users[m_str], {
                                            "type": "new_group_notification",
                                            "conversation_id": conv_id,
                                            "message": "You were added to a group"
                                        })
                                    except Exception:
                                        pass

                            # Broadcast แจ้งสมาชิกเดิม
                            existing_members = get_conversation_members_service(conv_id)
                            for m_id in existing_members:
                                m_str = str(m_id)
                                if m_str != user_id and m_str not in [str(a) for a in added] and m_str in online_users:
                                    try:
                                        send_packet(online_users[m_str], {
                                            "type": "member_added_notification",
                                            "conversation_id": conv_id,
                                            "added_members": added
                                        })
                                    except Exception:
                                        pass

                        except Exception as e:
                            send_packet(conn, {"type": "add_group_members_response", "request_id": request_id, "status": "error", "message": str(e)})

                    # ============ KICK GROUP MEMBER (Owner/Admin) ============
                    elif pkt_type == "kick_group_member":
                        conv_id = pkt.get("conversation_id")
                        target_id = pkt.get("target_user_id")
                        if not user_id:
                            send_packet(conn, {"type": "kick_group_member_response", "request_id": request_id, "status": "error", "message": "Unauthorized"})
                            continue
                        try:
                            from repository.conversation_repo import is_conversation_admin_or_owner, remove_member_from_group_db
                            if not is_conversation_admin_or_owner(conv_id, user_id):
                                send_packet(conn, {"type": "kick_group_member_response", "request_id": request_id, "status": "error", "message": "Only owner/admin can kick members"})
                                continue
                            if str(target_id) == str(user_id):
                                send_packet(conn, {"type": "kick_group_member_response", "request_id": request_id, "status": "error", "message": "Cannot kick yourself"})
                                continue

                            success = remove_member_from_group_db(conv_id, target_id)
                            if success:
                                send_packet(conn, {
                                    "type": "kick_group_member_response",
                                    "request_id": request_id,
                                    "status": "success",
                                    "conversation_id": conv_id,
                                    "kicked_user_id": target_id
                                })

                                # System message
                                try:
                                    from repository.message_repo import insert_system_message
                                    insert_system_message(conv_id, "A member was removed from the group")
                                except Exception:
                                    pass

                                # แจ้งคนที่ถูกเตะ
                                t_str = str(target_id)
                                if t_str in online_users:
                                    try:
                                        send_packet(online_users[t_str], {
                                            "type": "member_kicked_notification",
                                            "conversation_id": conv_id,
                                            "kicked_user_id": target_id,
                                            "message": "You were removed from the group"
                                        })
                                    except Exception:
                                        pass

                                # แจ้งสมาชิกที่เหลือ
                                remaining = get_conversation_members_service(conv_id)
                                for m_id in remaining:
                                    m_str = str(m_id)
                                    if m_str != user_id and m_str in online_users:
                                        try:
                                            send_packet(online_users[m_str], {
                                                "type": "member_kicked_notification",
                                                "conversation_id": conv_id,
                                                "kicked_user_id": target_id
                                            })
                                        except Exception:
                                            pass
                            else:
                                send_packet(conn, {"type": "kick_group_member_response", "request_id": request_id, "status": "error", "message": "Failed to kick member"})
                        except Exception as e:
                            send_packet(conn, {"type": "kick_group_member_response", "request_id": request_id, "status": "error", "message": str(e)})

                    # ============ TYPING INDICATOR (Relay Only) ============
                    elif pkt_type == "typing":
                        conv_id = pkt.get("conversation_id")
                        if user_id and conv_id:
                            try:
                                members = get_conversation_members_service(conv_id)
                                for m_id in members:
                                    m_str = str(m_id)
                                    if m_str != user_id and m_str in online_users:
                                        try:
                                            send_packet(online_users[m_str], {
                                                "type": "typing_indicator",
                                                "conversation_id": conv_id,
                                                "user_id": user_id
                                            })
                                        except Exception:
                                            pass
                            except Exception:
                                pass

                    # ============ LEAVE GROUP (Member Only) ============
                    elif pkt_type == "leave_group":
                        conv_id = pkt.get("conversation_id")
                        if not user_id:
                            send_packet(conn, {"type": "leave_group_response", "request_id": request_id, "status": "error", "message": "Unauthorized"})
                            continue
                        try:
                            from repository.conversation_repo import is_conversation_owner, leave_group_db
                            if is_conversation_owner(conv_id, user_id):
                                send_packet(conn, {"type": "leave_group_response", "request_id": request_id, "status": "error", "message": "Owner cannot leave. Transfer ownership first or delete the group."})
                                continue
                            success = leave_group_db(conv_id, user_id)
                            if success:
                                send_packet(conn, {"type": "leave_group_response", "request_id": request_id, "status": "success", "conversation_id": conv_id})
                                # System message
                                try:
                                    from repository.message_repo import insert_system_message
                                    insert_system_message(conv_id, "A member left the group")
                                except Exception:
                                    pass
                                # แจ้งสมาชิกที่เหลือ
                                remaining = get_conversation_members_service(conv_id)
                                for m_id in remaining:
                                    m_str = str(m_id)
                                    if m_str in online_users:
                                        try:
                                            send_packet(online_users[m_str], {
                                                "type": "member_left_notification",
                                                "conversation_id": conv_id,
                                                "left_user_id": user_id
                                            })
                                        except Exception:
                                            pass
                            else:
                                send_packet(conn, {"type": "leave_group_response", "request_id": request_id, "status": "error", "message": "Failed to leave group"})
                        except Exception as e:
                            send_packet(conn, {"type": "leave_group_response", "request_id": request_id, "status": "error", "message": str(e)})

                    # ============ DELETE GROUP (Owner Only) ============
                    elif pkt_type == "delete_group":
                        conv_id = pkt.get("conversation_id")
                        if not user_id:
                            send_packet(conn, {"type": "delete_group_response", "request_id": request_id, "status": "error", "message": "Unauthorized"})
                            continue
                        try:
                            from repository.conversation_repo import is_conversation_owner, delete_group_db
                            if not is_conversation_owner(conv_id, user_id):
                                send_packet(conn, {"type": "delete_group_response", "request_id": request_id, "status": "error", "message": "Only owner can delete group"})
                                continue
                            # ดึงสมาชิกก่อนลบ เพื่อ broadcast
                            members_before = get_conversation_members_service(conv_id)
                            success = delete_group_db(conv_id)
                            if success:
                                send_packet(conn, {"type": "delete_group_response", "request_id": request_id, "status": "success", "conversation_id": conv_id})
                                for m_id in members_before:
                                    m_str = str(m_id)
                                    if m_str != user_id and m_str in online_users:
                                        try:
                                            send_packet(online_users[m_str], {
                                                "type": "group_deleted_notification",
                                                "conversation_id": conv_id,
                                                "message": "This group has been deleted"
                                            })
                                        except Exception:
                                            pass
                            else:
                                send_packet(conn, {"type": "delete_group_response", "request_id": request_id, "status": "error", "message": "Failed to delete group"})
                        except Exception as e:
                            send_packet(conn, {"type": "delete_group_response", "request_id": request_id, "status": "error", "message": str(e)})

                    # ============ TRANSFER OWNERSHIP (Owner Only) ============
                    elif pkt_type == "transfer_ownership":
                        conv_id = pkt.get("conversation_id")
                        new_owner_id = pkt.get("new_owner_id")
                        if not user_id:
                            send_packet(conn, {"type": "transfer_ownership_response", "request_id": request_id, "status": "error", "message": "Unauthorized"})
                            continue
                        try:
                            from repository.conversation_repo import is_conversation_owner, transfer_ownership_db
                            if not is_conversation_owner(conv_id, user_id):
                                send_packet(conn, {"type": "transfer_ownership_response", "request_id": request_id, "status": "error", "message": "Only owner can transfer ownership"})
                                continue
                            if str(new_owner_id) == str(user_id):
                                send_packet(conn, {"type": "transfer_ownership_response", "request_id": request_id, "status": "error", "message": "Already the owner"})
                                continue
                            success = transfer_ownership_db(conv_id, user_id, new_owner_id)
                            if success:
                                send_packet(conn, {"type": "transfer_ownership_response", "request_id": request_id, "status": "success", "conversation_id": conv_id, "new_owner_id": new_owner_id})
                                # แจ้งทุกคนในกลุ่ม
                                members = get_conversation_members_service(conv_id)
                                for m_id in members:
                                    m_str = str(m_id)
                                    if m_str in online_users:
                                        try:
                                            send_packet(online_users[m_str], {
                                                "type": "ownership_transferred_notification",
                                                "conversation_id": conv_id,
                                                "new_owner_id": new_owner_id
                                            })
                                        except Exception:
                                            pass
                            else:
                                send_packet(conn, {"type": "transfer_ownership_response", "request_id": request_id, "status": "error", "message": "Failed to transfer ownership"})
                        except Exception as e:
                            send_packet(conn, {"type": "transfer_ownership_response", "request_id": request_id, "status": "error", "message": str(e)})

                    # ============ UPDATE GROUP DESCRIPTION ============
                    elif pkt_type == "update_group_description":
                        conv_id = pkt.get("conversation_id")
                        description = pkt.get("description", "")
                        if not user_id:
                            send_packet(conn, {"type": "update_group_description_response", "request_id": request_id, "status": "error", "message": "Unauthorized"})
                            continue
                        try:
                            from repository.conversation_repo import is_conversation_owner, update_group_description_db
                            if not is_conversation_owner(conv_id, user_id):
                                send_packet(conn, {"type": "update_group_description_response", "request_id": request_id, "status": "error", "message": "Only owner can update description"})
                                continue
                            success = update_group_description_db(conv_id, description)
                            send_packet(conn, {"type": "update_group_description_response", "request_id": request_id, "status": "success" if success else "error", "description": description})
                        except Exception as e:
                            send_packet(conn, {"type": "update_group_description_response", "request_id": request_id, "status": "error", "message": str(e)})

                    # ============ GET GROUP INFO ============
                    elif pkt_type == "get_group_info":
                        conv_id = pkt.get("conversation_id")
                        if not user_id:
                            send_packet(conn, {"type": "get_group_info_response", "request_id": request_id, "status": "error", "message": "Unauthorized"})
                            continue
                        try:
                            from repository.conversation_repo import get_group_info_db
                            info = get_group_info_db(conv_id)
                            if info:
                                send_packet(conn, {"type": "get_group_info_response", "request_id": request_id, "status": "success", "data": info})
                            else:
                                send_packet(conn, {"type": "get_group_info_response", "request_id": request_id, "status": "error", "message": "Group not found"})
                        except Exception as e:
                            send_packet(conn, {"type": "get_group_info_response", "request_id": request_id, "status": "error", "message": str(e)})

                    # ============ MUTE/UNMUTE GROUP ============
                    elif pkt_type == "toggle_mute":
                        conv_id = pkt.get("conversation_id")
                        muted = pkt.get("muted", False)
                        if not user_id:
                            send_packet(conn, {"type": "toggle_mute_response", "request_id": request_id, "status": "error", "message": "Unauthorized"})
                            continue
                        try:
                            from repository.conversation_repo import set_mute_status_db
                            success = set_mute_status_db(conv_id, user_id, muted)
                            send_packet(conn, {"type": "toggle_mute_response", "request_id": request_id, "status": "success" if success else "error", "muted": muted})
                        except Exception as e:
                            send_packet(conn, {"type": "toggle_mute_response", "request_id": request_id, "status": "error", "message": str(e)})

                    # ============ PIN/UNPIN MESSAGE ============
                    elif pkt_type == "pin_message":
                        conv_id = pkt.get("conversation_id")
                        message_id = pkt.get("message_id")
                        if not user_id:
                            send_packet(conn, {"type": "pin_message_response", "request_id": request_id, "status": "error", "message": "Unauthorized"})
                            continue
                        try:
                            from repository.conversation_repo import is_conversation_admin_or_owner, pin_message_db
                            if not is_conversation_admin_or_owner(conv_id, user_id):
                                send_packet(conn, {"type": "pin_message_response", "request_id": request_id, "status": "error", "message": "Only owner/admin can pin messages"})
                                continue
                            success = pin_message_db(conv_id, message_id)
                            send_packet(conn, {"type": "pin_message_response", "request_id": request_id, "status": "success" if success else "error", "message_id": message_id})
                        except Exception as e:
                            send_packet(conn, {"type": "pin_message_response", "request_id": request_id, "status": "error", "message": str(e)})

                    elif pkt_type == "unpin_message":
                        conv_id = pkt.get("conversation_id")
                        message_id = pkt.get("message_id")
                        if not user_id:
                            send_packet(conn, {"type": "unpin_message_response", "request_id": request_id, "status": "error", "message": "Unauthorized"})
                            continue
                        try:
                            from repository.conversation_repo import is_conversation_admin_or_owner, unpin_message_db
                            if not is_conversation_admin_or_owner(conv_id, user_id):
                                send_packet(conn, {"type": "unpin_message_response", "request_id": request_id, "status": "error", "message": "Only owner/admin can unpin messages"})
                                continue
                            success = unpin_message_db(conv_id, message_id)
                            send_packet(conn, {"type": "unpin_message_response", "request_id": request_id, "status": "success" if success else "error", "message_id": message_id})
                        except Exception as e:
                            send_packet(conn, {"type": "unpin_message_response", "request_id": request_id, "status": "error", "message": str(e)})

                    elif pkt_type == "get_pinned_messages":
                        conv_id = pkt.get("conversation_id")
                        if not user_id:
                            send_packet(conn, {"type": "get_pinned_messages_response", "request_id": request_id, "status": "error", "message": "Unauthorized"})
                            continue
                        try:
                            from repository.conversation_repo import get_pinned_messages_db
                            pinned = get_pinned_messages_db(conv_id)
                            send_packet(conn, {"type": "get_pinned_messages_response", "request_id": request_id, "status": "success", "messages": pinned})
                        except Exception as e:
                            send_packet(conn, {"type": "get_pinned_messages_response", "request_id": request_id, "status": "error", "message": str(e)})

                    # ============ SET MEMBER ROLE (Owner Only) ============
                    elif pkt_type == "set_member_role":
                        conv_id = pkt.get("conversation_id")
                        target_id = pkt.get("target_user_id")
                        new_role = pkt.get("role")
                        if not user_id:
                            send_packet(conn, {"type": "set_member_role_response", "request_id": request_id, "status": "error", "message": "Unauthorized"})
                            continue
                        try:
                            from repository.conversation_repo import is_conversation_owner, set_member_role_db
                            if not is_conversation_owner(conv_id, user_id):
                                send_packet(conn, {"type": "set_member_role_response", "request_id": request_id, "status": "error", "message": "Only owner can change roles"})
                                continue
                            success = set_member_role_db(conv_id, target_id, new_role)
                            if success:
                                send_packet(conn, {"type": "set_member_role_response", "request_id": request_id, "status": "success", "target_user_id": target_id, "role": new_role})
                            else:
                                send_packet(conn, {"type": "set_member_role_response", "request_id": request_id, "status": "error", "message": "Failed to change role"})
                        except Exception as e:
                            send_packet(conn, {"type": "set_member_role_response", "request_id": request_id, "status": "error", "message": str(e)})

                    # ---------------- UNKNOWN ----------------
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

# ----------------- MAIN SERVER LOOP -----------------
while True:
    conn, addr = server.accept()
    thread = threading.Thread(target=handle_client, args=(conn, addr))
    thread.start()