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

def send_friend_request(from_user, target_custom_id):
    conn = get_connection()
    cur = conn.cursor()

    try:
        # 1. หา user_id ของเพื่อนจาก custom_id ก่อน
        cur.execute("SELECT id FROM users WHERE custom_id = %s", (target_custom_id,))
        row = cur.fetchone()
        if not row:
            return {"success": False, "message": "User not found."}
        
        to_user = row[0]

        # 2. ห้ามแอดตัวเอง
        if str(from_user) == str(to_user):
            return {"success": False, "message": "You cannot add yourself."}

        # 3. เช็คว่าเป็นเพื่อนกันอยู่แล้วหรือยัง
        cur.execute("""
            SELECT 1 FROM friendships 
            WHERE user_id = %s AND friend_id = %s
        """, (from_user, to_user))
        if cur.fetchone():
            return {"success": False, "message": "You are already friends."}

        # 4. เช็คว่าเคยส่งคำขอไปแล้วหรือยัง (หรือเขาขอเรามา)
        cur.execute("""
            SELECT 1 FROM friend_requests 
            WHERE (from_user = %s AND to_user = %s) 
               OR (from_user = %s AND to_user = %s)
        """, (from_user, to_user, to_user, from_user))
        if cur.fetchone():
            return {"success": False, "message": "Friend request already pending."}

        # 5. สร้างคำขอ
        cur.execute("""
            INSERT INTO friend_requests (from_user, to_user, status)
            VALUES (%s, %s, 'pending')
        """, (from_user, to_user))

        conn.commit()
        return {"success": True, "message": "Friend request sent!"}

    except Exception as e:
        conn.rollback()
        print(f"[DB Error] send_req: {e}")
        return {"success": False, "message": "Database error"}
    finally:
        cur.close()
        conn.close()


# ✅ 2. ฟังก์ชันดึงคำขอเป็นเพื่อน (ใครแอดเรามา)
def get_pending_requests(user_id):
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute("""
            SELECT r.id, u.username, u.display_name, u.custom_id, u.id
            FROM friend_requests r
            JOIN users u ON r.from_user = u.id
            WHERE r.to_user = %s AND r.status = 'pending'
        """, (user_id,))
        
        requests = []
        for row in cur.fetchall():
            requests.append({
                "request_id": row[0],
                "sender_username": row[1],
                "sender_name": row[2],
                "sender_custom_id": row[3],
                "sender_id": row[4]
            })
        return requests
    finally:
        cur.close()
        conn.close()


# ✅ 3. ฟังก์ชันตอบรับคำขอ (Accept)
def accept_friend_request(user_id, from_user):
    conn = get_connection()
    cur = conn.cursor()
    try:
        # 1. ลบคำขอออกจาก friend_requests
        cur.execute("""
            DELETE FROM friend_requests 
            WHERE from_user = %s AND to_user = %s
        """, (from_user, user_id))

        # 2. เพิ่มเพื่อนให้เรา (A -> B)
        cur.execute("""
            INSERT INTO friendships (user_id, friend_id)
            VALUES (%s, %s)
        """, (user_id, from_user))

        # 3. เพิ่มเพื่อนให้เขา (B -> A)
        cur.execute("""
            INSERT INTO friendships (user_id, friend_id)
            VALUES (%s, %s)
        """, (from_user, user_id))

        conn.commit()
        return {"success": True, "message": "Friend added!"}

    except Exception as e:
        conn.rollback()
        print(f"[DB Error] accept: {e}")
        return {"success": False, "message": "Database error"}
    finally:
        cur.close()
        conn.close()
