#massage_service.py
import packet
from repository.message_repo import insert_message
from services.conversation_service import get_members_in_chat # ดึงจาก DB ชัวร์กว่า

def send_message_service(pkt, sender_id, online_users):
    # 1. บันทึกลง Database
    conv_id = pkt["conversation_id"]
    content = pkt["content"]
    
    message_id = insert_message(
        conv_id,
        sender_id,
        content
    )

    # 2. ดึงสมาชิกที่อยู่ใน Conversation นี้จริงๆ จาก DB (ไม่เชื่อ Packet จาก Client)
    members = get_members_in_chat(conv_id)

    # 3. เตรียมก้อนข้อมูลที่จะส่ง (Broadcast Packet)
    # เราส่ง content และ sender_id กลับไปให้ทุกคนในกลุ่ม
    broadcast_data = packet.encode({
        "type": "new_message",
        "conversation_id": conv_id,
        "sender_id": sender_id,
        "content": content,
        "message_id": message_id
    })

    # 4. Loop ส่งหาทุกคนที่ออนไลน์อยู่
    for m_id in members:
        if m_id in online_users:
            try:
                # online_users[m_id] คือ socket ของ user คนนั้น
                online_users[m_id].send(broadcast_data)
            except Exception as e:
                print(f"Failed to send message to user {m_id}: {e}")
