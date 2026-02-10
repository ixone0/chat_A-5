#a/backend/server/services/auth_service.py  
from repository.user_repo import get_user_by_username, create_user
import bcrypt

def login_user(pkt):
    user = get_user_by_username(pkt["username"])
    if not user:
        return None

    if bcrypt.checkpw(
        pkt["password"].encode(),
        user["password_hash"].encode()
    ):
        return user["id"] # ส่งกลับเป็น UUID string (จัดการใน repo แล้ว)

    return None

def register_user(pkt):
    username = pkt.get("username")
    password = pkt.get("password")
    display_name = pkt.get("display_name", username) # ถ้าไม่ส่งมา ให้ใช้ username แทน

    # 1. เช็คซ้ำ
    if get_user_by_username(username):
        return {"status": "error", "message": "Username already exists"}

    # 2. Hash Password
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password.encode(), salt).decode('utf-8')

    # 3. บันทึก
    new_user_id = create_user(username, hashed, display_name)
    
    if new_user_id:
        return {"status": "ok", "message": "Registration successful", "user_id": new_user_id}
    else:
        return {"status": "error", "message": "Database error"}