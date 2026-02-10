#/backend/server/services/auth_service.py  
from repository.user_repo import get_user_by_username, create_user
import bcrypt

def login_user(pkt):
    # ใช้ .get() เพื่อกัน error ถ้าไม่มีคีย์ส่งมา
    username = pkt.get("username")
    password = pkt.get("password")

    if not username or not password:
        return None

    user = get_user_by_username(username)
    if not user:
        return None

    # แปลง password จาก user ที่ได้จาก DB ให้เป็น bytes ก่อนเช็ค
    # (สมมติว่าใน DB เก็บเป็น String hash)
    if bcrypt.checkpw(
        password.encode('utf-8'), 
        user["password_hash"].encode('utf-8')
    ):
        return user["id"] # UUID

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