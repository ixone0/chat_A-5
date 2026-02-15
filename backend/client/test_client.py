import socket
import json
import threading
import time

HOST = "13.212.120.46"
PORT = 8082

def listen(sock, name):
    while True:
        try:
            data = sock.recv(4096)
            if not data:
                break
            print(f"\n[{name} RECEIVED]: {data.decode()}")
        except:
            break

def create_client(name):
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.connect((HOST, PORT))
    threading.Thread(target=listen, args=(s, name), daemon=True).start()
    return s

def send(sock, data):
    sock.send(json.dumps(data).encode())

# -----------------------
# START TEST
# -----------------------

A = create_client("A")
B = create_client("B")

time.sleep(1)

# 1️⃣ Register A
send(A, {
    "type": "register",
    "username": "userA",
    "password": "1234",
    "request_id": "r1"
})

# 2️⃣ Register B
send(B, {
    "type": "register",
    "username": "userB",
    "password": "1234",
    "request_id": "r2"
})

time.sleep(1)

# 3️⃣ Login A
send(A, {
    "type": "login",
    "username": "userA",
    "password": "1234",
    "request_id": "r3"
})

# 4️⃣ Login B
send(B, {
    "type": "login",
    "username": "userB",
    "password": "1234",
    "request_id": "r4"
})

time.sleep(2)

print("\n🔎 ดู log เพื่อเอา user_id ของ A และ B แล้วใส่ด้านล่าง\n")
