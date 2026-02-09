from repository.conversation_repo import create_conversation, get_conversation_members

def handle_create_conversation(pkt, current_user_id):
    """
    ตรรกะการสร้างห้องแชทใหม่
    pkt: { "name": "ชื่อกลุ่ม", "members": [2, 3, 4] }
    """
    group_name = pkt.get("name", "Group Chat")
    member_ids = pkt.get("members", [])
    
    # ต้องเอาตัวคนสร้าง (current_user_id) ใส่เข้าไปในสมาชิกกลุ่มด้วย
    if current_user_id not in member_ids:
        member_ids.append(current_user_id)
    
    # สั่ง Repository ให้บันทึกลง DB
    new_conv_id = create_conversation(group_name, member_ids)
    
    if new_conv_id:
        return {
            "status": "success",
            "type": "create_conversation_res",
            "conversation_id": new_conv_id,
            "message": f"Conversation '{group_name}' created!"
        }
    else:
        return {
            "status": "error",
            "message": "Failed to create conversation"
        }

def get_members_in_chat(conversation_id):
    """
    ใช้สำหรับเช็คว่าในห้องนี้มีใครบ้าง (เอาไว้ส่งต่อให้ message_service ทำ broadcast)
    """
    members = get_conversation_members(conversation_id)
    return members