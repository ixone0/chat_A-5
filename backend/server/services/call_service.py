from repository.call_repo import (
    create_call,
    join_call,
    leave_call,
    end_call
)

from repository.conversation_repo import get_other_user
from state.online_users import online_users
from packet import send_packet


def send_packet_to_user(user_id, packet):

    conn = online_users.get(user_id)

    if conn:
        send_packet(conn, packet)


def start_call_service(pkt, user_id):

    conversation_id = pkt.get("conversation_id")
    call_type = pkt.get("call_type")

    if call_type not in ["voice", "video"]:
        return {"status": "error", "message": "Invalid call type"}

    call_id = create_call(conversation_id, user_id, call_type)

    join_call(call_id, user_id)

    other_user_id = get_other_user(conversation_id, user_id)

    send_packet_to_user(other_user_id, {
        "type": "incoming_call",
        "call_id": call_id,
        "conversation_id": conversation_id,
        "call_type": call_type,
        "from_user": user_id
    })

    return {
        "type": "start_call_response",
        "status": "success",
        "call_id": call_id
    }
        
def join_call_service(pkt, user_id):
    call_id = pkt.get("call_id")

    join_call(call_id, user_id)

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