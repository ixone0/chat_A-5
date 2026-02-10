# backend/server/repository/user_repo.py
import psycopg2
from psycopg2.extras import RealDictCursor
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

def get_user_by_username(username):
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    
    query = "SELECT id, username, password_hash, display_name FROM users WHERE username = %s"
    cursor.execute(query, (username,))
    user = cursor.fetchone()
    
    # แปลง UUID เป็น string เพื่อให้ JSON ไม่พัง
    if user:
        user['id'] = str(user['id'])
        
    cursor.close()
    conn.close()
    return user

def create_user(username, password_hash, display_name):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        user_id = str(uuid.uuid4()) # สร้าง UUID
        # เพิ่ม display_name ตาม ER
        query = """
            INSERT INTO users (id, username, password_hash, display_name, created_at) 
            VALUES (%s, %s, %s, %s, CURRENT_TIMESTAMP)
        """
        cursor.execute(query, (user_id, username, password_hash, display_name))
        conn.commit()
        return user_id
    except Exception as e:
        print(f"Error creating user: {e}")
        return None
    finally:
        cursor.close()
        conn.close()