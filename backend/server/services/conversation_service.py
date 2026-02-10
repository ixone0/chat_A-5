from repository.conversation_repo import create_conversation_db, get_members_by_conversation

def handle_create_conversation(pkt, owner_id):
    title = pkt.get("title", "New Group")
    chat_type = pkt.get("chat_type", "group")
    
    # สร้างห้องใน DB
    conv_id = create_conversation_db(title, owner_id, chat_type)
    
    if conv_id:
        return {
            "status": "ok",
            "type": "create_conversation_success",
            "conversation_id": conv_id,
            "title": title
        }
    else:
        return {"status": "error", "message": "Could not create conversation"}

def get_chat_members_service(conversation_id):
    return get_members_by_conversation(conversation_id)