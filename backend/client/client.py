# client.py
import socket
import os
import packet
from dotenv import load_dotenv
from connection import create_connection
import threading
import json

load_dotenv()

client = create_connection()
if not client:
    exit()


def listen_server():
    while True:
        try:
            data = client.recv(4096)
            if not data:
                print("Disconnected from server")
                break

            print("\n[SERVER RAW]:", data)
            pkt = packet.decode(data)
            print("[SERVER PKT]:", json.dumps(pkt, indent=2))

        except Exception as e:
            print("Listen error:", e)
            break


# เริ่ม thread ฟัง server
threading.Thread(target=listen_server, daemon=True).start()


def login():
    print("\n--- LOGIN ---")
    username = input("Username: ")
    password = input("Password: ")

    client.send(packet.encode({
        "type": "login",
        "username": username,
        "password": password
    }))


def update_user_id():
    print("\n--- UPDATE CUSTOM ID ---")
    user_id = input("User UUID: ")
    new_id = input("New ID: ")

    client.send(packet.encode({
        "type": "update_user_id",
        "user_id": user_id,
        "new_id": new_id
    }))


def search_user():
    print("\n--- SEARCH USER ---")
    target = input("Custom ID: ")

    client.send(packet.encode({
        "type": "search_user",
        "target_id": target
    }))


while True:
    print("\n1. Login")
    print("2. Update Custom ID")
    print("3. Search User")
    print("4. Exit")

    choice = input("Choose: ")

    if choice == "1":
        login()
    elif choice == "2":
        update_user_id()
    elif choice == "3":
        search_user()
    elif choice == "4":
        break
