#server/call_service.py
from repository.call_repo import (
    create_call,
    join_call,
    leave_call,
    end_call,
    get_call_by_id,
    get_call_participants,
    get_call_participants_info,
    get_active_call_for_conversation
)

from repository.conversation_repo import get_other_user, get_conversation_type, get_all_members
from state.online_users import online_users
from utils.network import send_packet
from services.message_service import create_message_service, get_conversation_members_service

def send_packet_to_user(user_id, packet):
    user_id = str(user_id)
    conn = online_users.get(user_id)
    if conn:
        try:
            send_packet(conn, packet)
        except Exception as e:
            print(f"❌ SEND ERROR to {user_id}: {e}")
            try:
                conn.close()
            except:
                pass
            online_users.pop(user_id, None)

def _broadcast_participants(call_id, conversation_id):
    """Broadcast participant list ไปทุกคนใน conversation ที่ online"""
    participants_info = get_call_participants_info(call_id)
    members = get_conversation_members_service(str(conversation_id))
    for mid in members:
        mid_str = str(mid)
        if mid_str in online_users:
            try:
                send_packet(online_users[mid_str], {
                    "type": "call_participants_update",
                    "call_id": call_id,
                    "participants": participants_info
                })
            except Exception as e:
                print(f"❌ broadcast_participants failed to {mid_str}: {e}")
                pass

def start_call_service(pkt, user_id):
    try:
        conversation_id = pkt.get("conversation_id")
        call_type = pkt.get("call_type")

        conv_type = get_conversation_type(conversation_id)
        is_group = conv_type == "group"

        # เช็คจำนวนสมาชิกถ้าเป็นกลุ่ม
        if is_group:
            members = get_all_members(conversation_id)
            if len(members) > 4:
                return {
                    "type": "start_call_response",
                    "status": "error",
                    "message": "กลุ่มมีสมาชิกเกิน 4 คน ไม่สามารถโทรได้"
                }

        # ถ้ามี active/ringing call ค้างอยู่ ให้ end ทิ้งก่อน (stale call)
        existing = get_active_call_for_conversation(conversation_id)
        if existing:
            print(f"⚠️ Found stale call {existing['call_id']} — auto-ending before new call")
            end_call(existing["call_id"])

        call_id = create_call(conversation_id, user_id, call_type)
        join_call(call_id, user_id)

        if is_group:
            for member_id in members:
                if str(member_id) != str(user_id):
                    send_packet_to_user(member_id, {
                        "type": "incoming_call",
                        "call_id": call_id,
                        "conversation_id": conversation_id,
                        "from_user": user_id,
                        "call_type": call_type,
                        "is_group": True
                    })
        else:
            other_user_id = get_other_user(conversation_id, user_id)
            send_packet_to_user(other_user_id, {
                "type": "incoming_call",
                "call_id": call_id,
                "conversation_id": conversation_id,
                "from_user": user_id,
                "call_type": call_type,
                "is_group": False
            })

        # broadcast participant list ทันทีหลัง caller เข้าสาย
        _broadcast_participants(call_id, conversation_id)

        # ✅ ส่ง initial participants list ให้ caller รู้
        initial_participants = get_call_participants_info(call_id)
        
        return {
            "type": "start_call_response",
            "status": "ok",
            "call_id": call_id,
            "is_group": is_group,
            "participants": initial_participants
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
    conversation_id = get_call_by_id(call_id)
    join_call(call_id, user_id)

    conv_type = get_conversation_type(conversation_id)
    is_group = conv_type == "group"

    # ดึงคนที่อยู่ในสายแล้ว (ก่อนคนนี้เข้า)
    participants = get_call_participants(call_id)
    
    # ✅ ดึง full participant info (รวม display_name, username)
    participants_info = get_call_participants_info(call_id)
    # Filter out the current user from existing_participants
    existing_participants_info = [p for p in participants_info if str(p['user_id']) != str(user_id)]

    packet = {
        "type": "call_answered",
        "call_id": call_id,
        "is_group": is_group,
        # ส่ง list ของคนที่อยู่ในสายแล้วให้คนใหม่รู้ว่าต้องสร้าง peer กับใครบ้าง (รวม display_name, username)
        "existing_participants": existing_participants_info,
        # ✅ ส่ง full participant list รวมแม้กระทั่งคนใหม่เข้า
        "participants": participants_info
    }

    # แจ้งทุกคนที่อยู่ในสายแล้วว่ามีคนใหม่เข้ามา
    for pid in participants:
        if str(pid) != str(user_id):
            send_packet_to_user(pid, {
                "type": "call_answered",
                "call_id": call_id,
                "is_group": is_group,
                "new_participant": str(user_id)
            })

    # ส่งให้คนที่เพิ่งเข้า
    send_packet_to_user(user_id, packet)

    # broadcast participant list ที่อัปเดตแล้ว
    _broadcast_participants(call_id, conversation_id)

    return {
        "type": "join_call_response",
        "status": "success",
        "call_id": call_id
    }

def get_active_call_service(pkt, user_id):
    """ดึง active call ของ conversation พร้อม participant list"""
    conversation_id = pkt.get("conversation_id")
    call_info = get_active_call_for_conversation(conversation_id)
    if not call_info:
        return {"type": "get_active_call_response", "status": "none"}
    participants_info = get_call_participants_info(call_info["call_id"])
    return {
        "type": "get_active_call_response",
        "status": "active",
        "call_id": call_info["call_id"],
        "call_type": call_info["call_type"],
        "participants": participants_info
    }

def leave_call_service(pkt, user_id):
    call_id = pkt.get("call_id")
    conversation_id = get_call_by_id(call_id)
    
    leave_call(call_id, user_id)
    
    # broadcast updated participant list to remaining participants
    _broadcast_participants(call_id, conversation_id)
    
    return {
        "type": "leave_call_response",
        "status": "success"
    }

def end_call_service(pkt, user_id):
    call_id = pkt.get("call_id")
    duration = pkt.get("duration", 0)

    call_info = end_call(call_id)
    participants = get_call_participants(call_id)

    payload = {"type": "call_ended", "call_id": call_id}
    for uid in participants:
        conn = online_users.get(uid)
        if conn:
            try:
                send_packet(conn, payload)
            except Exception as e:
                print(f"❌ send call_ended failed to {uid}: {e}")

    if call_info:
        try:
            mins = str(int(duration) // 60).zfill(2)
            secs = str(int(duration) % 60).zfill(2)
            call_type_label = "วิดีโอคอล" if call_info.get("call_type") == "video" else "การโทร"
            text = f"📞 สิ้นสุด{call_type_label} ({mins}:{secs})"
            conversation_id = call_info["conversation_id"]
            result = create_message_service(str(conversation_id), str(user_id), text)
            if result.get("status") == "success":
                msg = result["message"]
                members = get_conversation_members_service(str(conversation_id))
                for member_id in members:
                    mid = str(member_id)
                    if mid in online_users:
                        try:
                            send_packet(online_users[mid], {
                                "type": "receive_message",
                                "conversation_id": str(conversation_id),
                                "message": msg
                            })
                        except Exception as e:
                            print(f"❌ send call-ended msg failed to {mid}: {e}")
        except Exception as e:
            import traceback
            traceback.print_exc()

    return {"type": "end_call_response", "status": "success"}
