#server/call_service.py
from repository.call_repo import (
    create_call,
    join_call,
    leave_call,
    end_call,
    get_call_by_id,
    get_call_participants
)

from repository.conversation_repo import get_other_user
from state.online_users import online_users
from utils.network import send_packet
from services.message_service import create_message_service, get_conversation_members_service

def send_packet_to_user(user_id, packet):

    user_id = str(user_id)   # ✅ FIX

    print("SEND TO USER:", user_id)
    print("ONLINE USERS:", online_users)
    print(f"[SEND] -> {user_id} | {packet['type']}")
    conn = online_users.get(user_id)

    if conn:
        print("FOUND CONNECTION -> sending")
        try:
            send_packet(conn, packet)
        except Exception as e:
            print("❌ SEND ERROR:", e)
            try:
                conn.close()
            except:
                pass
            online_users.pop(user_id, None)
    else:
        print("USER NOT ONLINE")

def start_call_service(pkt, user_id):
    try:
        print("START CALL")

        conversation_id = pkt.get("conversation_id")
        call_type = pkt.get("call_type")

        call_id = create_call(conversation_id, user_id, call_type)

        join_call(call_id, user_id)

        other_user_id = get_other_user(conversation_id, user_id)

        print("OTHER USER:", other_user_id)
        
        # 🔥 ยิง incoming_call ไปหาอีกฝ่ายเท่านั้น
        send_packet_to_user(other_user_id, {
            "type": "incoming_call",
            "call_id": call_id,
            "conversation_id": conversation_id,
            "from_user": user_id,
            "call_type": call_type
        })

        return {
            "type": "start_call_response",
            "status": "ok",
            "call_id": call_id
        }

    except Exception as e:
        import traceback
        traceback.print_exc()
        return {
            "type": "error",
            "message": "start_call_service failed",
            "detail": str(e)
        }
        
def join_call_service(pkt, user_id):
    call_id = pkt.get("call_id")

    # ✅ ดึง conversation_id จาก DB
    conversation_id = get_call_by_id(call_id)

    join_call(call_id, user_id)

    other_user_id = get_other_user(conversation_id, user_id)

    print("CALL ANSWERED -> notify:", other_user_id)

    packet = {
        "type": "call_answered",
        "call_id": call_id
    }

    # 🔥 ส่งให้ caller
    send_packet_to_user(other_user_id, packet)

    # 🔥 ส่งให้ตัวเอง (callee)
    send_packet_to_user(user_id, packet)

    return {
        "type": "join_call_response",
        "status": "success",
        "call_id": call_id
    }

def leave_call_service(pkt, user_id):
    call_id = pkt.get("call_id")

    leave_call(call_id, user_id)

    return {
        "type": "leave_call_response",
        "status": "success"
    }

def end_call_service(pkt, user_id):
    call_id = pkt.get("call_id")
    duration = pkt.get("duration", 0)

    # 1) end call ใน DB + ดึง conversation_id, call_type
    call_info = end_call(call_id)

    # 2) หา participant ทุกคนในสาย
    participants = get_call_participants(call_id)

    payload = {
        "type": "call_ended",
        "call_id": call_id
    }

    # 3) broadcast call_ended ไปทุกคน
    for uid in participants:
        conn = online_users.get(uid)
        if conn:
            try:
                send_packet(conn, payload)
            except Exception as e:
                print(f"❌ send call_ended failed to {uid}: {e}")

    # 4) insert system message แจ้งสิ้นสุดการโทรในแชท
    if call_info:
        try:
            mins = str(int(duration) // 60).zfill(2)
            secs = str(int(duration) % 60).zfill(2)
            call_type_label = "วิดีโอคอล" if call_info.get("call_type") == "video" else "การโทร"
            text = f"📞 สิ้นสุด{call_type_label} ({mins}:{secs})"

            conversation_id = call_info["conversation_id"]
            print(f"[END_CALL] Inserting message: '{text}' into conv={conversation_id} by user={user_id}")
            result = create_message_service(str(conversation_id), str(user_id), text)
            print(f"[END_CALL] create_message_service result: {result.get('status')}")

            if result.get("status") == "success":
                msg = result
                members = get_conversation_members_service(str(conversation_id))
                print(f"[END_CALL] Broadcasting to members: {members}")
                for member_id in members:
                    mid = str(member_id)
                    if mid in online_users:
                        try:
                            send_packet(online_users[mid], {
                                "type": "receive_message",
                                "conversation_id": str(conversation_id),
                                "message": msg
                            })
                            print(f"[END_CALL] ✅ Sent to {mid}")
                        except Exception as e:
                            print(f"❌ send call-ended msg failed to {mid}: {e}")
                    else:
                        print(f"[END_CALL] ⚠️ {mid} not online")
            else:
                print(f"[END_CALL] ❌ Message insert failed: {result.get('message')}")
        except Exception as e:
            import traceback
            traceback.print_exc()
            print(f"❌ Failed to insert call-ended message: {e}")
    else:
        print(f"[END_CALL] ⚠️ call_info is None for call_id={call_id}")

    # 5) response กลับคนที่กด
    return {
        "type": "end_call_response",
        "status": "success"
    }
