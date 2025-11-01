from fastapi import FastAPI, APIRouter, HTTPException, WebSocket, WebSocketDisconnect, UploadFile, File, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional, Dict
import uuid
from datetime import datetime, timezone, timedelta
import jwt
from passlib.context import CryptContext
import json
import socketio
import base64
import aiofiles

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT Configuration
SECRET_KEY = os.environ.get('JWT_SECRET_KEY', 'zoq-secret-key-2025-super-secure')
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_DAYS = 30

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()

# Create SocketIO server
sio = socketio.AsyncServer(
    async_mode='asgi',
    cors_allowed_origins='*'
)

# Create the main app
app = FastAPI()
api_router = APIRouter(prefix="/api")

# Pydantic Models
class UserRegister(BaseModel):
    username: str
    email: EmailStr
    password: str
    full_name: Optional[str] = None

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    username: str
    email: str
    full_name: Optional[str] = None
    profile_pic: Optional[str] = None
    bio: Optional[str] = None
    created_at: datetime

class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    bio: Optional[str] = None
    profile_pic: Optional[str] = None

class PostCreate(BaseModel):
    content: str
    media_url: Optional[str] = None

class Post(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    user_id: str
    username: str
    profile_pic: Optional[str] = None
    content: str
    media_url: Optional[str] = None
    likes_count: int = 0
    comments_count: int = 0
    is_liked: bool = False
    created_at: datetime

class Comment(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    post_id: str
    user_id: str
    username: str
    profile_pic: Optional[str] = None
    content: str
    created_at: datetime

class CommentCreate(BaseModel):
    content: str

class Message(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    from_user_id: str
    to_user_id: str
    content: str
    read: bool = False
    created_at: datetime

class MessageCreate(BaseModel):
    to_user_id: str
    content: str

class FriendRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    from_user_id: str
    to_user_id: str
    from_username: str
    from_profile_pic: Optional[str] = None
    status: str  # pending, accepted, rejected
    created_at: datetime

class Conversation(BaseModel):
    model_config = ConfigDict(extra="ignore")
    user_id: str
    username: str
    profile_pic: Optional[str] = None
    last_message: Optional[str] = None
    unread_count: int = 0
    last_message_time: Optional[datetime] = None

# Helper functions
def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(days=ACCESS_TOKEN_EXPIRE_DAYS)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def verify_token(token: str):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    token = credentials.credentials
    payload = verify_token(token)
    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token"
        )
    user_id = payload.get("user_id")
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found"
        )
    return user

# Auth Routes
@api_router.post("/auth/register")
async def register(user_data: UserRegister):
    # Check if user exists
    existing_user = await db.users.find_one({"$or": [{"email": user_data.email}, {"username": user_data.username}]})
    if existing_user:
        raise HTTPException(status_code=400, detail="User already exists")
    
    # Create user
    user_id = str(uuid.uuid4())
    hashed_password = pwd_context.hash(user_data.password)
    user_doc = {
        "id": user_id,
        "username": user_data.username,
        "email": user_data.email,
        "full_name": user_data.full_name,
        "password_hash": hashed_password,
        "profile_pic": None,
        "bio": None,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.users.insert_one(user_doc)
    
    # Create token
    token = create_access_token({"user_id": user_id})
    
    return {
        "token": token,
        "user": {
            "id": user_id,
            "username": user_data.username,
            "email": user_data.email,
            "full_name": user_data.full_name,
            "profile_pic": None,
            "bio": None
        }
    }

@api_router.post("/auth/login")
async def login(credentials: UserLogin):
    user = await db.users.find_one({"email": credentials.email}, {"_id": 0})
    if not user or not pwd_context.verify(credentials.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    token = create_access_token({"user_id": user["id"]})
    
    return {
        "token": token,
        "user": {
            "id": user["id"],
            "username": user["username"],
            "email": user["email"],
            "full_name": user.get("full_name"),
            "profile_pic": user.get("profile_pic"),
            "bio": user.get("bio")
        }
    }

@api_router.get("/auth/me", response_model=User)
async def get_me(current_user: dict = Depends(get_current_user)):
    if isinstance(current_user['created_at'], str):
        current_user['created_at'] = datetime.fromisoformat(current_user['created_at'])
    return current_user

@api_router.put("/auth/profile")
async def update_profile(profile_data: UserUpdate, current_user: dict = Depends(get_current_user)):
    update_data = {k: v for k, v in profile_data.model_dump().items() if v is not None}
    if update_data:
        await db.users.update_one({"id": current_user["id"]}, {"$set": update_data})
    
    updated_user = await db.users.find_one({"id": current_user["id"]}, {"_id": 0})
    return {
        "id": updated_user["id"],
        "username": updated_user["username"],
        "email": updated_user["email"],
        "full_name": updated_user.get("full_name"),
        "profile_pic": updated_user.get("profile_pic"),
        "bio": updated_user.get("bio")
    }

# Friend Routes
@api_router.post("/friends/request/{user_id}")
async def send_friend_request(user_id: str, current_user: dict = Depends(get_current_user)):
    if user_id == current_user["id"]:
        raise HTTPException(status_code=400, detail="Cannot send friend request to yourself")
    
    # Check if friendship already exists
    existing = await db.friendships.find_one({
        "$or": [
            {"from_user_id": current_user["id"], "to_user_id": user_id},
            {"from_user_id": user_id, "to_user_id": current_user["id"]}
        ]
    })
    
    if existing:
        raise HTTPException(status_code=400, detail="Friend request already exists")
    
    request_doc = {
        "id": str(uuid.uuid4()),
        "from_user_id": current_user["id"],
        "to_user_id": user_id,
        "status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.friendships.insert_one(request_doc)
    
    return {"message": "Friend request sent"}

@api_router.post("/friends/accept/{request_id}")
async def accept_friend_request(request_id: str, current_user: dict = Depends(get_current_user)):
    request = await db.friendships.find_one({"id": request_id, "to_user_id": current_user["id"]})
    if not request:
        raise HTTPException(status_code=404, detail="Friend request not found")
    
    await db.friendships.update_one({"id": request_id}, {"$set": {"status": "accepted"}})
    return {"message": "Friend request accepted"}

@api_router.delete("/friends/reject/{request_id}")
async def reject_friend_request(request_id: str, current_user: dict = Depends(get_current_user)):
    await db.friendships.delete_one({"id": request_id, "to_user_id": current_user["id"]})
    return {"message": "Friend request rejected"}

@api_router.get("/friends/requests", response_model=List[FriendRequest])
async def get_friend_requests(current_user: dict = Depends(get_current_user)):
    requests = await db.friendships.find(
        {"to_user_id": current_user["id"], "status": "pending"},
        {"_id": 0}
    ).to_list(100)
    
    # Enrich with user data
    for req in requests:
        from_user = await db.users.find_one({"id": req["from_user_id"]}, {"_id": 0})
        req["from_username"] = from_user["username"]
        req["from_profile_pic"] = from_user.get("profile_pic")
        if isinstance(req['created_at'], str):
            req['created_at'] = datetime.fromisoformat(req['created_at'])
    
    return requests

@api_router.get("/friends", response_model=List[User])
async def get_friends(current_user: dict = Depends(get_current_user)):
    friendships = await db.friendships.find({
        "$or": [
            {"from_user_id": current_user["id"], "status": "accepted"},
            {"to_user_id": current_user["id"], "status": "accepted"}
        ]
    }, {"_id": 0}).to_list(1000)
    
    friend_ids = []
    for fs in friendships:
        if fs["from_user_id"] == current_user["id"]:
            friend_ids.append(fs["to_user_id"])
        else:
            friend_ids.append(fs["from_user_id"])
    
    friends = await db.users.find({"id": {"$in": friend_ids}}, {"_id": 0}).to_list(1000)
    for friend in friends:
        if isinstance(friend['created_at'], str):
            friend['created_at'] = datetime.fromisoformat(friend['created_at'])
    
    return friends

@api_router.get("/users/search")
async def search_users(q: str, current_user: dict = Depends(get_current_user)):
    users = await db.users.find(
        {
            "$and": [
                {"id": {"$ne": current_user["id"]}},
                {"$or": [
                    {"username": {"$regex": q, "$options": "i"}},
                    {"full_name": {"$regex": q, "$options": "i"}}
                ]}
            ]
        },
        {"_id": 0, "password_hash": 0}
    ).to_list(20)
    
    return users

# Post Routes
@api_router.post("/posts", response_model=Post, status_code=201)
async def create_post(post_data: PostCreate, current_user: dict = Depends(get_current_user)):
    post_id = str(uuid.uuid4())
    post_doc = {
        "id": post_id,
        "user_id": current_user["id"],
        "content": post_data.content,
        "media_url": post_data.media_url,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.posts.insert_one(post_doc)
    
    return {
        "id": post_id,
        "user_id": current_user["id"],
        "username": current_user["username"],
        "profile_pic": current_user.get("profile_pic"),
        "content": post_data.content,
        "media_url": post_data.media_url,
        "likes_count": 0,
        "comments_count": 0,
        "is_liked": False,
        "created_at": datetime.now(timezone.utc)
    }

@api_router.get("/posts/feed", response_model=List[Post])
async def get_feed(current_user: dict = Depends(get_current_user)):
    # Get friends
    friendships = await db.friendships.find({
        "$or": [
            {"from_user_id": current_user["id"], "status": "accepted"},
            {"to_user_id": current_user["id"], "status": "accepted"}
        ]
    }).to_list(1000)
    
    friend_ids = [current_user["id"]]
    for fs in friendships:
        if fs["from_user_id"] == current_user["id"]:
            friend_ids.append(fs["to_user_id"])
        else:
            friend_ids.append(fs["from_user_id"])
    
    # Get posts
    posts = await db.posts.find(
        {"user_id": {"$in": friend_ids}},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    # Enrich posts
    for post in posts:
        user = await db.users.find_one({"id": post["user_id"]}, {"_id": 0})
        post["username"] = user["username"]
        post["profile_pic"] = user.get("profile_pic")
        
        # Get likes count
        likes_count = await db.post_likes.count_documents({"post_id": post["id"]})
        post["likes_count"] = likes_count
        
        # Check if current user liked
        is_liked = await db.post_likes.find_one({"post_id": post["id"], "user_id": current_user["id"]})
        post["is_liked"] = bool(is_liked)
        
        # Get comments count
        comments_count = await db.post_comments.count_documents({"post_id": post["id"]})
        post["comments_count"] = comments_count
        
        if isinstance(post['created_at'], str):
            post['created_at'] = datetime.fromisoformat(post['created_at'])
    
    return posts

@api_router.post("/posts/{post_id}/like")
async def like_post(post_id: str, current_user: dict = Depends(get_current_user)):
    existing = await db.post_likes.find_one({"post_id": post_id, "user_id": current_user["id"]})
    if existing:
        await db.post_likes.delete_one({"post_id": post_id, "user_id": current_user["id"]})
        return {"liked": False}
    else:
        await db.post_likes.insert_one({
            "id": str(uuid.uuid4()),
            "post_id": post_id,
            "user_id": current_user["id"],
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        return {"liked": True}

@api_router.post("/posts/{post_id}/comments", response_model=Comment, status_code=201)
async def add_comment(post_id: str, comment_data: CommentCreate, current_user: dict = Depends(get_current_user)):
    comment_id = str(uuid.uuid4())
    comment_doc = {
        "id": comment_id,
        "post_id": post_id,
        "user_id": current_user["id"],
        "content": comment_data.content,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.post_comments.insert_one(comment_doc)
    
    return {
        "id": comment_id,
        "post_id": post_id,
        "user_id": current_user["id"],
        "username": current_user["username"],
        "profile_pic": current_user.get("profile_pic"),
        "content": comment_data.content,
        "created_at": datetime.now(timezone.utc)
    }

@api_router.get("/posts/{post_id}/comments", response_model=List[Comment])
async def get_comments(post_id: str, current_user: dict = Depends(get_current_user)):
    comments = await db.post_comments.find({"post_id": post_id}, {"_id": 0}).to_list(1000)
    
    for comment in comments:
        user = await db.users.find_one({"id": comment["user_id"]}, {"_id": 0})
        comment["username"] = user["username"]
        comment["profile_pic"] = user.get("profile_pic")
        if isinstance(comment['created_at'], str):
            comment['created_at'] = datetime.fromisoformat(comment['created_at'])
    
    return comments

@api_router.delete("/posts/{post_id}")
async def delete_post(post_id: str, current_user: dict = Depends(get_current_user)):
    post = await db.posts.find_one({"id": post_id})
    if not post or post["user_id"] != current_user["id"]:
        raise HTTPException(status_code=404, detail="Post not found")
    
    await db.posts.delete_one({"id": post_id})
    await db.post_likes.delete_many({"post_id": post_id})
    await db.post_comments.delete_many({"post_id": post_id})
    
    return {"message": "Post deleted"}

# Messaging Routes
@api_router.get("/messages/conversations", response_model=List[Conversation])
async def get_conversations(current_user: dict = Depends(get_current_user)):
    # Get all messages involving current user
    messages = await db.messages.find({
        "$or": [
            {"from_user_id": current_user["id"]},
            {"to_user_id": current_user["id"]}
        ]
    }).sort("created_at", -1).to_list(10000)
    
    # Group by conversation partner
    conversations = {}
    for msg in messages:
        partner_id = msg["to_user_id"] if msg["from_user_id"] == current_user["id"] else msg["from_user_id"]
        
        if partner_id not in conversations:
            partner = await db.users.find_one({"id": partner_id}, {"_id": 0})
            if partner:
                conversations[partner_id] = {
                    "user_id": partner_id,
                    "username": partner["username"],
                    "profile_pic": partner.get("profile_pic"),
                    "last_message": msg["content"],
                    "last_message_time": msg["created_at"],
                    "unread_count": 0
                }
        
        # Count unread
        if msg["to_user_id"] == current_user["id"] and not msg.get("read", False):
            conversations[partner_id]["unread_count"] += 1
    
    result = list(conversations.values())
    for conv in result:
        if isinstance(conv['last_message_time'], str):
            conv['last_message_time'] = datetime.fromisoformat(conv['last_message_time'])
    
    return result

@api_router.get("/messages/{user_id}", response_model=List[Message])
async def get_messages(user_id: str, current_user: dict = Depends(get_current_user)):
    messages = await db.messages.find({
        "$or": [
            {"from_user_id": current_user["id"], "to_user_id": user_id},
            {"from_user_id": user_id, "to_user_id": current_user["id"]}
        ]
    }, {"_id": 0}).sort("created_at", 1).to_list(1000)
    
    # Mark messages as read
    await db.messages.update_many(
        {"from_user_id": user_id, "to_user_id": current_user["id"], "read": False},
        {"$set": {"read": True}}
    )
    
    for msg in messages:
        if isinstance(msg['created_at'], str):
            msg['created_at'] = datetime.fromisoformat(msg['created_at'])
    
    return messages

@api_router.post("/messages", response_model=Message)
async def send_message(message_data: MessageCreate, current_user: dict = Depends(get_current_user)):
    message_id = str(uuid.uuid4())
    message_doc = {
        "id": message_id,
        "from_user_id": current_user["id"],
        "to_user_id": message_data.to_user_id,
        "content": message_data.content,
        "read": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.messages.insert_one(message_doc)
    
    return {
        "id": message_id,
        "from_user_id": current_user["id"],
        "to_user_id": message_data.to_user_id,
        "content": message_data.content,
        "read": False,
        "created_at": datetime.now(timezone.utc)
    }

@api_router.post("/upload/image")
async def upload_image(file: UploadFile = File(...), current_user: dict = Depends(get_current_user)):
    # For MVP, we'll store as base64 (in production, use cloud storage)
    contents = await file.read()
    base64_encoded = base64.b64encode(contents).decode('utf-8')
    file_type = file.content_type
    data_url = f"data:{file_type};base64,{base64_encoded}"
    
    return {"url": data_url}

# WebSocket for real-time messaging
active_connections: Dict[str, str] = {}  # sid -> user_id

@sio.event
async def connect(sid, environ):
    logging.info(f"Client connected: {sid}")

@sio.event
async def authenticate(sid, data):
    token = data.get('token')
    payload = verify_token(token)
    if payload:
        user_id = payload.get('user_id')
        active_connections[sid] = user_id
        await sio.emit('authenticated', {'user_id': user_id}, room=sid)
        logging.info(f"User authenticated: {user_id}")
    else:
        await sio.emit('error', {'message': 'Authentication failed'}, room=sid)

@sio.event
async def disconnect(sid):
    if sid in active_connections:
        del active_connections[sid]
    logging.info(f"Client disconnected: {sid}")

@sio.event
async def send_message(sid, data):
    if sid not in active_connections:
        return
    
    from_user_id = active_connections[sid]
    to_user_id = data.get('to_user_id')
    content = data.get('content')
    
    # Save message
    message_id = str(uuid.uuid4())
    message_doc = {
        "id": message_id,
        "from_user_id": from_user_id,
        "to_user_id": to_user_id,
        "content": content,
        "read": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.messages.insert_one(message_doc)
    
    # Send to recipient if online
    for recipient_sid, recipient_user_id in active_connections.items():
        if recipient_user_id == to_user_id:
            await sio.emit('new_message', {
                'id': message_id,
                'from_user_id': from_user_id,
                'to_user_id': to_user_id,
                'content': content,
                'created_at': message_doc['created_at']
            }, room=recipient_sid)

@sio.event
async def call_user(sid, data):
    """WebRTC signaling for calls"""
    if sid not in active_connections:
        return
    
    from_user_id = active_connections[sid]
    to_user_id = data.get('to_user_id')
    signal_data = data.get('signal')
    call_type = data.get('type')  # 'offer' or 'answer'
    
    # Forward signal to recipient
    for recipient_sid, recipient_user_id in active_connections.items():
        if recipient_user_id == to_user_id:
            from_user = await db.users.find_one({"id": from_user_id}, {"_id": 0})
            await sio.emit('incoming_call', {
                'from_user_id': from_user_id,
                'from_username': from_user['username'],
                'from_profile_pic': from_user.get('profile_pic'),
                'signal': signal_data,
                'type': call_type
            }, room=recipient_sid)

@sio.event
async def call_accepted(sid, data):
    """Forward call acceptance"""
    if sid not in active_connections:
        return
    
    to_user_id = data.get('to_user_id')
    signal_data = data.get('signal')
    
    for recipient_sid, recipient_user_id in active_connections.items():
        if recipient_user_id == to_user_id:
            await sio.emit('call_accepted', {
                'signal': signal_data
            }, room=recipient_sid)

@sio.event
async def ice_candidate(sid, data):
    """Forward ICE candidates for WebRTC"""
    if sid not in active_connections:
        return
    
    to_user_id = data.get('to_user_id')
    candidate = data.get('candidate')
    
    for recipient_sid, recipient_user_id in active_connections.items():
        if recipient_user_id == to_user_id:
            await sio.emit('ice_candidate', {
                'candidate': candidate
            }, room=recipient_sid)

# Include router
app.include_router(api_router)

# Mount SocketIO
socket_app = socketio.ASGIApp(sio, app)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(socket_app, host="0.0.0.0", port=8001)