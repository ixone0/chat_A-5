from repository.message_repo import insert_message

def send_message_service(pkt, sender_id, online_users):

    message_id = insert_message(
        pkt["conversation_id"],
        sender_id,
        pkt["content"]
    )

    # broadcast
    members = pkt["members"]

    for m in members:
        if m in online_users:
            online_users[m].send(...)
