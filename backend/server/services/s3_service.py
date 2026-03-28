import boto3
import base64
import uuid
import os

MAX_FILE_SIZE = 25 * 1024 * 1024  # 25 MB in bytes


def upload_file_to_s3(base64_data: str, file_name: str, mime_type: str, sender_id: str) -> dict:
    print(os.getenv("S3_BUCKET_NAME"))
    bucket_name = os.getenv("S3_BUCKET_NAME")
    s3_client = boto3.client(
        's3',
        region_name=os.getenv("AWS_REGION", "ap-southeast-1"),
        aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID"),
        aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY"),
    )

    try:
        file_bytes = base64.b64decode(base64_data)
    except Exception:
        raise ValueError("Invalid base64 data")

    if len(file_bytes) > MAX_FILE_SIZE:
        raise ValueError("File too large (max 25MB)")

    file_id = str(uuid.uuid4())
    s3_key = f"uploads/{sender_id}/{file_id}_{file_name}"

    s3_client.put_object(
        Bucket=bucket_name,
        Key=s3_key,
        Body=file_bytes,
        ContentType=mime_type,
    )

    file_url = f"https://{bucket_name}.s3.amazonaws.com/{s3_key}"

    return {
        "s3_key": s3_key,
        "file_url": file_url,
        "file_size": len(file_bytes)
    }