# backend/server/packet.py
import json
from uuid import UUID
from datetime import datetime

# สร้างตัวช่วยแปลงข้อมูล (Encoder) สำหรับ UUID และ DateTime
class CustomJSONEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, UUID):
            # ถ้าเจอ UUID ให้แปลงเป็น string
            return str(obj)
        if isinstance(obj, datetime):
            # ถ้าเจอ DateTime ให้แปลงเป็น string (ISO format)
            return obj.isoformat()
        return super().default(obj)

def encode(data):
    # ใช้ cls=CustomJSONEncoder เพื่อรองรับ UUID/Date
    return json.dumps(data, cls=CustomJSONEncoder).encode('utf-8')

def decode(data):
    return json.loads(data.decode('utf-8'))