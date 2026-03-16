from repository.call_repo import (
    create_call,
    join_call,
    leave_call,
    end_call
)


def start_call_service(pkt, user_id):
    conversation_id = pkt.get("conversation_id")
    call_type = pkt.get("call_type")

    if call_type not in ["audio", "video"]:
        return {"status": "error", "message": "Invalid call type"}

    call_id = create_call(conversation_id, user_id, call_type)

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