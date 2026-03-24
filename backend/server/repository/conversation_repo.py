# repository/conversation_repo.py
import psycopg2
import os
import uuid
from connection import get_connection

def get_db_connection():
    """สร้างการเชื่อมต่อกับ Database โดยใช้ค่าจาก environment variables"""
    return psycopg2.connect(
        host=os.getenv("DB_HOST"),
        port=os.getenv("DB_PORT"),
        database=os.getenv("DB_NAME"),
        user=os.getenv("DB_USER"),
        password=os.getenv("DB_PASSWORD")
    )

def get_other_user(conversation_id, user_id):
    """หา ID ของอีกฝ่ายในแชทแบบ Direct"""
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute("""
            SELECT user_id
            FROM conversation_members
            WHERE conversation_id = %s AND user_id != %s
        """, (conversation_id, user_id))
        row = cur.fetchone()
        return row[0] if row else None
    finally:
        cur.close()
        conn.close()

def create_conversation_db(title, owner_id, chat_type="group"):
    """สร้างห้องแชทแบบพื้นฐาน (1-on-1 หรือกลุ่มเริ่มต้น)"""
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        conv_id = str(uuid.uuid4())
        
        # 1. สร้างห้อง
        query = """
            INSERT INTO conversations (id, type, title, owner_id, created_at) 
            VALUES (%s, %s, %s, %s, CURRENT_TIMESTAMP)
        """
        cursor.execute(query, (conv_id, chat_type, title, owner_id))
        
        # 2. เพิ่มเจ้าของห้องเป็นสมาชิกคนแรก
        member_query = """
            INSERT INTO conversation_members (conversation_id, user_id, role, joined_at) 
            VALUES (%s, %s, %s, CURRENT_TIMESTAMP)
        """
        cursor.execute(member_query, (conv_id, owner_id, 'owner'))
        
        conn.commit()
        return conv_id
    except Exception as e:
        print(f"Error create_conversation_db: {e}")
        conn.rollback()
        return None
    finally:
        cursor.close()
        conn.close()

def get_members_by_conversation(conversation_id):
    """ดึงรายชื่อสมาชิกทุกคนในห้องแชท"""
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute(
                "SELECT user_id FROM conversation_members WHERE conversation_id = %s",
                (conversation_id,)
            )
            return [str(row[0]) for row in cursor.fetchall()]
    finally:
        conn.close()

def get_user_conversations_db(user_id):
    """ดึงรายการแชททั้งหมดของผู้ใช้ พร้อมบอก Role ว่าเป็น owner หรือ member"""
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            # ดึงข้อมูล cm.role และ c.owner_id มาด้วยเพื่อให้ Frontend เช็คสิทธิ์การแก้ไขได้
            cursor.execute("""
                SELECT c.id, c.title, c.type, c.created_at, cm.role, c.owner_id
                FROM conversations c
                JOIN conversation_members cm
                  ON cm.conversation_id = c.id
                WHERE cm.user_id = %s
                ORDER BY c.created_at DESC
            """, (user_id,))

            rows = cursor.fetchall()

            return [
                {
                    "id": str(row[0]),
                    "title": row[1],
                    "type": row[2],
                    "created_at": row[3].isoformat() if row[3] else None,
                    "role": row[4], # ส่ง role (owner/member) กลับไปให้ React
                    "owner_id": str(row[5]) if row[5] else None # ส่ง owner_id สำหรับ fallback
                }
                for row in rows
            ]
    finally:
        conn.close()

# ==========================================
# 🚀 ฟังก์ชันสำหรับสร้างกลุ่มพร้อมดึงเพื่อนหลายคน
# ==========================================
def create_group_with_members_db(title, chat_type, members):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        conv_id = str(uuid.uuid4())
        
        # ดึงคนสร้าง (Creator) มาจากคนสุดท้ายของ list (ตาม logic ใน service)
        owner_id = members[-1] if members else None
        
        # 1. สร้างห้องแชท
        query = """
            INSERT INTO conversations (id, type, title, owner_id, created_at) 
            VALUES (%s, %s, %s, %s, CURRENT_TIMESTAMP)
        """
        cursor.execute(query, (conv_id, chat_type, title, owner_id))
        
        # 2. วนลูปยัดเพื่อนทุกคนเข้าไปในห้อง
        member_query = """
            INSERT INTO conversation_members (conversation_id, user_id, role, joined_at) 
            VALUES (%s, %s, %s, CURRENT_TIMESTAMP)
        """
        for member_id in members:
            # กำหนดสิทธิ์: คนสร้างเป็น owner คนที่ถูกเชิญเป็น member
            role = 'owner' if member_id == owner_id else 'member'
            cursor.execute(member_query, (conv_id, member_id, role))
            
        conn.commit()
        return conv_id
    except Exception as e:
        print(f"Error create_group_with_members_db: {e}")
        conn.rollback()
        raise e
    finally:
        cursor.close()
        conn.close()

# ==========================================
# ✏️ ฟังก์ชันสำหรับแก้ไขชื่อกลุ่ม (เฉพาะ Owner)
# ==========================================
def update_conversation_title_db(conv_id, new_title):
    """อัปเดตชื่อ title ในตาราง conversations"""
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            "UPDATE conversations SET title = %s WHERE id = %s",
            (new_title, conv_id)
        )
        conn.commit()
        # เช็คว่ามีการแก้ไขจริงไหม (เผื่อส่ง ID ผิด)
        return cursor.rowcount > 0
    except Exception as e:
        print(f"Error update_conversation_title_db: {e}")
        conn.rollback()
        return False
    finally:
        cursor.close()
        conn.close()