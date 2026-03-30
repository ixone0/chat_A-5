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
            cursor.execute("""
                SELECT c.id, c.title, c.type, c.created_at, cm.role, c.owner_id,
                       (SELECT COUNT(*) FROM conversation_members cm2 WHERE cm2.conversation_id = c.id) as member_count,
                       (SELECT m.content FROM messages m WHERE m.conversation_id = c.id ORDER BY m.created_at DESC LIMIT 1) as last_message,
                       (SELECT m.created_at FROM messages m WHERE m.conversation_id = c.id ORDER BY m.created_at DESC LIMIT 1) as last_message_at
                FROM conversations c
                JOIN conversation_members cm
                  ON cm.conversation_id = c.id
                WHERE cm.user_id = %s
                ORDER BY COALESCE(
                    (SELECT m.created_at FROM messages m WHERE m.conversation_id = c.id ORDER BY m.created_at DESC LIMIT 1),
                    c.created_at
                ) DESC
            """, (user_id,))

            rows = cursor.fetchall()

            return [
                {
                    "id": str(row[0]),
                    "title": row[1],
                    "type": row[2],
                    "created_at": row[3].isoformat() if row[3] else None,
                    "role": row[4],
                    "owner_id": str(row[5]) if row[5] else None,
                    "member_count": row[6] or 0,
                    "last_message": row[7] or None,
                    "last_message_at": row[8].isoformat() if row[8] else None
                }
                for row in rows
            ]
    finally:
        conn.close()

# ==========================================
# 🚀 ฟังก์ชันสำหรับสร้างกลุ่มพร้อมดึงเพื่อนหลายคน
# ==========================================
def create_group_with_members_db(title, chat_type, members, creator_id=None):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        conv_id = str(uuid.uuid4())
        
        # ใช้ creator_id ที่ส่งมาตรงๆ เพื่อความถูกต้อง
        owner_id = creator_id if creator_id else (members[0] if members else None)
        
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


# ==========================================
# 👥 ดึงรายชื่อสมาชิกพร้อมข้อมูล user (สำหรับแสดงใน UI)
# ==========================================
def get_group_members_detail_db(conversation_id):
    """ดึงสมาชิกทุกคนพร้อม username, display_name, custom_id, role"""
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute("""
                SELECT u.id, u.username, u.display_name, u.custom_id, cm.role
                FROM conversation_members cm
                JOIN users u ON u.id = cm.user_id
                WHERE cm.conversation_id = %s
                ORDER BY 
                    CASE cm.role WHEN 'owner' THEN 0 ELSE 1 END,
                    cm.joined_at ASC
            """, (conversation_id,))
            rows = cursor.fetchall()
            return [
                {
                    "user_id": str(row[0]),
                    "username": row[1],
                    "display_name": row[2],
                    "custom_id": row[3],
                    "role": row[4]
                }
                for row in rows
            ]
    finally:
        conn.close()

# ==========================================
# ➕ เพิ่มสมาชิกเข้ากลุ่ม (เช็ค duplicate)
# ==========================================
def add_members_to_group_db(conversation_id, new_member_ids):
    """เพิ่มสมาชิกใหม่เข้ากลุ่ม คืน list ของ member_id ที่เพิ่มสำเร็จ"""
    conn = get_db_connection()
    cursor = conn.cursor()
    added = []
    try:
        for member_id in new_member_ids:
            # เช็คว่าอยู่ในกลุ่มแล้วหรือยัง
            cursor.execute(
                "SELECT 1 FROM conversation_members WHERE conversation_id = %s AND user_id = %s",
                (conversation_id, member_id)
            )
            if cursor.fetchone():
                continue  # อยู่แล้ว ข้าม

            cursor.execute("""
                INSERT INTO conversation_members (conversation_id, user_id, role, joined_at)
                VALUES (%s, %s, 'member', CURRENT_TIMESTAMP)
            """, (conversation_id, member_id))
            added.append(member_id)

        conn.commit()
        return added
    except Exception as e:
        print(f"Error add_members_to_group_db: {e}")
        conn.rollback()
        raise e
    finally:
        cursor.close()
        conn.close()

# ==========================================
# ❌ เตะสมาชิกออกจากกลุ่ม
# ==========================================
def remove_member_from_group_db(conversation_id, target_user_id):
    """ลบสมาชิกออกจากกลุ่ม คืน True ถ้าลบสำเร็จ"""
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("""
            DELETE FROM conversation_members
            WHERE conversation_id = %s AND user_id = %s AND role != 'owner'
        """, (conversation_id, target_user_id))
        conn.commit()
        return cursor.rowcount > 0
    except Exception as e:
        print(f"Error remove_member_from_group_db: {e}")
        conn.rollback()
        return False
    finally:
        cursor.close()
        conn.close()

