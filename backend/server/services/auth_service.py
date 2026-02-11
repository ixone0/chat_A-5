#/backend/server/services/auth_service.py  
from repository.user_repo import get_user_by_username, create_user, get_user_by_custom_id
import bcrypt
import random
import string

def generate_custom_id(length=6):
    return ''.join(random.choices(string.ascii_lowercase + string.digits, k=length))

def generate_unique_custom_id():
    while True:
        new_id = generate_custom_id()

        if not get_user_by_custom_id(new_id):
            return new_id

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
        return user

    return None

def register_user(pkt):
    username = pkt.get("username")
    password = pkt.get("password")
    display_name = pkt.get("display_name", username)

    if not username or not password:
        return {"status": "error", "message": "Missing username or password"}

    # 1. เช็คซ้ำ
    if get_user_by_username(username):
        return {"status": "error", "message": "Username already exists"}

    # ⭐ 2. สร้าง custom_id
    custom_id = generate_unique_custom_id()

    # 3. Hash Password
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password.encode(), salt).decode('utf-8')

    # ⭐ 4. บันทึก
    new_user_id = create_user(username, hashed, display_name, custom_id)

    if new_user_id:
        return {
            "status": "ok",
            "message": "Registration successful",
            "user_id": new_user_id,
            "custom_id": custom_id
        }
    else:
        return {"status": "error", "message": "Database error"}
