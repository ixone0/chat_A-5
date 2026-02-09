import socket
import os
from dotenv import load_dotenv

load_dotenv()

HOST = os.getenv("SERVER_HOST")
PORT = int(os.getenv("SERVER_PORT"))

def create_connection():
    client = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    client.connect((HOST, PORT))
    return client
