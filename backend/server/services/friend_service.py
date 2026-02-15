# services/friend_service.py

from repository.friend_repo import (
    get_user_friends,
    get_or_create_direct_conversation,
)

def handle_get_friends(user_id):
    try:
        friends = get_user_friends(user_id)
        return {
            "status": "success",
            "type": "friends_list",
            "friends": friends
        }
    except Exception as e:
        return {
            "status": "error",
            "message": str(e)
        }


def handle_start_direct_chat(user_id, friend_id):
    try:
        conv_id = get_or_create_direct_conversation(user_id, friend_id)
        return {
            "status": "success",
            "type": "start_direct_chat_response",
            "conversation_id": conv_id
        }
    except Exception as e:
        return {
            "status": "error",
            "message": str(e)
        }
