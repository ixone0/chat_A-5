#client.py
import socket
import os
import packet
from dotenv import load_dotenv
from connection import create_connection

load_dotenv()

client = create_connection()
if not client:
    exit()

def login():
    print("\n--- LOGIN ---")
    username = input("Username: ")
    password = input("Password: ")
    
    client.send(packet.encode({
        "type": "login",
        "username": username,
        "password": password
    }))
    
    # รอรับผล Login
    response = packet.decode(client.recv(4096))
    if response.get("status") == "ok":
        print(f"Login Successful! Your ID: {response.get('user_id')}")
        return response.get("user_id")
    else:
        print(f"Login Failed: {response.get('message')}")
        return None

def register():
    print("\n--- REGISTER ---")
    username = input("Username: ")
    password = input("Password: ")
    display_name = input("Display Name (e.g. John Doe): ")
    
    client.send(packet.encode({
        "type": "register",
        "username": username,
        "password": password,
        "display_name": display_name
    }))
    
    response = packet.decode(client.recv(4096))
    print(f"Server: {response.get('message')}")

def create_conversation_menu(my_id):
    print("\n--- Create Group ---")
    title = input("Group Name: ")
    client.send(packet.encode({
        "type": "create_conversation",
        "title": title,
        "chat_type": "group"
    }))
    response = packet.decode(client.recv(4096))
    print(f"Server: {response}")

# --- MAIN LOOP ---
current_user_id = None

while True:
    if not current_user_id:
        print("\n=== WELCOME ===")
        print("1. Login")
        print("2. Register")
        print("3. Exit")
        choice = input("Select: ")
        
        if choice == "1":
            current_user_id = login()
        elif choice == "2":
            register()
        elif choice == "3":
            client.close()
            break
    else:
        # เมนูหลัง Login สำเร็จ
        print(f"\n=== LOGGED IN ({current_user_id}) ===")
        print("1. Create Conversation")
        print("2. Send Message (Coming Soon)")
        print("3. Logout")
        choice = input("Select: ")
        
        if choice == "1":
            create_conversation_menu(current_user_id)
        elif choice == "3":
            current_user_id = None
            print("Logged out.")