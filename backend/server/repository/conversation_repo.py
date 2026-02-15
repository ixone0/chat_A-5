#conversation_repo.py
import psycopg2
import os
import uuid

def get_db_connection():
    return psycopg2.connect(
        host=os.getenv("DB_HOST"),
        port=os.getenv("DB_PORT"),
        database=os.getenv("DB_NAME"),
        user=os.getenv("DB_USER"),
        password=os.getenv("DB_PASSWORD")
    )

def create_conversation_db(title, owner_id, chat_type="group"):
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
