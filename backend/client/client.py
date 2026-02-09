import os
from dotenv import load_dotenv
import packet
from connection import create_connection

load_dotenv()

# ในระบบใหม่ CLIENT_ID ควรจะได้มาหลังจาก Login สำเร็จ
# แต่ถ้าจะใช้จาก .env เพื่อทดสอบก่อนก็ได้ครับ
CLIENT_ID = os.getenv("CLIENT_ID") 

client = create_connection()

def login():
    print("--- Login to Chat Server ---")
    username = input("Username: ")
    password = input("Password: ")
    
    # ส่ง Packet ตามโครงสร้าง Step 8
    client.send(packet.encode({
        "type": "login",
        "username": username,
        "password": password
    }))
    
    res = packet.decode(client.recv(4096))
    if res.get("status") == "ok":
        print("Login Successful!")
        return res.get("user_id") # Server ควรส่ง ID กลับมาให้
    else:
        print("Login Failed!")
        return None

# -------- เริ่มการทำงาน --------
user_id = login()

if user_id:
    # -------- SYNC ข้อความเก่า (ตามโครงสร้าง ER: ใช้ conversation_id) --------
    conv_id = input("Enter Conversation ID to sync: ")
    client.send(packet.encode({
        "type": "history",
        "conversation_id": int(conv_id)
    }))

    data = client.recv(4096)
    history = packet.decode(data)

    if isinstance(history, list): # ถ้า server ส่งกลับมาเป็น list ของ messages
        print("\n--- Chat History ---")
        for m in history:
            # อ้างอิงตาม ER: ตาราง messages มี column 'content'
            print(f"{m.get('username', 'Unknown')}: {m.get('content')}")

    # -------- Loop ส่งข้อความใหม่ --------
    print("\n--- Start Chatting (type 'exit' to quit) ---")
    while True:
        msg = input(">> ")
        if msg.lower() == "exit": break

        # ส่งข้อความตามโครงสร้าง Step 8
        client.send(packet.encode({
            "type": "send_message",
            "conversation_id": int(conv_id),
            "content": msg
        }))

        # รับยืนยัน (หรือรับข้อความ Broadcast)
        response = packet.decode(client.recv(4096))
        print("[SERVER]", response)