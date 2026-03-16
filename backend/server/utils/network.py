import packet

def send_packet(conn, data: dict):
    try:
        encoded = packet.encode(data) + b"\n"
        conn.sendall(encoded)
    except Exception as e:
        print(f"[SEND ERROR] {e}")