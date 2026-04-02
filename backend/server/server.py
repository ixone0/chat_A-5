# server/server.py — Refactored with handler dispatch
import socket
import ssl
import threading
import os
import traceback
from dotenv import load_dotenv

load_dotenv()

import packet
from state.online_users import online_users
from services.auth_service import login_user, register_user
from services.conversation_service import handle_create_conversation, get_user_conversations
from services.conversation_service import handle_create_group_chat
from services.user_service import change_custom_id
from db import find_user_by_custom_id, send_friend_request, get_pending_requests, accept_friend_request
from services.message_service import (
    create_message_service, get_conversation_members_service, get_messages_by_conversation,
)
from services.s3_service import upload_file_to_s3
from repository.attachment_repo import insert_attachment
from services.call_service import (
    start_call_service, join_call_service, leave_call_service,
    end_call_service, get_active_call_service,
)
from services.friend_service import handle_get_friends, handle_start_direct_chat
from repository.conversation_repo import (
    update_conversation_title_db, get_user_conversations_db,
    get_group_members_detail_db, is_conversation_admin_or_owner,
    add_members_to_group_db, is_conversation_owner, leave_group_db,
    delete_group_db, transfer_ownership_db, update_group_description_db,
    get_group_info_db, set_mute_status_db, pin_message_db, unpin_message_db,
    get_pinned_messages_db, set_member_role_db, remove_member_from_group_db,
)

# ============================================================
# Server & TLS setup
# ============================================================
HOST = "0.0.0.0"
PORT = int(os.getenv("PORT", 8082))

ssl_context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
ssl_context.load_cert_chain(
    certfile=os.path.join(os.path.dirname(__file__), "server.crt"),
    keyfile=os.path.join(os.path.dirname(__file__), "server.key"),
)

srv_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
srv_socket.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
srv_socket.bind((HOST, PORT))
srv_socket.listen()
print(f"Server started on {HOST}:{PORT} (TLS)")


# ============================================================
# Bandwidth Monitoring
# ============================================================
import time

stats = {
    "bytes_in": 0,
    "bytes_out": 0,
    "packets_in": 0,
    "packets_out": 0,
    "connections": 0,
    "start_time": time.time(),
}
stats_lock = threading.Lock()


def _add_stat(key, value):
    with stats_lock:
        stats[key] += value


