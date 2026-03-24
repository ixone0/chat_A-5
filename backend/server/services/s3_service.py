import boto3
import base64
import uuid
import os

s3_client = boto3.client(
    's3',
    region_name=os.getenv("AWS_REGION", "ap-southeast-1")
)

BUCKET_NAME = os.getenv("S3_BUCKET_NAME")
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB in bytes


def upload_file_to_s3(base64_data: str, file_name: str, mime_type: str, sender_id: str) -> dict:
    """
    รับ base64 string → decode → upload S3
    คืนค่า s3_key และ file_url
    """
    # 1. decode base64
    try:
        file_bytes = base64.b64decode(base64_data)
    except Exception:
        raise ValueError("Invalid base64 data")

    # 2. ตรวจขนาดไฟล์ (max 10MB)
    if len(file_bytes) > MAX_FILE_SIZE:
        raise ValueError("File too large (max 10MB)")

    # 3. สร้าง key ใน S3: uploads/<sender_id>/<uuid>_<filename>
    file_id = str(uuid.uuid4())
    s3_key = f"uploads/{sender_id}/{file_id}_{file_name}"

    # 4. upload ขึ้น S3
    s3_client.put_object(
        Bucket=BUCKET_NAME,
        Key=s3_key,
        Body=file_bytes,
        ContentType=mime_type,
    )

    # 5. สร้าง public URL
    file_url = f"https://{BUCKET_NAME}.s3.amazonaws.com/{s3_key}"

    return {
        "s3_key": s3_key,
        "file_url": file_url,
        "file_size": len(file_bytes)
    }