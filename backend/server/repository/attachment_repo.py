# repository/attachment_repo.py
import uuid
from datetime import datetime, timezone
from psycopg2.extras import RealDictCursor
from connection import get_connection


def insert_attachment(message_id: str, file_name: str, s3_key: str,
                      file_url: str, mime_type: str, file_size: int) -> dict:
    """
    บันทึก attachment ลง message_attachments table
    """
    conn = get_connection()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            attachment_id = str(uuid.uuid4())
            now = datetime.now(timezone.utc)

            cur.execute("""
                INSERT INTO message_attachments
                    (id, message_id, file_name, s3_key, file_url, mime_type, file_size, uploaded_at)
                VALUES
                    (%s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING *
            """, (attachment_id, message_id, file_name, s3_key,
                  file_url, mime_type, file_size, now))

            row = dict(cur.fetchone())
            conn.commit()

            # แปลง datetime → ISO string
            if row.get("uploaded_at"):
                row["uploaded_at"] = row["uploaded_at"].isoformat()

            return row
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def get_attachments_by_message(message_id: str) -> list:
    """
    ดึง attachments ทั้งหมดของ message หนึ่งๆ
    """
    conn = get_connection()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("""
                SELECT id, message_id, file_name, s3_key, file_url, mime_type, file_size, uploaded_at
                FROM message_attachments
                WHERE message_id = %s
                ORDER BY uploaded_at ASC
            """, (message_id,))

            rows = cur.fetchall()
            result = []
            for r in rows:
                r = dict(r)
                if r.get("uploaded_at"):
                    r["uploaded_at"] = r["uploaded_at"].isoformat()
                result.append(r)
            return result
    finally:
        conn.close()
# services/s3_service.py
