import sqlite3 # หรือ import mysql.connector

def get_db_connection():
    conn = sqlite3.connect('chat_app.db')
    conn.row_factory = sqlite3.Row  # เพื่อให้เข้าถึงข้อมูลแบบ dictionary ได้: user['username']
    return conn

def get_user_by_username(username):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    query = "SELECT id, username, password_hash FROM users WHERE username = ?"
    cursor.execute(query, (username,))
    user = cursor.fetchone()
    
    conn.close()
    return user

def create_user(username, password_hash):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        query = "INSERT INTO users (username, password_hash) VALUES (?, ?)"
        cursor.execute(query, (username, password_hash))
        conn.commit()
        return cursor.lastrowid
    except Exception as e:
        print(f"Error creating user: {e}")
        return None
    finally:
        conn.close()