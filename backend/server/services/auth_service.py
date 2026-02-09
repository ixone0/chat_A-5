from repository.user_repo import get_user_by_username
import bcrypt

def login_user(pkt):

    user = get_user_by_username(pkt["username"])

    if not user:
        return None

    if bcrypt.checkpw(
        pkt["password"].encode(),
        user["password_hash"].encode()
    ):
        return user["id"]

    return None
