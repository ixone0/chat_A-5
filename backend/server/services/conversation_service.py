#services/conversation_service.py
from repository.conversation_repo import (
    create_conversation_db,
    get_members_by_conversation,
    get_user_conversations_db,
    create_group_with_members_db
)

VALID_CHAT_TYPES = ["group", "direct"]

def handle_create_conversation(pkt, owner_id):
    title = pkt.get("title")
    chat_type = pkt.get("chat_type", "group")

    if chat_type not in VALID_CHAT_TYPES:
        return {"status": "error", "message": "Invalid chat type"}

    try:
        conv_id = create_conversation_db(title, owner_id, chat_type)
    except Exception as e:
        return {"status": "error", "message": str(e)}

    return {
        "status": "success",
        "type": "create_conversation_response",
        "conversation_id": conv_id,
        "chat_type": chat_type
    }



def get_conversation_members_service(conversation_id):
    return get_members_by_conversation(conversation_id)

def get_user_conversations(user_id):
    return get_user_conversations_db(user_id)

def handle_create_group_chat(pkt, creator_id):
    title = pkt.get("title", "New Group")
    members = pkt.get("members", []) # คาดหวังเป็น List ของ user_id
    
    # เอาตัวคนสร้าง (Creator) ใส่เข้าไปในกลุ่มด้วย ถ้ายังไม่มี
    if creator_id not in members:
        members.append(creator_id)

    try:
        # เรียกใช้ DB เพื่อสร้างห้องและยัดสมาชิกทุกคนลงไป
        conv_id = create_group_with_members_db(title, chat_type="group", members=members)
    except Exception as e:
        return {"status": "error", "message": str(e)}

    return {
        "status": "success",
        "type": "create_group_chat_response",
        "conversation_id": conv_id,
        "title": title,
        "members": members
    }

