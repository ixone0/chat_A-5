#client/connection.py
import socket
import ssl
import os
from dotenv import load_dotenv

load_dotenv()

HOST = os.getenv("DB_HOST")
PORT = int(os.getenv("DB_PORT"))

def create_connection():
    raw = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    context = ssl.SSLContext(ssl.PROTOCOL_TLS_CLIENT)
    context.check_hostname = False
    context.verify_mode = ssl.CERT_NONE  # self-signed cert
    client = context.wrap_socket(raw, server_hostname=HOST)
    client.connect((HOST, PORT))
    return client