# ==========================================
# 🔍 เช็คว่า user เป็น owner ของ conversation นี้ไหม
# ==========================================
def is_conversation_owner(conversation_id, user_id):
    """คืน True ถ้า user_id เป็น owner ของ conversation_id"""
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute("""
                SELECT 1 FROM conversation_members
                WHERE conversation_id = %s AND user_id = %s AND role = 'owner'
            """, (conversation_id, user_id))
            return cursor.fetchone() is not None
    finally:
        conn.close()

# ==========================================
# 🚪 ออกจากกลุ่ม (สำหรับ member ที่ไม่ใช่ owner)
# ==========================================
def leave_group_db(conversation_id, user_id):
    """ลบตัวเองออกจากกลุ่ม คืน True ถ้าสำเร็จ (owner ออกไม่ได้)"""
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("""
            DELETE FROM conversation_members
            WHERE conversation_id = %s AND user_id = %s AND role != 'owner'
        """, (conversation_id, user_id))
        conn.commit()
        return cursor.rowcount > 0
    except Exception as e:
        print(f"Error leave_group_db: {e}")
        conn.rollback()
        return False
    finally:
        cursor.close()
        conn.close()

# ==========================================
# 🗑️ ลบกลุ่ม (เฉพาะ Owner)
# ==========================================
def delete_group_db(conversation_id):
    """ลบกลุ่มทั้งหมด (สมาชิก + ห้อง) คืน True ถ้าสำเร็จ"""
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        # ลบสมาชิกก่อน
        cursor.execute(
            "DELETE FROM conversation_members WHERE conversation_id = %s",
            (conversation_id,)
        )
        # ลบข้อความ (ถ้ามี)
        cursor.execute(
            "DELETE FROM messages WHERE conversation_id = %s",
            (conversation_id,)
        )
        # ลบห้อง
        cursor.execute(
            "DELETE FROM conversations WHERE id = %s AND type = 'group'",
            (conversation_id,)
        )
        deleted = cursor.rowcount > 0
        conn.commit()
        return deleted
    except Exception as e:
        print(f"Error delete_group_db: {e}")
        conn.rollback()
        return False
    finally:
        cursor.close()
        conn.close()

# ==========================================
# 👑 โอนหัวหน้ากลุ่ม
# ==========================================
def transfer_ownership_db(conversation_id, old_owner_id, new_owner_id):
    """โอน ownership จาก old_owner ไป new_owner คืน True ถ้าสำเร็จ"""
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        # เช็คว่า new_owner เป็นสมาชิกอยู่จริง
        cursor.execute(
            "SELECT 1 FROM conversation_members WHERE conversation_id = %s AND user_id = %s",
            (conversation_id, new_owner_id)
        )
        if not cursor.fetchone():
            return False

        # เปลี่ยน role ของ owner เดิมเป็น member
        cursor.execute("""
            UPDATE conversation_members SET role = 'member'
            WHERE conversation_id = %s AND user_id = %s AND role = 'owner'
        """, (conversation_id, old_owner_id))

        # เปลี่ยน role ของ owner ใหม่เป็น owner
        cursor.execute("""
            UPDATE conversation_members SET role = 'owner'
            WHERE conversation_id = %s AND user_id = %s
        """, (conversation_id, new_owner_id))

        # อัปเดต owner_id ในตาราง conversations ด้วย
        cursor.execute("""
            UPDATE conversations SET owner_id = %s WHERE id = %s
        """, (new_owner_id, conversation_id))

        conn.commit()
        return True
    except Exception as e:
        print(f"Error transfer_ownership_db: {e}")
        conn.rollback()
        return False
    finally:
        cursor.close()
        conn.close()

# ==========================================
# 📊 นับจำนวนสมาชิกในกลุ่ม
# ==========================================
def get_member_count_db(conversation_id):
    """คืนจำนวนสมาชิกในกลุ่ม"""
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute(
                "SELECT COUNT(*) FROM conversation_members WHERE conversation_id = %s",
                (conversation_id,)
            )
            row = cursor.fetchone()
            return row[0] if row else 0
    finally:
        conn.close()

# ==========================================
# 📝 Group Description
# ==========================================
def update_group_description_db(conv_id, description):
    """อัปเดต description ของกลุ่ม (ต้องมี column description ใน conversations table)"""
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            "UPDATE conversations SET description = %s WHERE id = %s",
            (description, conv_id)
        )
        conn.commit()
        return cursor.rowcount > 0
    except Exception as e:
        print(f"Error update_group_description_db: {e}")
        conn.rollback()
        return False
    finally:
        cursor.close()
        conn.close()

