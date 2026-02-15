#message_service.py
from repository.message_repo import insert_message, get_messages_by_conversation
from repository.conversation_repo import get_members_by_conversation

def create_message_service(conversation_id, sender_id, content):
    try:
        message = insert_message(conversation_id, sender_id, content)

        return {
            "status": "success",
            "message": message 
        }
    except Exception as e:
        return {
            "status": "error",
            "message": str(e)
        }




def get_conversation_members_service(conversation_id):
    return get_members_by_conversation(conversation_id)