def _print_stats():
    while True:
        time.sleep(60)
        with stats_lock:
            elapsed = time.time() - stats["start_time"]
            mins = int(elapsed // 60)
            mb_in = stats["bytes_in"] / (1024 * 1024)
            mb_out = stats["bytes_out"] / (1024 * 1024)
            print(f"\n{'='*60}")
            print(f"[BANDWIDTH] Uptime: {mins} min | Connections: {stats['connections']}")
            print(f"[BANDWIDTH] Received: {mb_in:.2f} MB ({stats['packets_in']} packets)")
            print(f"[BANDWIDTH] Sent:     {mb_out:.2f} MB ({stats['packets_out']} packets)")
            print(f"[BANDWIDTH] Online:   {len(online_users)} users")
            print(f"{'='*60}\n")

threading.Thread(target=_print_stats, daemon=True).start()


# ============================================================
# Helpers
# ============================================================
def send_pkt(conn, data: dict):
    try:
        encoded = packet.encode(data) + b"\n"
        _add_stat("bytes_out", len(encoded))
        _add_stat("packets_out", 1)
        conn.sendall(encoded)
    except Exception as e:
        print(f"[SEND ERROR] {e}")


def broadcast(conv_id, payload, exclude=None):
    """Send payload to every online member, optionally excluding one user."""
    try:
        members = get_conversation_members_service(conv_id)
    except Exception:
        return
    for mid in members:
        m = str(mid)
        if m != exclude and m in online_users:
            try:
                send_pkt(online_users[m], payload)
            except Exception:
                pass


# ============================================================
# Packet handlers
# Each handler receives: (conn, pkt, user_id, request_id, set_uid)
#   set_uid is a callback to update user_id in the client loop
# ============================================================

def h_register(conn, pkt, uid, rid, set_uid):
    try:
        resp = register_user(pkt)
    except Exception:
        resp = {"status": "error", "message": "Server error"}
    resp.update(type="register_response", request_id=rid)
    send_pkt(conn, resp)


def h_login(conn, pkt, uid, rid, set_uid):
    try:
        user = login_user(pkt)
    except Exception:
        send_pkt(conn, {"type": "login_response", "request_id": rid, "status": "error", "message": "Server error"})
        return
    if user:
        new_uid = str(user["user_id"])
        set_uid(new_uid)
        online_users[new_uid] = conn
        send_pkt(conn, {"type": "login_response", "request_id": rid, "status": "success",
                        "user_id": new_uid, "username": user["username"],
                        "custom_id": user.get("custom_id"), "message": "Login Success"})
    else:
        send_pkt(conn, {"type": "login_response", "request_id": rid, "status": "error", "message": "Login failed"})


def h_update_user_id(conn, pkt, uid, rid, _):
    try:
        r = change_custom_id(pkt.get("user_id"), pkt.get("new_id"))
        send_pkt(conn, {"type": "update_user_id_response", "success": r.get("success", False), "message": r.get("message", "")})
    except Exception:
        send_pkt(conn, {"type": "update_user_id_response", "success": False, "message": "Server error"})


def h_search_user(conn, pkt, uid, rid, _):
    found = None
    try:
        found = find_user_by_custom_id(pkt.get("target_id"))
    except Exception:
        pass
    if found:
        send_pkt(conn, {"type": "search_user_response", "request_id": rid, "status": "success", "data": found})
    else:
        send_pkt(conn, {"type": "search_user_response", "request_id": rid, "status": "error", "message": "User not found"})


def h_send_friend_request(conn, pkt, uid, rid, _):
    target = pkt.get("target_id")
    if not uid or not target:
        send_pkt(conn, {"type": "error", "message": "Invalid data"}); return
    try:
        r = send_friend_request(uid, target)
        ok = r.get("success", False)
    except Exception as e:
        ok, r = False, {"message": str(e)}
    send_pkt(conn, {"type": "send_friend_request_response", "request_id": rid,
                    "status": "success" if ok else "error", "message": r.get("message", "")})


def h_get_pending_requests(conn, pkt, uid, rid, _):
    try:
        send_pkt(conn, {"type": "get_pending_requests_response", "request_id": rid,
                        "status": "success", "data": get_pending_requests(uid)})
    except Exception as e:
        send_pkt(conn, {"type": "get_pending_requests_response", "request_id": rid, "status": "error", "message": str(e)})


def h_accept_friend(conn, pkt, uid, rid, _):
    try:
        r = accept_friend_request(uid, pkt.get("sender_id"))
        send_pkt(conn, {"type": "accept_friend_response", "request_id": rid,
                        "status": "success" if r.get("success") else "error", "message": r.get("message", "")})
    except Exception as e:
        send_pkt(conn, {"type": "accept_friend_response", "request_id": rid, "status": "error", "message": str(e)})


def h_get_friends(conn, pkt, uid, rid, _):
    try:
        resp = handle_get_friends(uid)
        resp["request_id"] = rid
        for f in (resp.get("friends") or resp.get("data") or []):
            f["is_online"] = str(f.get("id", "")) in online_users
        send_pkt(conn, resp)
    except Exception as e:
        send_pkt(conn, {"type": "friends_list", "request_id": rid, "status": "error", "message": str(e)})


# ---- Messaging ----

def h_send_message(conn, pkt, uid, rid, _):
    if not uid:
        send_pkt(conn, {"type": "send_message_response", "request_id": rid, "status": "error", "message": "Unauthorized"}); return
    conv_id, text = pkt.get("conversation_id"), pkt.get("text")
    if not conv_id or not text:
        send_pkt(conn, {"type": "send_message_response", "request_id": rid, "status": "error", "message": "Invalid data"}); return
    try:
        msg = create_message_service(conv_id, uid, text)
    except Exception as e:
        send_pkt(conn, {"type": "send_message_response", "request_id": rid, "status": "error", "message": str(e)}); return
    send_pkt(conn, {"type": "send_message_response", "request_id": rid, "status": "success", "message": msg})
    broadcast(conv_id, {"type": "receive_message", "conversation_id": conv_id, "message": msg})


def h_get_messages(conn, pkt, uid, rid, _):
    if not uid:
        send_pkt(conn, {"type": "get_messages_response", "request_id": rid, "status": "error", "message": "Unauthorized"}); return
    conv_id = pkt.get("conversation_id")
    try:
        msgs = get_messages_by_conversation(conv_id)
        send_pkt(conn, {"type": "get_messages_response", "request_id": rid, "status": "success",
                        "conversation_id": conv_id, "messages": msgs})
    except Exception as e:
        send_pkt(conn, {"type": "get_messages_response", "request_id": rid, "status": "error", "message": str(e)})


def h_get_my_conversations(conn, pkt, uid, rid, _):
    if not uid:
        send_pkt(conn, {"type": "get_my_conversations_response", "request_id": rid, "status": "error", "message": "Unauthorized"}); return
    try:
        send_pkt(conn, {"type": "get_my_conversations_response", "request_id": rid, "status": "success",
                        "data": get_user_conversations(uid)})
    except Exception as e:
        send_pkt(conn, {"type": "get_my_conversations_response", "request_id": rid, "status": "error", "message": str(e)})


def h_start_direct_chat(conn, pkt, uid, rid, _):
    try:
        resp = handle_start_direct_chat(uid, pkt.get("friend_id"))
        resp["request_id"] = rid
        send_pkt(conn, resp)
    except Exception as e:
        send_pkt(conn, {"type": "start_direct_chat_response", "request_id": rid, "status": "error", "message": str(e)})


def h_send_file(conn, pkt, uid, rid, _):
    if not uid:
        send_pkt(conn, {"type": "send_file_response", "request_id": rid, "status": "error", "message": "Unauthorized"}); return
    conv_id = pkt.get("conversation_id")
    b64 = pkt.get("data", "")
    if not conv_id or not b64:
        send_pkt(conn, {"type": "send_file_response", "request_id": rid, "status": "error", "message": "Missing data"}); return
    try:
        s3 = upload_file_to_s3(b64, pkt.get("file_name", "file"), pkt.get("mime_type", "application/octet-stream"), uid)
        result = create_message_service(conv_id, uid, content=s3["file_url"])
        if result.get("status") != "success":
            raise Exception(result.get("message", "Failed"))
        msg = result["message"]
        msg["msg_type"] = "file"
        msg["attachment"] = insert_attachment(str(msg["id"]), pkt.get("file_name", "file"),
                                              s3["s3_key"], s3["file_url"],
                                              pkt.get("mime_type", "application/octet-stream"), s3["file_size"])
        send_pkt(conn, {"type": "send_file_response", "request_id": rid, "status": "success", "message": msg})
        broadcast(conv_id, {"type": "receive_message", "conversation_id": conv_id, "message": msg}, exclude=uid)
    except Exception as e:
        send_pkt(conn, {"type": "send_file_response", "request_id": rid, "status": "error", "message": str(e)})


# ---- Calls ----

def h_start_call(conn, pkt, uid, rid, _):
    try:
        resp = start_call_service(pkt, uid)
        if resp.get("status") == "error":
            resp["request_id"] = rid
            send_pkt(conn, resp)
        else:
            send_pkt(conn, {"type": "start_call_response", "request_id": rid, "status": "ok",
                            "call_id": resp.get("call_id"), "conversation_id": pkt["conversation_id"]})
    except Exception as e:
        send_pkt(conn, {"type": "start_call_response", "request_id": rid, "status": "error", "message": str(e)})


def _simple_call_handler(resp_type):
    """Factory for join/leave/end/get_active call handlers."""
    def handler(conn, pkt, uid, rid, _):
        svc_map = {
            "join_call_response": join_call_service,
            "leave_call_response": leave_call_service,
            "end_call_response": end_call_service,
            "get_active_call_response": get_active_call_service,
        }
        try:
            resp = svc_map[resp_type](pkt, uid)
            resp["request_id"] = rid
            send_pkt(conn, resp)
        except Exception as e:
            send_pkt(conn, {"type": resp_type, "request_id": rid, "status": "error", "message": str(e)})
    return handler

h_join_call = _simple_call_handler("join_call_response")
h_leave_call = _simple_call_handler("leave_call_response")
h_end_call = _simple_call_handler("end_call_response")
h_get_active_call = _simple_call_handler("get_active_call_response")


# ---- WebRTC relay ----

def _relay_webrtc(pkt_type_out, data_key):
    """Factory for webrtc_offer / webrtc_answer / ice_candidate relay."""
    def handler(conn, pkt, uid, rid, _):
        target = pkt.get("target_user_id")
        conv_id = pkt.get("conversation_id")
        payload = {"type": pkt_type_out, "call_id": pkt.get("call_id"), data_key: pkt.get(data_key), "from_user": uid}
        if pkt_type_out == "webrtc_offer":
            payload["conversation_id"] = conv_id
            payload["call_type"] = pkt.get("call_type", "audio")
        try:
            if target and target in online_users:
                send_pkt(online_users[target], payload)
            else:
                members = get_conversation_members_service(conv_id)
                for u in members:
                    if u != uid and u in online_users:
                        send_pkt(online_users[u], payload)
        except Exception as e:
            print(f"[RELAY ERROR {pkt_type_out}] {e}")
    return handler

h_webrtc_offer = _relay_webrtc("webrtc_offer", "offer")
h_webrtc_answer = _relay_webrtc("webrtc_answer", "answer")
h_ice_candidate = _relay_webrtc("ice_candidate", "candidate")


# ---- Group management ----

def h_create_group_chat(conn, pkt, uid, rid, _):
    if not uid:
        send_pkt(conn, {"type": "create_group_chat_response", "request_id": rid, "status": "error", "message": "Unauthorized"}); return
    try:
        result = handle_create_group_chat(pkt, uid)
        result["request_id"] = rid
        send_pkt(conn, result)
        if result.get("status") == "success":
            for mid in result.get("members", []):
                m = str(mid)
                if m != uid and m in online_users:
                    try:
                        send_pkt(online_users[m], {"type": "new_group_notification",
                                                    "conversation_id": result.get("conversation_id"),
                                                    "title": result.get("title", "")})
                    except Exception:
                        pass
    except Exception as e:
        send_pkt(conn, {"type": "create_group_chat_response", "request_id": rid, "status": "error", "message": str(e)})


def h_rename_group(conn, pkt, uid, rid, _):
    if not uid:
        send_pkt(conn, {"type": "rename_group_response", "status": "error", "message": "Unauthorized"}); return
    conv_id, new_title = pkt.get("conversation_id"), pkt.get("new_title")
    convs = get_user_conversations_db(uid)
    if not any(c["id"] == conv_id and c["role"] == "owner" for c in convs):
        send_pkt(conn, {"type": "rename_group_response", "status": "error", "message": "Only owner can rename"}); return
    if update_conversation_title_db(conv_id, new_title):
        send_pkt(conn, {"type": "rename_group_response", "request_id": rid, "status": "success", "new_title": new_title})
        broadcast(conv_id, {"type": "group_renamed_notification", "conversation_id": conv_id, "new_title": new_title})
    else:
        send_pkt(conn, {"type": "rename_group_response", "status": "error", "message": "Update failed"})


def h_get_group_members(conn, pkt, uid, rid, _):
    if not uid:
        send_pkt(conn, {"type": "get_group_members_response", "request_id": rid, "status": "error", "message": "Unauthorized"}); return
    try:
        send_pkt(conn, {"type": "get_group_members_response", "request_id": rid, "status": "success",
                        "conversation_id": pkt.get("conversation_id"),
                        "members": get_group_members_detail_db(pkt.get("conversation_id"))})
    except Exception as e:
        send_pkt(conn, {"type": "get_group_members_response", "request_id": rid, "status": "error", "message": str(e)})


def h_add_group_members(conn, pkt, uid, rid, _):
    if not uid:
        send_pkt(conn, {"type": "add_group_members_response", "request_id": rid, "status": "error", "message": "Unauthorized"}); return
    conv_id = pkt.get("conversation_id")
    if not is_conversation_admin_or_owner(conv_id, uid):
        send_pkt(conn, {"type": "add_group_members_response", "request_id": rid, "status": "error", "message": "Permission denied"}); return
    try:
        added = add_members_to_group_db(conv_id, pkt.get("members", []))
        send_pkt(conn, {"type": "add_group_members_response", "request_id": rid, "status": "success",
                        "conversation_id": conv_id, "added_members": added})
        for m in added:
            if str(m) in online_users:
                try: send_pkt(online_users[str(m)], {"type": "new_group_notification", "conversation_id": conv_id})
                except Exception: pass
        broadcast(conv_id, {"type": "member_added_notification", "conversation_id": conv_id, "added_members": added}, exclude=uid)
    except Exception as e:
        send_pkt(conn, {"type": "add_group_members_response", "request_id": rid, "status": "error", "message": str(e)})


def h_kick_group_member(conn, pkt, uid, rid, _):
    if not uid:
        send_pkt(conn, {"type": "kick_group_member_response", "request_id": rid, "status": "error", "message": "Unauthorized"}); return
    conv_id, target = pkt.get("conversation_id"), pkt.get("target_user_id")
    if not is_conversation_admin_or_owner(conv_id, uid):
        send_pkt(conn, {"type": "kick_group_member_response", "request_id": rid, "status": "error", "message": "Permission denied"}); return
    if str(target) == str(uid):
        send_pkt(conn, {"type": "kick_group_member_response", "request_id": rid, "status": "error", "message": "Cannot kick yourself"}); return
    if remove_member_from_group_db(conv_id, target):
        send_pkt(conn, {"type": "kick_group_member_response", "request_id": rid, "status": "success",
                        "conversation_id": conv_id, "kicked_user_id": target})
        if str(target) in online_users:
            try: send_pkt(online_users[str(target)], {"type": "member_kicked_notification", "conversation_id": conv_id, "kicked_user_id": target})
            except Exception: pass
        broadcast(conv_id, {"type": "member_kicked_notification", "conversation_id": conv_id, "kicked_user_id": target}, exclude=uid)
    else:
        send_pkt(conn, {"type": "kick_group_member_response", "request_id": rid, "status": "error", "message": "Failed"})


def h_leave_group(conn, pkt, uid, rid, _):
    if not uid:
        send_pkt(conn, {"type": "leave_group_response", "request_id": rid, "status": "error", "message": "Unauthorized"}); return
    conv_id = pkt.get("conversation_id")
    if is_conversation_owner(conv_id, uid):
        send_pkt(conn, {"type": "leave_group_response", "request_id": rid, "status": "error", "message": "Owner cannot leave"}); return
    if leave_group_db(conv_id, uid):
        send_pkt(conn, {"type": "leave_group_response", "request_id": rid, "status": "success", "conversation_id": conv_id})
        broadcast(conv_id, {"type": "member_left_notification", "conversation_id": conv_id, "left_user_id": uid})
    else:
        send_pkt(conn, {"type": "leave_group_response", "request_id": rid, "status": "error", "message": "Failed"})


def h_delete_group(conn, pkt, uid, rid, _):
    if not uid:
        send_pkt(conn, {"type": "delete_group_response", "request_id": rid, "status": "error", "message": "Unauthorized"}); return
    conv_id = pkt.get("conversation_id")
    if not is_conversation_owner(conv_id, uid):
        send_pkt(conn, {"type": "delete_group_response", "request_id": rid, "status": "error", "message": "Only owner"}); return
    members_before = get_conversation_members_service(conv_id)
    if delete_group_db(conv_id):
        send_pkt(conn, {"type": "delete_group_response", "request_id": rid, "status": "success", "conversation_id": conv_id})
        for m in members_before:
            if str(m) != uid and str(m) in online_users:
                try: send_pkt(online_users[str(m)], {"type": "group_deleted_notification", "conversation_id": conv_id})
                except Exception: pass
    else:
        send_pkt(conn, {"type": "delete_group_response", "request_id": rid, "status": "error", "message": "Failed"})


def h_transfer_ownership(conn, pkt, uid, rid, _):
    if not uid:
        send_pkt(conn, {"type": "transfer_ownership_response", "request_id": rid, "status": "error", "message": "Unauthorized"}); return
    conv_id, new_owner = pkt.get("conversation_id"), pkt.get("new_owner_id")
    if not is_conversation_owner(conv_id, uid):
        send_pkt(conn, {"type": "transfer_ownership_response", "request_id": rid, "status": "error", "message": "Only owner"}); return
    if transfer_ownership_db(conv_id, uid, new_owner):
        send_pkt(conn, {"type": "transfer_ownership_response", "request_id": rid, "status": "success",
                        "conversation_id": conv_id, "new_owner_id": new_owner})
        broadcast(conv_id, {"type": "ownership_transferred_notification", "conversation_id": conv_id, "new_owner_id": new_owner})
    else:
        send_pkt(conn, {"type": "transfer_ownership_response", "request_id": rid, "status": "error", "message": "Failed"})


# ---- Misc features ----

def h_typing(conn, pkt, uid, rid, _):
    conv_id = pkt.get("conversation_id")
    if uid and conv_id:
        broadcast(conv_id, {"type": "typing_indicator", "conversation_id": conv_id, "user_id": uid}, exclude=uid)


def h_get_group_info(conn, pkt, uid, rid, _):
    if not uid:
        send_pkt(conn, {"type": "get_group_info_response", "request_id": rid, "status": "error", "message": "Unauthorized"}); return
    info = get_group_info_db(pkt.get("conversation_id"))
    if info:
        send_pkt(conn, {"type": "get_group_info_response", "request_id": rid, "status": "success", "data": info})
    else:
        send_pkt(conn, {"type": "get_group_info_response", "request_id": rid, "status": "error", "message": "Not found"})


def h_update_group_description(conn, pkt, uid, rid, _):
    if not uid:
        send_pkt(conn, {"type": "update_group_description_response", "request_id": rid, "status": "error", "message": "Unauthorized"}); return
    conv_id = pkt.get("conversation_id")
    if not is_conversation_owner(conv_id, uid):
        send_pkt(conn, {"type": "update_group_description_response", "request_id": rid, "status": "error", "message": "Only owner"}); return
    ok = update_group_description_db(conv_id, pkt.get("description", ""))
    send_pkt(conn, {"type": "update_group_description_response", "request_id": rid, "status": "success" if ok else "error"})


def h_toggle_mute(conn, pkt, uid, rid, _):
    if not uid:
        send_pkt(conn, {"type": "toggle_mute_response", "request_id": rid, "status": "error", "message": "Unauthorized"}); return
    ok = set_mute_status_db(pkt.get("conversation_id"), uid, pkt.get("muted", False))
    send_pkt(conn, {"type": "toggle_mute_response", "request_id": rid, "status": "success" if ok else "error", "muted": pkt.get("muted")})


def h_pin_message(conn, pkt, uid, rid, _):
    if not uid:
        send_pkt(conn, {"type": "pin_message_response", "request_id": rid, "status": "error", "message": "Unauthorized"}); return
    conv_id = pkt.get("conversation_id")
    if not is_conversation_admin_or_owner(conv_id, uid):
        send_pkt(conn, {"type": "pin_message_response", "request_id": rid, "status": "error", "message": "Permission denied"}); return
    ok = pin_message_db(conv_id, pkt.get("message_id"))
    send_pkt(conn, {"type": "pin_message_response", "request_id": rid, "status": "success" if ok else "error", "message_id": pkt.get("message_id")})


def h_unpin_message(conn, pkt, uid, rid, _):
    if not uid:
        send_pkt(conn, {"type": "unpin_message_response", "request_id": rid, "status": "error", "message": "Unauthorized"}); return
    conv_id = pkt.get("conversation_id")
    if not is_conversation_admin_or_owner(conv_id, uid):
        send_pkt(conn, {"type": "unpin_message_response", "request_id": rid, "status": "error", "message": "Permission denied"}); return
    ok = unpin_message_db(conv_id, pkt.get("message_id"))
    send_pkt(conn, {"type": "unpin_message_response", "request_id": rid, "status": "success" if ok else "error", "message_id": pkt.get("message_id")})


def h_get_pinned_messages(conn, pkt, uid, rid, _):
    if not uid:
        send_pkt(conn, {"type": "get_pinned_messages_response", "request_id": rid, "status": "error", "message": "Unauthorized"}); return
    try:
        send_pkt(conn, {"type": "get_pinned_messages_response", "request_id": rid, "status": "success",
                        "messages": get_pinned_messages_db(pkt.get("conversation_id"))})
    except Exception as e:
        send_pkt(conn, {"type": "get_pinned_messages_response", "request_id": rid, "status": "error", "message": str(e)})


def h_set_member_role(conn, pkt, uid, rid, _):
    if not uid:
        send_pkt(conn, {"type": "set_member_role_response", "request_id": rid, "status": "error", "message": "Unauthorized"}); return
    conv_id = pkt.get("conversation_id")
    if not is_conversation_owner(conv_id, uid):
        send_pkt(conn, {"type": "set_member_role_response", "request_id": rid, "status": "error", "message": "Only owner"}); return
    ok = set_member_role_db(conv_id, pkt.get("target_user_id"), pkt.get("role"))
    send_pkt(conn, {"type": "set_member_role_response", "request_id": rid,
                    "status": "success" if ok else "error",
                    "target_user_id": pkt.get("target_user_id"), "role": pkt.get("role")})


def h_toggle_reaction(conn, pkt, uid, rid, _):
    if not uid:
        send_pkt(conn, {"type": "toggle_reaction_response", "request_id": rid, "status": "error", "message": "Unauthorized"}); return
    try:
        from repository.message_repo import toggle_reaction_db
        result = toggle_reaction_db(pkt.get("message_id"), uid, pkt.get("reaction"))
        if result:
            send_pkt(conn, {"type": "toggle_reaction_response", "request_id": rid, "status": "success",
                            "action": result, "message_id": pkt.get("message_id"), "reaction": pkt.get("reaction")})
            conv_id = pkt.get("conversation_id")
            if conv_id:
                broadcast(conv_id, {"type": "reaction_update", "conversation_id": conv_id,
                                    "message_id": pkt.get("message_id"), "reaction": pkt.get("reaction"),
                                    "action": result, "user_id": uid}, exclude=uid)
        else:
            send_pkt(conn, {"type": "toggle_reaction_response", "request_id": rid, "status": "error", "message": "Failed"})
    except Exception as e:
        send_pkt(conn, {"type": "toggle_reaction_response", "request_id": rid, "status": "error", "message": str(e)})


# ============================================================
# Handler dispatch table
# ============================================================
HANDLERS = {
    "register":             h_register,
    "login":                h_login,
    "update_user_id":       h_update_user_id,
    "search_user":          h_search_user,
    "send_friend_request":  h_send_friend_request,
    "get_pending_requests": h_get_pending_requests,
    "accept_friend":        h_accept_friend,
    "get_friends":          h_get_friends,
    "send_message":         h_send_message,
    "get_messages":         h_get_messages,
    "get_my_conversations": h_get_my_conversations,
    "open_direct":          h_start_direct_chat,
    "start_direct_chat":    h_start_direct_chat,
    "send_file":            h_send_file,
    "create_conversation":  lambda c, p, u, r, s: send_pkt(c, handle_create_conversation(p, u)) if u else send_pkt(c, {"status": "error", "message": "Unauthorized"}),
    "start_call":           h_start_call,
    "join_call":            h_join_call,
    "leave_call":           h_leave_call,
    "end_call":             h_end_call,
    "get_active_call":      h_get_active_call,
    "webrtc_offer":         h_webrtc_offer,
    "webrtc_answer":        h_webrtc_answer,
    "ice_candidate":        h_ice_candidate,
    "create_group_chat":    h_create_group_chat,
    "rename_group":         h_rename_group,
    "get_group_members":    h_get_group_members,
    "add_group_members":    h_add_group_members,
    "kick_group_member":    h_kick_group_member,
    "leave_group":          h_leave_group,
    "delete_group":         h_delete_group,
    "transfer_ownership":   h_transfer_ownership,
    "typing":               h_typing,
    "get_group_info":       h_get_group_info,
    "update_group_description": h_update_group_description,
    "toggle_mute":          h_toggle_mute,
    "pin_message":          h_pin_message,
    "unpin_message":        h_unpin_message,
    "get_pinned_messages":  h_get_pinned_messages,
    "set_member_role":      h_set_member_role,
    "toggle_reaction":      h_toggle_reaction,
}


# ============================================================
# Client connection loop
# ============================================================
def handle_client(conn, addr):
    print(f"[CONNECT] {addr}")
    _add_stat("connections", 1)
    user_id = None
    buffer = b""
    MAX_BUFFER_SIZE = 15 * 1024 * 1024  # 15MB

    def set_uid(new_uid):
        nonlocal user_id
        user_id = new_uid

    try:
        while True:
            data = conn.recv(4096)
            if not data:
                break

            _add_stat("bytes_in", len(data))
            buffer += data

            # ป้องกัน buffer overflow (DoS protection)
            if len(buffer) > MAX_BUFFER_SIZE:
                print(f"[ERROR] Buffer overflow from {addr} ({len(buffer)} bytes), closing")
                send_pkt(conn, {"type": "error", "message": "Packet too large"})
                break

            while b"\n" in buffer:
                raw, buffer = buffer.split(b"\n", 1)
                if not raw.strip():
                    continue

                try:
                    pkt = packet.decode(raw)
                except Exception:
                    send_pkt(conn, {"type": "error", "message": "Invalid packet"})
                    continue

                _add_stat("packets_in", 1)
                rid = pkt.get("request_id")
                pkt_type = pkt.get("type")

                handler = HANDLERS.get(pkt_type)
                if handler:
                    try:
                        handler(conn, pkt, user_id, rid, set_uid)
                    except Exception:
                        print(f"[HANDLER ERROR] {pkt_type}: {traceback.format_exc()}")
                        send_pkt(conn, {"type": "error", "request_id": rid, "message": "Internal server error"})
                else:
                    send_pkt(conn, {"type": "error", "request_id": rid, "message": f"Unknown type: {pkt_type}"})

    except ConnectionResetError:
        print(f"[RESET] {addr}")
    except Exception:
        print(f"[ERROR] {addr}: {traceback.format_exc()}")
    finally:
        if user_id and user_id in online_users:
            del online_users[user_id]
        conn.close()
        print(f"[CLOSED] {addr}")


# ============================================================
# Main server loop
# ============================================================
while True:
    raw_conn, addr = srv_socket.accept()
    try:
        conn = ssl_context.wrap_socket(raw_conn, server_side=True)
    except ssl.SSLError as e:
        print(f"[SSL ERROR] {addr}: {e}")
        raw_conn.close()
        continue
    threading.Thread(target=handle_client, args=(conn, addr), daemon=True).start()
