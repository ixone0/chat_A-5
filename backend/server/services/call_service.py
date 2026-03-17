#server/call_service.py
from repository.call_repo import (
    create_call,
    join_call,
    leave_call,
    end_call,
    get_call_by_id
)

from repository.conversation_repo import get_other_user
from state.online_users import online_users
from utils.network import send_packet

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

    end_call(call_id)

    return {
        "type": "end_call_response",
        "status": "success"
    }