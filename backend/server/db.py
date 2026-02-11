#server/db.py
from connection import get_connection   # ถ้ามี connection แยก
# หรือ from db import get_connection ถ้าอยู่ไฟล์เดียว


def save_message(client_id, ip, content):
    conn = get_connection()
    cur = conn.cursor()

    cur.execute("""
        INSERT INTO messages (content, msg_type)
        VALUES (%s, 'text')
    """, (content,))

    conn.commit()
    cur.close()
    conn.close()


def get_messages(client_id):
    conn = get_connection()
    cur = conn.cursor()

    cur.execute("""
        SELECT content, created_at
        FROM messages
        ORDER BY created_at DESC
        LIMIT 20
    """)

    rows = cur.fetchall()

    cur.close()
    conn.close()

    return rows

def find_user_by_custom_id(custom_id):
    conn = get_connection()
    cur = conn.cursor()

    try:
        # ดึงข้อมูล id, username, display_name จากตาราง users
        cur.execute("""
            SELECT id, username, display_name, custom_id
            FROM users
            WHERE custom_id = %s
        """, (custom_id,))
        
        row = cur.fetchone()
        
        if row:
            # แปลงข้อมูลเป็น Dict เพื่อส่งกลับไปง่ายๆ
            return {
                "user_id": row[0], # หรือ row['id'] ถ้าใช้ RealDictCursor
                "username": row[1],
                "display_name": row[2],
                "custom_id": row[3]
            }
        return None

    except Exception as e:
        print(f"Error finding user: {e}")
        return None
    finally:
        cur.close()
        conn.close()

def add_friend(user_id, friend_id):
    conn = get_connection()
    cur = conn.cursor()

    try:
        # บันทึกลงตาราง friends
        cur.execute("""
            INSERT INTO friends (user_id, friend_id, status)
            VALUES (%s, %s, 'accepted')
        """, (user_id, friend_id))
        
        conn.commit()
        return {"success": True, "message": "Friend added successfully"}

    except Exception as e:
        conn.rollback() # ยกเลิกถ้า error
        error_msg = str(e)
        
        # เช็ค Error Code ของ Postgres (23505 = Unique Violation แปลว่ามีข้อมูลซ้ำ)
        if "23505" in error_msg or "duplicate key" in error_msg:
            return {"success": False, "message": "You are already friends with this user."}
        
        # เช็ค Constraint (แอดตัวเองไม่ได้)
        if "check_not_self" in error_msg:
             return {"success": False, "message": "You cannot add yourself as a friend."}

        print(f"[DB Error] add_friend: {e}")
        return {"success": False, "message": "Database error"}
        
    finally:
        cur.close()
        conn.close()