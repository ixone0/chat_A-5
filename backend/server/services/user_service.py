# backend/services/user_service.py
from repository.user_repo import update_user_id, get_user_by_custom_id
import re

def change_custom_id(user_id, new_id):

    if not new_id:
        return {"success": False, "message": "ID is required"}

    # ⭐ regex validation
    if not re.match(r'^[a-zA-Z0-9_]{3,20}$', new_id):
        return {
            "success": False,
            "message": "ID must be 3-20 chars (a-z A-Z 0-9 _)"
        }

    if get_user_by_custom_id(new_id):
        return {
            "success": False,
            "message": "ID already exists"
        }

    success = update_user_id(user_id, new_id)

    return {"success": success}
