"""Authenticated one-to-one messaging between a user and an expert."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import aliased

from lib.auth import current_user
from lib.pg import get_db
from models.schemas import ChatMessageIn, ChatMessageOut, ChatThreadOut
from models.tables import ChatMessage, ChatThread, ExpertProfile, User, utcnow

router = APIRouter(prefix="/chats", tags=["chats"])


def _summary_query():
    chat_user = aliased(User)
    expert_user = aliased(User)
    latest_message = (
        select(ChatMessage.body)
        .where(ChatMessage.thread_id == ChatThread.id)
        .order_by(ChatMessage.created_at.desc(), ChatMessage.id.desc())
        .limit(1)
        .scalar_subquery()
    )
    statement = (
        select(
            ChatThread.id,
            ChatThread.user_id,
            chat_user.full_name,
            ChatThread.expert_id,
            expert_user.full_name,
            ExpertProfile.profession,
            ExpertProfile.photo_mime,
            latest_message,
            ChatThread.updated_at,
        )
        .join(chat_user, chat_user.id == ChatThread.user_id)
        .join(ExpertProfile, ExpertProfile.id == ChatThread.expert_id)
        .join(expert_user, expert_user.id == ExpertProfile.user_id)
    )
    return statement


def _to_thread_out(row) -> ChatThreadOut:
    return ChatThreadOut(
        id=row[0],
        user_id=row[1],
        user_name=row[2],
        expert_id=row[3],
        expert_name=row[4],
        expert_profession=row[5],
        expert_photo_url=f"/api/experts/{row[3]}/photo" if row[6] else None,
        latest_message=row[7],
        updated_at=row[8],
    )


async def _accessible_thread(db: AsyncSession, thread_id: str, user: User) -> ChatThread:
    statement = (
        select(ChatThread)
        .join(ExpertProfile, ExpertProfile.id == ChatThread.expert_id)
        .where(ChatThread.id == thread_id)
    )
    if user.role == "user":
        statement = statement.where(ChatThread.user_id == user.id)
    elif user.role == "expert":
        statement = statement.where(ExpertProfile.user_id == user.id)
    else:
        raise HTTPException(403, "Only chat participants can access messages")
    thread = (await db.execute(statement)).scalar_one_or_none()
    if not thread:
        raise HTTPException(404, "Conversation not found")
    return thread


@router.post("/experts/{expert_id}", response_model=ChatThreadOut)
async def open_expert_chat(
    expert_id: str,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
):
    if user.role != "user":
        raise HTTPException(403, "Only user accounts can start an expert chat")

    expert = (await db.execute(select(ExpertProfile).where(ExpertProfile.id == expert_id))).scalar_one_or_none()
    if not expert or expert.status != "approved":
        raise HTTPException(404, "Expert not found")
    if expert.user_id == user.id:
        raise HTTPException(400, "You cannot start a chat with yourself")
    if not expert.available_now:
        raise HTTPException(409, "This expert is no longer available to chat")

    thread = (
        await db.execute(
            select(ChatThread).where(ChatThread.user_id == user.id, ChatThread.expert_id == expert.id)
        )
    ).scalar_one_or_none()
    if not thread:
        thread = ChatThread(user_id=user.id, expert_id=expert.id)
        db.add(thread)
        try:
            await db.commit()
        except IntegrityError:
            # A second tab may have created the same user/expert conversation concurrently.
            await db.rollback()
            thread = (
                await db.execute(
                    select(ChatThread).where(ChatThread.user_id == user.id, ChatThread.expert_id == expert.id)
                )
            ).scalar_one_or_none()
            if not thread:
                raise
        else:
            await db.refresh(thread)

    row = (
        await db.execute(_summary_query().where(ChatThread.id == thread.id))
    ).one()
    return _to_thread_out(row)


@router.get("", response_model=list[ChatThreadOut])
async def list_chats(user: User = Depends(current_user), db: AsyncSession = Depends(get_db)):
    statement = _summary_query()
    if user.role == "user":
        statement = statement.where(ChatThread.user_id == user.id)
    elif user.role == "expert":
        statement = statement.where(ExpertProfile.user_id == user.id)
    else:
        raise HTTPException(403, "Only chat participants can access conversations")
    rows = (await db.execute(statement.order_by(ChatThread.updated_at.desc()).limit(100))).all()
    return [_to_thread_out(row) for row in rows]


@router.get("/{thread_id}", response_model=ChatThreadOut)
async def get_chat(thread_id: str, user: User = Depends(current_user), db: AsyncSession = Depends(get_db)):
    await _accessible_thread(db, thread_id, user)
    row = (await db.execute(_summary_query().where(ChatThread.id == thread_id))).one_or_none()
    if not row:
        raise HTTPException(404, "Conversation not found")
    return _to_thread_out(row)


@router.get("/{thread_id}/messages", response_model=list[ChatMessageOut])
async def list_messages(thread_id: str, user: User = Depends(current_user), db: AsyncSession = Depends(get_db)):
    await _accessible_thread(db, thread_id, user)
    rows = (
        await db.execute(
            select(ChatMessage, User.full_name)
            .join(User, User.id == ChatMessage.sender_id)
            .where(ChatMessage.thread_id == thread_id)
            .order_by(ChatMessage.created_at.desc(), ChatMessage.id.desc())
            .limit(200)
        )
    ).all()
    rows.reverse()
    return [
        ChatMessageOut(
            id=message.id,
            thread_id=message.thread_id,
            sender_id=message.sender_id,
            sender_name=sender_name,
            body=message.body,
            created_at=message.created_at,
        )
        for message, sender_name in rows
    ]


@router.post("/{thread_id}/messages", response_model=ChatMessageOut)
async def send_message(
    thread_id: str,
    body: ChatMessageIn,
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
):
    thread = await _accessible_thread(db, thread_id, user)
    text = body.body.strip()
    if not text:
        raise HTTPException(422, "Message cannot be empty")
    message = ChatMessage(thread_id=thread.id, sender_id=user.id, body=text)
    thread.updated_at = utcnow()
    db.add(message)
    await db.commit()
    await db.refresh(message)
    return ChatMessageOut(
        id=message.id,
        thread_id=message.thread_id,
        sender_id=user.id,
        sender_name=user.full_name,
        body=message.body,
        created_at=message.created_at,
    )