def get_group_info_db(conv_id):
    """ดึงข้อมูลกลุ่ม (title, description, owner_id)"""
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            # ลอง query แบบมี description ก่อน
            try:
                cursor.execute("""
                    SELECT id, title, type, owner_id, description
                    FROM conversations WHERE id = %s
                """, (conv_id,))
                row = cursor.fetchone()
                if not row:
                    return None
                return {
                    "id": str(row[0]),
                    "title": row[1],
                    "type": row[2],
                    "owner_id": str(row[3]) if row[3] else None,
                    "description": row[4] or ""
                }
            except Exception:
                # Fallback ถ้า column description ยังไม่มี
                conn.rollback()
                cursor.execute("""
                    SELECT id, title, type, owner_id
                    FROM conversations WHERE id = %s
                """, (conv_id,))
                row = cursor.fetchone()
                if not row:
                    return None
                return {
                    "id": str(row[0]),
                    "title": row[1],
                    "type": row[2],
                    "owner_id": str(row[3]) if row[3] else None,
                    "description": ""
                }
    except Exception as e:
        print(f"get_group_info_db error: {e}")
        return None
    finally:
        conn.close()

# ==========================================
# 🔇 Mute/Unmute group (per user)
# ==========================================
def set_mute_status_db(conversation_id, user_id, muted):
    """ตั้งค่า mute สำหรับ user ใน conversation (ใช้ column muted ใน conversation_members)"""
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("""
            UPDATE conversation_members SET muted = %s
            WHERE conversation_id = %s AND user_id = %s
        """, (muted, conversation_id, user_id))
        conn.commit()
        return cursor.rowcount > 0
    except Exception as e:
        print(f"Error set_mute_status_db: {e}")
        conn.rollback()
        return False
    finally:
        cursor.close()
        conn.close()

# ==========================================
# 📌 Pin Message
# ==========================================
def pin_message_db(conversation_id, message_id):
    """Pin a message in a conversation"""
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("""
            UPDATE messages SET pinned = TRUE
            WHERE id = %s AND conversation_id = %s
        """, (message_id, conversation_id))
        conn.commit()
        return cursor.rowcount > 0
    except Exception as e:
        print(f"Error pin_message_db: {e}")
        conn.rollback()
        return False
    finally:
        cursor.close()
        conn.close()

def unpin_message_db(conversation_id, message_id):
    """Unpin a message"""
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("""
            UPDATE messages SET pinned = FALSE
            WHERE id = %s AND conversation_id = %s
        """, (message_id, conversation_id))
        conn.commit()
        return cursor.rowcount > 0
    except Exception as e:
        print(f"Error unpin_message_db: {e}")
        conn.rollback()
        return False
    finally:
        cursor.close()
        conn.close()

def get_pinned_messages_db(conversation_id):
    """ดึงข้อความที่ถูก pin ทั้งหมด"""
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute("""
                SELECT m.id, m.content, m.sender_id, m.created_at, u.username, u.display_name
                FROM messages m
                LEFT JOIN users u ON u.id = m.sender_id
                WHERE m.conversation_id = %s AND m.pinned = TRUE
                ORDER BY m.created_at DESC
            """, (conversation_id,))
            rows = cursor.fetchall()
            return [
                {
                    "id": str(row[0]),
                    "content": row[1],
                    "sender_id": str(row[2]) if row[2] else None,
                    "created_at": row[3].isoformat() if row[3] else None,
                    "username": row[4],
                    "display_name": row[5]
                }
                for row in rows
            ]
    except Exception as e:
        print(f"Error get_pinned_messages_db: {e}")
        return []
    finally:
        conn.close()

# ==========================================
# 🛡️ Admin role management
# ==========================================
def set_member_role_db(conversation_id, target_user_id, new_role):
    """เปลี่ยน role ของสมาชิก (owner ห้ามเปลี่ยนผ่านฟังก์ชันนี้)"""
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        if new_role not in ('admin', 'member'):
            return False
        cursor.execute("""
            UPDATE conversation_members SET role = %s
            WHERE conversation_id = %s AND user_id = %s AND role != 'owner'
        """, (new_role, conversation_id, target_user_id))
        conn.commit()
        return cursor.rowcount > 0
    except Exception as e:
        print(f"Error set_member_role_db: {e}")
        conn.rollback()
        return False
    finally:
        cursor.close()
        conn.close()

def is_conversation_admin_or_owner(conversation_id, user_id):
    """เช็คว่า user เป็น owner หรือ admin"""
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute("""
                SELECT role FROM conversation_members
                WHERE conversation_id = %s AND user_id = %s
            """, (conversation_id, user_id))
            row = cursor.fetchone()
            return row[0] in ('owner', 'admin') if row else False
    finally:
        conn.close()
