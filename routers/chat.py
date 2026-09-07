import json
import re
from typing import List, Dict, Optional
from datetime import datetime, timedelta
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text
from pydantic import BaseModel

from database.db import get_db
from database.models import User, ChatMessage, Wallet, Transaction, VideoRoom

router = APIRouter(prefix="/chat", tags=["Chat En Vivo y CRM"])

# 🛡️ ConnectionManager Multipunto para DMs, Chat Global y Videochats por Sala
class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []
        self.user_connections: Dict[int, List[WebSocket]] = {}
        self.room_connections: Dict[str, List[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, user_id: int):
        await websocket.accept()
        self.active_connections.append(websocket)
        if user_id not in self.user_connections:
            self.user_connections[user_id] = []
        self.user_connections[user_id].append(websocket)

    def disconnect(self, websocket: WebSocket, user_id: int):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
        if user_id in self.user_connections:
            if websocket in self.user_connections[user_id]:
                self.user_connections[user_id].remove(websocket)
            if not self.user_connections[user_id]:
                del self.user_connections[user_id]
        
        # Remover de salas activas si estaba suscrito
        for room_id, sockets in list(self.room_connections.items()):
            if websocket in sockets:
                sockets.remove(websocket)
            if not sockets:
                del self.room_connections[room_id]

    async def join_room(self, room_id: str, websocket: WebSocket):
        if room_id not in self.room_connections:
            self.room_connections[room_id] = []
        if websocket not in self.room_connections[room_id]:
            self.room_connections[room_id].append(websocket)

    def leave_room(self, room_id: str, websocket: WebSocket):
        if room_id in self.room_connections and websocket in self.room_connections[room_id]:
            self.room_connections[room_id].remove(websocket)
            if not self.room_connections[room_id]:
                del self.room_connections[room_id]

    async def broadcast(self, message: dict):
        for connection in list(self.active_connections):
            try:
                await connection.send_json(message)
            except Exception:
                pass

    async def broadcast_to_room(self, room_id: str, message: dict):
        if room_id in self.room_connections:
            for connection in list(self.room_connections[room_id]):
                try:
                    await connection.send_json(message)
                except Exception:
                    pass

    async def send_personal_message(self, message: dict, target_user_id: int):
        if target_user_id in self.user_connections:
            for connection in list(self.user_connections[target_user_id]):
                try:
                    await connection.send_json(message)
                except Exception:
                    pass

manager = ConnectionManager()
global_manager = ConnectionManager()

def safe_int(val) -> Optional[int]:
    if val is None or val == "" or str(val).lower() in ["null", "undefined", "none"]:
        return None
    try:
        return int(val)
    except (ValueError, TypeError):
        return None

def ensure_chat_schema(db: Session):
    try:
        db.execute(text("SELECT is_online FROM users LIMIT 1"))
    except Exception:
        db.rollback()
        try:
            db.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS is_online BOOLEAN DEFAULT FALSE"))
            db.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS is_live_video BOOLEAN DEFAULT FALSE"))
            db.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS warnings_count INTEGER DEFAULT 0"))
            db.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS last_seen TIMESTAMP"))
            db.commit()
        except Exception:
            db.rollback()

    try:
        db.execute(text("ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS recipient_id BIGINT"))
        db.execute(text("ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS is_read BOOLEAN DEFAULT FALSE"))
        db.execute(text("ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS is_system BOOLEAN DEFAULT FALSE"))
        db.execute(text("ALTER TABLE transactions ADD COLUMN IF NOT EXISTS room_id VARCHAR(50)"))
        db.commit()
    except Exception:
        db.rollback()

    try:
        db.execute(text("""
            CREATE TABLE IF NOT EXISTS video_rooms (
                id SERIAL PRIMARY KEY,
                room_id VARCHAR(50) UNIQUE NOT NULL,
                name VARCHAR(100) NOT NULL,
                category VARCHAR(50) DEFAULT 'general',
                description VARCHAR(255),
                host_id BIGINT,
                min_access_level INTEGER DEFAULT 0,
                min_broadcast_level INTEGER DEFAULT 1,
                is_private BOOLEAN DEFAULT FALSE,
                price_alpha INTEGER DEFAULT 0,
                is_active BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """))
        db.commit()
    except Exception:
        db.rollback()

def clean_old_messages(db: Session):
    try:
        time_threshold = datetime.utcnow() - timedelta(hours=24)
        db.query(ChatMessage).filter(ChatMessage.created_at < time_threshold).delete()
        db.commit()
    except Exception:
        db.rollback()

class DeleteMsgRequest(BaseModel):
    user_id: int
    msg_id: int

class CreateRoomRequest(BaseModel):
    user_id: int
    room_id: str
    name: str
    category: str = "general"
    description: Optional[str] = None
    min_access_level: int = 0
    min_broadcast_level: int = 1
    is_private: bool = False
    price_alpha: int = 0

# --- GESTIÓN DE SALAS DE VIDEOCHAT POR CATEGORÍAS ---

@router.get("/rooms")
def get_video_rooms(category: Optional[str] = None, db: Session = Depends(get_db)):
    ensure_chat_schema(db)
    query = db.query(VideoRoom).filter(VideoRoom.is_active == True)
    if category and category != "all":
        query = query.filter(VideoRoom.category == category)
    
    rooms = query.all()
    
    if not rooms:
        default_rooms = [
            VideoRoom(room_id="bunker_main", name="🔱 Búnker Live Principal", category="general", description="Sala global de la comunidad", min_access_level=0, min_broadcast_level=1),
            VideoRoom(room_id="gaming_hub", name="🎮 Zona Gamer & Streams", category="gaming", description="Partidas en vivo y comunidad gamer", min_access_level=0, min_broadcast_level=1),
            VideoRoom(room_id="charlas_vip", name="🍸 Charlas Nocturnas VIP", category="charlas", description="Encuentros y tertulias privadas", min_access_level=1, min_broadcast_level=2),
            VideoRoom(room_id="exclusive_vault", name="👑 The Vault Creators", category="vip", description="Contenido exclusivo y shows privados", min_access_level=3, min_broadcast_level=4)
        ]
        try:
            for r in default_rooms:
                db.add(r)
            db.commit()
            rooms = default_rooms
        except Exception:
            db.rollback()
            
    return {"status": "success", "rooms": rooms}

@router.post("/rooms/create")
def create_video_room(req: CreateRoomRequest, db: Session = Depends(get_db)):
    ensure_chat_schema(db)
    user = db.query(User).filter(User.user_id == req.user_id).first()
    is_admin = (user and (user.role == "admin" or user.user_id in [8269470905, 123456789]))
    
    if not is_admin and (not user or user.role != "creator" or user.kyc_status != "verified"):
        return {"status": "error", "detail": "Se requiere cuenta de Creador con KYC verificado o Admin para abrir salas."}
        
    existing = db.query(VideoRoom).filter(VideoRoom.room_id == req.room_id).first()
    if existing:
        return {"status": "error", "detail": "El identificador de sala ya existe."}
        
    broadcast_level = max(1, req.min_broadcast_level)
    
    new_room = VideoRoom(
        room_id=req.room_id.strip().lower(),
        name=req.name.strip(),
        category=req.category.strip().lower(),
        description=req.description,
        host_id=user.user_id,
        min_access_level=req.min_access_level,
        min_broadcast_level=broadcast_level,
        is_private=req.is_private,
        price_alpha=req.price_alpha
    )
    db.add(new_room)
    db.commit()
    db.refresh(new_room)
    return {"status": "success", "room": new_room}

# --- CONTROL Y MENSAJERÍA CRM / DMs ---

@router.post("/delete_message")
async def delete_chat_message(req: DeleteMsgRequest, db: Session = Depends(get_db)):
    ensure_chat_schema(db)
    msg = db.query(ChatMessage).filter(ChatMessage.id == req.msg_id).first()
    if not msg:
        return {"status": "error", "detail": "Mensaje no encontrado"}
    
    user = db.query(User).filter(User.user_id == req.user_id).first()
    is_admin = (user and (user.role == "admin" or user.user_id in [8269470905, 123456789]))
    
    if msg.user_id != req.user_id and not is_admin:
        return {"status": "error", "detail": "No tienes permisos para eliminar este mensaje"}
    
    db.delete(msg)
    db.commit()
    
    delete_payload = {"type": "delete_msg", "msg_id": req.msg_id}
    await global_manager.broadcast(delete_payload)
    await manager.broadcast(delete_payload)
    
    return {"status": "success"}

@router.websocket("/ws/{user_id}")
async def websocket_endpoint(websocket: WebSocket, user_id: int, db: Session = Depends(get_db)):
    ensure_chat_schema(db)
    await manager.connect(websocket, user_id)
    user = db.query(User).filter(User.user_id == user_id).first()
    
    if not user:
        user = User(user_id=user_id, name="Agente Búnker", role="fan", access_level=0, kyc_status="unverified", warnings_count=0)
        db.add(user)
        db.commit()
        db.refresh(user)

    try:
        while True:
            data = await websocket.receive_text()
            
            text_val = ""
            media_val = None
            raw_target_id = None
            msg_type = "chat"
            try:
                payload = json.loads(data)
                msg_type = payload.get("type", "chat")
                text_val = payload.get("text", "")
                media_val = payload.get("media_url", None)
                raw_target_id = payload.get("target_id", None)
            except Exception:
                text_val = data

            target_int = safe_int(raw_target_id)

            if msg_type == "mark_read":
                if target_int:
                    try:
                        db.query(ChatMessage).filter(
                            ChatMessage.user_id == target_int,
                            ChatMessage.recipient_id == user_id,
                            ChatMessage.is_read == False
                        ).update({"is_read": True})
                        db.commit()
                        await manager.send_personal_message({"type": "messages_read", "reader_id": user_id}, target_int)
                    except Exception:
                        db.rollback()
                continue

            try:
                db_content = json.dumps({"text": text_val, "media_url": media_val})
                new_msg = ChatMessage(
                    user_id=user.user_id,
                    recipient_id=target_int,
                    author_name=user.name,
                    author_role=user.role,
                    access_level=getattr(user, "access_level", 0),
                    content=db_content,
                    is_system=False,
                    is_read=False
                )
                db.add(new_msg)
                db.commit()
                db.refresh(new_msg)

                msg_payload = {
                    "type": "new_msg",
                    "id": new_msg.id,
                    "user_id": new_msg.user_id,
                    "recipient_id": new_msg.recipient_id,
                    "author_name": new_msg.author_name,
                    "author_role": new_msg.author_role,
                    "access_level": new_msg.access_level,
                    "content": new_msg.content,
                    "is_system": new_msg.is_system,
                    "is_read": new_msg.is_read,
                    "created_at": new_msg.created_at.isoformat()
                }

                if target_int:
                    await manager.send_personal_message(msg_payload, target_int)
                    await manager.send_personal_message(msg_payload, user_id)
                else:
                    await manager.send_personal_message(msg_payload, user_id)
                    await manager.broadcast(msg_payload)
            except Exception as save_err:
                db.rollback()
                print(f"[SAVE MSG ERROR]: {save_err}")

    except WebSocketDisconnect:
        manager.disconnect(websocket, user_id)
    except Exception as e:
        print(f"[CRM WS ERROR]: {e}")
        manager.disconnect(websocket, user_id)

@router.get("/conversations/{user_id}")
def get_user_conversations(user_id: int, db: Session = Depends(get_db)):
    ensure_chat_schema(db)
    clean_old_messages(db)
    try:
        msgs = db.query(ChatMessage).filter(
            ((ChatMessage.user_id == user_id) | (ChatMessage.recipient_id == user_id)) & 
            (ChatMessage.recipient_id != None)
        ).order_by(ChatMessage.created_at.desc()).all()
        
        partners_map = {}
        for m in msgs:
            partner_id = m.recipient_id if m.user_id == user_id else m.user_id
            if partner_id and partner_id != user_id:
                if partner_id not in partners_map:
                    partner_user = db.query(User).filter(User.user_id == partner_id).first()
                    unread_count = db.query(ChatMessage).filter(
                        ChatMessage.user_id == partner_id,
                        ChatMessage.recipient_id == user_id,
                        ChatMessage.is_read == False
                    ).count()
                    
                    partners_map[partner_id] = {
                        "user_id": partner_id,
                        "name": getattr(partner_user, "name", f"Agente {partner_id}") if partner_user else f"Agente {partner_id}",
                        "avatar_url": getattr(partner_user, "avatar_url", None) if partner_user else None,
                        "is_online": getattr(partner_user, "is_online", False) if partner_user else False,
                        "last_message": m.content,
                        "last_time": m.created_at.isoformat(),
                        "unread_count": unread_count
                    }
        return {"status": "success", "conversations": list(partners_map.values())}
    except Exception as e:
        print(f"[CONVERSATIONS ERROR]: {e}")
        return {"status": "success", "conversations": []}

@router.get("/history")
def get_chat_history(
    limit: int = 50,
    user_id: Optional[int] = None,
    target_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    ensure_chat_schema(db)
    clean_old_messages(db)
    query = db.query(ChatMessage).filter(ChatMessage.author_name.notlike("[Global]%"))
    
    if user_id is not None and target_id is not None:
        query = query.filter(
            ((ChatMessage.user_id == user_id) & (ChatMessage.recipient_id == target_id)) |
            ((ChatMessage.user_id == target_id) & (ChatMessage.recipient_id == user_id))
        )
    elif user_id is not None:
        query = query.filter(
            (ChatMessage.user_id == user_id) | (ChatMessage.recipient_id == user_id)
        )
        
    messages = query.order_by(ChatMessage.created_at.desc()).limit(limit).all()
    return {"status": "success", "messages": messages[::-1]}

# 🛡️ OBTENER HISTORIAL DE CHAT FILTRADO ESTRICTAMENTE POR SALA
@router.get("/global/history")
def get_global_chat_history(room_id: str = "bunker_main", limit: int = 50, db: Session = Depends(get_db)):
    ensure_chat_schema(db)
    clean_old_messages(db)
    
    # Extraemos todos los mensajes globales recientes
    messages = db.query(ChatMessage).filter(ChatMessage.author_name.like("[Global]%")).order_by(ChatMessage.created_at.desc()).limit(150).all()
    
    filtered_messages = []
    for msg in messages:
        try:
            content_data = json.loads(msg.content)
            # Filtro 1: Aislar por room_id
            msg_room = content_data.get("room_id", "bunker_main")
            if msg_room == room_id:
                # Filtro 2: Eliminar paquetes de telemetría basura incrustados
                if "radar_update" in msg.content or "leave_video" in msg.content or "webrtc_" in msg.content:
                    continue
                filtered_messages.append(msg)
        except:
            # Mensajes antiguos sin formato JSON se asumen al bunker principal
            if room_id == "bunker_main":
                filtered_messages.append(msg)
        
        if len(filtered_messages) >= limit:
            break
            
    return {"status": "success", "messages": filtered_messages[::-1]}

# --- CHAT GLOBAL, WEBRTC CATEGORIZADO Y LIVE TIPPING ---

@router.websocket("/global/ws/{user_id}")
async def global_websocket_endpoint(websocket: WebSocket, user_id: int, room_id: str = "bunker_main", db: Session = Depends(get_db)):
    ensure_chat_schema(db)

    user = db.query(User).filter(User.user_id == user_id).first()
    if not user:
        user = User(user_id=user_id, name="Agente Búnker", role="fan", access_level=0, kyc_status="unverified", warnings_count=0)
        db.add(user)
    
    user.is_online = True
    user.last_seen = datetime.utcnow()
    db.commit()

    # Conectar al usuario a su túnel de red específico (Aislamiento Total)
    await global_manager.connect(websocket, user_id)
    await global_manager.join_room(room_id, websocket)

    online_count = db.query(User).filter(User.is_online == True).count()
    await global_manager.broadcast({"type": "online_count_update", "count": online_count})
    
    # Radar Update: Solo se notifica a los que están en la misma sala
    await global_manager.broadcast_to_room(room_id, {"type": "radar_update", "user_id": user_id, "name": user.name, "status": "online", "room_id": room_id})

    is_admin = (user.role == "admin" or user.user_id in [8269470905, 123456789])

    if not is_admin and user.role == "creator" and user.kyc_status != "verified":
        await websocket.accept()
        await websocket.send_json({"is_error": True, "message": "🚫 ACCESO DENEGADO: Creadores requieren KYC (+18) aprobado."})
        await websocket.close(code=1008)
        return

    link_pattern = re.compile(r'(?i)(?:https?://|www\.|t\.me/)\S+|(?:\b[a-z0-9-]+\.)+(?:com|net|org|me|io|tm|co|tv|app|ly|gl)\b')
    banned_words = [
        "extasis", "cp", "c.p", "c-p", "cepe", "cheese", "pizza", "cheese pizza", "cheesepizza",
        "k9", "k-9zoo", "z00", "beast", "bestialismo", "zoofilia", "incest", "incesto", "tabu", "taboo", "tab00",
        "rape", "r4pe", "violacion", "violation", "gore", "g0re", "snuff", "necro", "murder", "matar", "asesinar",
        "sangre", "blood", "tortura", "torture", "stab", "kill", "nigger", "n1gger", "slave", "hitler", "nazi",
        "pedofilia", "pedophilia", "pedophile", "pedo", "p.e.d.o", "p3do", "p3d0", "paedo", "map", "maps"
    ]
    spam_pattern = re.compile(r'(?i)\b(?:' + '|'.join(map(re.escape, banned_words)) + r')\b')

    try:
        while True:
            data = await websocket.receive_text()
            
            try:
                payload = json.loads(data)
                msg_type = payload.get("type", "chat")
                msg_room_id = payload.get("room_id", room_id)
                user_access_tier = getattr(user, "access_level", 0)
                
                # 🛑 RESTRICCIÓN RANGO ESPÍA (NIVEL 0)
                if msg_type in ["join_video", "webrtc_offer"]:
                    if user_access_tier < 1 and not is_admin:
                        await websocket.send_json({
                            "is_error": True,
                            "type": "tier_error",
                            "message": "🚫 ACCESO DENEGADO: El rango ESPÍA (Nivel 0) no puede transmitir video."
                        })
                        continue

                # 📡 SEÑALIZACIÓN WEBRTC P2P ENCAPSULADA POR SALA
                if msg_type in ["webrtc_offer", "webrtc_answer", "webrtc_ice"]:
                    target_id = safe_int(payload.get("target_id"))
                    if target_id:
                        payload["caller_id"] = user_id 
                        payload["caller_name"] = user.name
                        payload["room_id"] = msg_room_id
                        await global_manager.send_personal_message(payload, target_id)
                    continue
                
                if msg_type == "join_video":
                    user.is_live_video = True
                    db.commit()
                    await global_manager.broadcast_to_room(msg_room_id, {
                        "type": "radar_update",
                        "user_id": user_id,
                        "name": user.name,
                        "status": "live",
                        "room_id": msg_room_id
                    })
                    continue

                if msg_type == "leave_video":
                    user.is_live_video = False
                    db.commit()
                    await global_manager.broadcast_to_room(msg_room_id, {
                        "type": "radar_update",
                        "user_id": user_id,
                        "name": user.name,
                        "status": "online",
                        "room_id": msg_room_id
                    })
                    continue

                # 🪙 LIVE TIPPING
                if msg_type == "live_tip":
                    streamer_id = safe_int(payload.get("target_id"))
                    amount = safe_int(payload.get("amount")) or 0

                    if not streamer_id or amount <= 0:
                        await websocket.send_json({"is_error": True, "message": "Monto o destinatario de propina inválido."})
                        continue

                    sender_wallet = db.query(Wallet).filter(Wallet.user_id == user_id).first()
                    if not sender_wallet or sender_wallet.alpha_balance < amount:
                        await websocket.send_json({"is_error": True, "message": "Saldo insuficiente de $ALPHA Coins."})
                        continue

                    receiver_wallet = db.query(Wallet).filter(Wallet.user_id == streamer_id).first()
                    if not receiver_wallet:
                        receiver_wallet = Wallet(user_id=streamer_id, alpha_balance=0)
                        db.add(receiver_wallet)

                    sender_wallet.alpha_balance -= amount
                    sender_wallet.total_spent = (sender_wallet.total_spent or 0) + amount
                    receiver_wallet.alpha_balance += amount
                    receiver_wallet.total_earned = (receiver_wallet.total_earned or 0) + amount

                    tx = Transaction(sender_id=user_id, receiver_id=streamer_id, amount=amount, tx_type="live_tip", room_id=str(msg_room_id))
                    db.add(tx)
                    db.commit()

                    tip_alert = {
                        "type": "live_tip_alert",
                        "sender_id": user_id,
                        "sender_name": user.name,
                        "streamer_id": streamer_id,
                        "amount": amount,
                        "room_id": str(msg_room_id),
                        "message": f"🔥 ¡@{user.name} envió una propina de {amount} $ALPHA!"
                    }
                    await global_manager.broadcast_to_room(msg_room_id, tip_alert)
                    continue

                # 💬 MENSAJERÍA INDEPENDIENTE POR SALAS
                text_val = payload.get("text", "")
                media_val = payload.get("media_url", None)

                current_warnings = getattr(user, 'warnings_count', 0) or 0

                if not is_admin:
                    if link_pattern.search(text_val) or spam_pattern.search(text_val):
                        user.warnings_count = current_warnings + 1
                        penalty_amount = 5 
                        
                        wallet = db.query(Wallet).filter(Wallet.user_id == user_id).first()
                        if wallet and wallet.alpha_balance >= penalty_amount:
                            wallet.alpha_balance -= penalty_amount
                            tx = Transaction(sender_id=user_id, receiver_id=None, amount=penalty_amount, tx_type="spam_penalty")
                            db.add(tx)
                        db.commit()

                        warning_msg = f"⚠️ @{user.name}, contenido bloqueado. Advertencias: {user.warnings_count}/5. Multa: -{penalty_amount} $ALPHA."
                        
                        sys_msg = ChatMessage(
                            user_id=8269470905, 
                            author_name="Centinela",
                            author_role="admin",
                            access_level=5,
                            content=json.dumps({"text": warning_msg, "media_url": None, "room_id": msg_room_id}),
                            is_system=True
                        )
                        db.add(sys_msg)
                        db.commit()
                        db.refresh(sys_msg)
                        
                        sys_payload = {
                            "type": "new_msg",
                            "id": sys_msg.id, "user_id": sys_msg.user_id, "author_name": sys_msg.author_name,
                            "author_role": sys_msg.author_role, "access_level": sys_msg.access_level,
                            "content": sys_msg.content, "is_system": sys_msg.is_system,
                            "room_id": msg_room_id,
                            "created_at": sys_msg.created_at.isoformat()
                        }
                        await global_manager.broadcast_to_room(msg_room_id, sys_payload)
                        continue

                # Guardado serializando el room_id en el content JSON para aislamiento en la BBDD
                db_content = json.dumps({"text": text_val, "media_url": media_val, "room_id": msg_room_id})
                new_msg = ChatMessage(
                    user_id=user.user_id,
                    author_name=f"[Global] {user.name}",
                    author_role=user.role,
                    access_level=getattr(user, "access_level", 0),
                    content=db_content,
                    is_system=False
                )
                db.add(new_msg)
                db.commit()
                db.refresh(new_msg)

                msg_payload = {
                    "type": "new_msg",
                    "id": new_msg.id,
                    "user_id": new_msg.user_id,
                    "author_name": new_msg.author_name,
                    "author_role": new_msg.author_role,
                    "access_level": new_msg.access_level,
                    "content": new_msg.content,
                    "is_system": new_msg.is_system,
                    "room_id": msg_room_id,
                    "created_at": new_msg.created_at.isoformat()
                }
                
                # ENVIAR SOLO A LA SALA DONDE SE ESCRIBIÓ
                await global_manager.broadcast_to_room(msg_room_id, msg_payload)
            except Exception as inner_err:
                print(f"[GLOBAL WS INNER ERROR]: {inner_err}")
                pass
            
    except WebSocketDisconnect:
        user.is_online = False
        user.is_live_video = False
        user.last_seen = datetime.utcnow()
        db.commit()
        global_manager.disconnect(websocket, user_id)
        online_count = db.query(User).filter(User.is_online == True).count()
        await global_manager.broadcast({"type": "online_count_update", "count": online_count})
        await global_manager.broadcast_to_room(room_id, {"type": "radar_update", "user_id": user_id, "name": user.name, "status": "offline", "room_id": room_id})
    except Exception as outer_err:
        print(f"[GLOBAL WS OUTER ERROR]: {outer_err}")
        try:
            user.is_online = False
            user.is_live_video = False
            db.commit()
            online_count = db.query(User).filter(User.is_online == True).count()
            await global_manager.broadcast({"type": "online_count_update", "count": online_count})
        except Exception:
            pass
        global_manager.disconnect(websocket, user_id)