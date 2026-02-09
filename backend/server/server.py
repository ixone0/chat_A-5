import socket
from database import init_db
from handler import handle_client

HOST = "0.0.0.0"
PORT = 8082

init_db()

server = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
server.bind((HOST, PORT))
server.listen()

print("[SERVER] Listening...")

while True:
    client, addr = server.accept()
    print(f"[SERVER] Connected from {addr}")
    handle_client(client, addr)
