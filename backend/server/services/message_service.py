#message_service.py
from repository.message_repo import insert_message
from repository.conversation_repo import get_members_by_conversation

def create_message_service(conversation_id, sender_id, content):
    try:
        message_id = insert_message(conversation_id, sender_id, content)

        return {
            "status": "success",
            "message": {
                "id": message_id,
                "conversation_id": conversation_id,
                "sender_id": sender_id,
                "content": content
            }
        }
    except Exception as e:
        return {
            "status": "error",
            "message": str(e)
        }




def get_conversation_members_service(conversation_id):
    return get_members_by_conversation(conversation_id)
