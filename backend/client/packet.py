import json

def encode(data):
    return json.dumps(data).encode()

def decode(data):
    return json.loads(data.decode())
