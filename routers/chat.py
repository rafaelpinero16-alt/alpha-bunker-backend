import json
import re
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import List, Dict
from datetime import datetime, timedelta
from pydantic import BaseModel
from database.db import get_db
from database.models import User, ChatMessage, Wallet, Transaction

router = APIRouter(prefix="/chat", tags=["Chat En Vivo y CRM"])

# 🛡️ ConnectionManager Evolucionado para soportar Videollamadas P2P
class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []
        self.user_connections: Dict[int, List[WebSocket]] = {} 

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

    async def broadcast(self, message: dict):
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except Exception:
                pass

    # 📡 Ruteo Directo WebRTC (Fundamental para Videollamadas P2P reales)
    async def send_personal_message(self, message: dict, target_user_id: int):
        if target_user_id in self.user_connections:
            for connection in self.user_connections[target_user_id]:
                try:
                    await connection.send_json(message)
                except Exception:
                    pass

manager = ConnectionManager()
global_manager = ConnectionManager()

def clean_old_messages(db: Session):
    try:
        time_threshold = datetime.utcnow() - timedelta(hours=72)
        db.query(ChatMessage).filter(ChatMessage.created_at < time_threshold).delete()
        db.commit()
    except Exception:
        db.rollback()

class DeleteMsgRequest(BaseModel):
    user_id: int
    msg_id: int

@router.post("/delete_message")
async def delete_chat_message(req: DeleteMsgRequest, db: Session = Depends(get_db)):
    msg = db.query(ChatMessage).filter(ChatMessage.id == req.msg_id).first()
    if not msg:
        return {"status": "error", "detail": "Mensaje no encontrado"}
    
    user = db.query(User).filter(User.user_id == req.user_id).first()
    is_admin = (user and (user.role == "admin" or user.user_id == 8269470905))
    
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
    await manager.connect(websocket, user_id)
    user = db.query(User).filter(User.user_id == user_id).first()
    
    if not user:
        user = User(user_id=user_id, name="Agente Búnker", role="fan", access_level=0, kyc_status="unverified")
        db.add(user)
        db.commit()
        db.refresh(user)

    try:
        while True:
            data = await websocket.receive_text()
            
            text_val = data
            media_val = None
            try:
                payload = json.loads(data)
                text_val = payload.get("text", "")
                media_val = payload.get("media_url", None)
            except:
                pass

            db_content = json.dumps({"text": text_val, "media_url": media_val})
            new_msg = ChatMessage(
                user_id=user.user_id,
                author_name=user.name,
                author_role=user.role,
                access_level=user.access_level,
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
                "created_at": new_msg.created_at.isoformat()
            }
            await manager.broadcast(msg_payload)
    except WebSocketDisconnect:
        manager.disconnect(websocket, user_id)
    except Exception:
        manager.disconnect(websocket, user_id)

@router.get("/history")
def get_chat_history(limit: int = 50, db: Session = Depends(get_db)):
    clean_old_messages(db)
    messages = db.query(ChatMessage).filter(ChatMessage.author_name.notlike("[Global]%")).order_by(ChatMessage.created_at.desc()).limit(limit).all()
    return {"status": "success", "messages": messages[::-1]}

@router.websocket("/global/ws/{user_id}")
async def global_websocket_endpoint(websocket: WebSocket, user_id: int, db: Session = Depends(get_db)):
    try:
        db.execute(text("SELECT is_online FROM users LIMIT 1"))
    except Exception:
        db.rollback()
        try:
            db.execute(text("ALTER TABLE users ADD COLUMN is_online BOOLEAN DEFAULT FALSE"))
            db.execute(text("ALTER TABLE users ADD COLUMN is_live_video BOOLEAN DEFAULT FALSE"))
            db.commit()
        except Exception:
            db.rollback()

    user = db.query(User).filter(User.user_id == user_id).first()
    if not user:
        user = User(user_id=user_id, name="Agente Búnker", role="fan", access_level=0, kyc_status="unverified", warnings_count=0)
        db.add(user)
    
    # 📡 Marcar usuario como online al conectar
    user.is_online = True
    user.last_seen = datetime.utcnow()
    db.commit()

    is_admin = (user.role == "admin" or user.user_id == 8269470905 or user.user_id == 123456789)

    if not is_admin and user.role == "creator" and user.kyc_status != "verified":
        await websocket.accept()
        await websocket.send_json({"is_error": True, "message": "🚫 ACCESO DENEGADO: Creadores requieren KYC (+18) aprobado para el Chat Global."})
        await websocket.close(code=1008)
        return

    await global_manager.connect(websocket, user_id)

    # 📡 Broadcast: Notificar al Radar que alguien entró
    await global_manager.broadcast({"type": "radar_update", "user_id": user_id, "name": user.name, "status": "online"})

    link_pattern = re.compile(r'(?i)(?:https?://|www\.|t\.me/)\S+|(?:\b[a-z0-9-]+\.)+(?:com|net|org|me|io|tm|co|tv|app|ly|gl)\b')

    banned_words = [
        "extasis", "cp", "c.p", "c-p", "cepe", "cheese", "pizza", "cheese pizza", "cheesepizza",
        "k9", "k-9zoo", "z00", "beast", "bestialismo", "zoofilia", "incest", "incesto", "tabu", "taboo", "tab00",
        "rape", "r4pe", "violacion", "violation", "gore", "g0re", "snuff", "necro", "murder", "matar", "asesinar",
        "sangre", "blood", "tortura", "torture", "stab", "kill", "nigger", "n1gger", "slave", "hitler", "nazi",
        "pedofilia", "pedophilia", "pedophile", "pedo", "p.e.d.o", "p3do", "p3d0", "paedo", "map", "maps",
        "minor attracted", "boylover", "girllover", "child", "toddler", "preteen", "pre-teen", "under age",
        "underage", "kinder", "primaria", "colegio", "school", "grade school", "middle school", "high school",
        "freshman", "sophomore", "junior high", "10 años", "11 años", "12 años", "13 años", "14 años", "15 años",
        "menor", "m3nor", "boygina", "loli", "shota", "caldo", "pizza de queso", "hidden mickey", "playground pal",
        "free candy", "farmer bob", "10 yo", "11 yo", "12 yo", "13 yo", "14 yo", "15 yo", "10 y.o", "10 years",
        "11 years", "12 years", "13 years", "14 years", "15 years", "10 year old", "11 year old", "12 year old",
        "13 year old", "14 year old", "15 year old", "isis", "daesh", "al-qaeda", "jihad", "negra", "n3gro",
        "molest", "moleste", "kk", "mommy", "mami", "teen", "t33n", "chibolo", "chibola", "chamito", "chamita",
        "pelaito", "pelaita", "pibito", "jovencito", "jovencita", "bebes", "babies", "nena", "nene", "nenis",
        "colegiala", "colegial", "escuela", "secundaria", "uniforme", "tarea", "clases", "deepfake", "nudify",
        "clothoff", "undress ai", "ai nude", "fake nude", "desnudar ia", "dad and son", "mom and son",
        "animals and girls", "dad and daughter", "rape teen", "gay rape", "soft boy", "academy", "teen boys",
        "pedomom", "rape toons", "incst", "pervy", "alice", "kitty", "boogins", "todds mega", "race", "racist",
        "puberty", "no limit", "no limits", "infant", "rapist", "pervert", "kiddie", "porn child", "pornography",
        "predator", "sikko", "kid", "kiddy", "children", "cvc", "nepotism", "digest", "sisters", "step sister",
        "percy", "chapp", "slappy", "jesus brothers", "mickey", "monkey", "candylike", "dorm", "dulbanc", "magus",
        "mega no perce", "teens", "exclusive bundlkids rs", "thots", "wanted for", "kitchen", "teens mega",
        "candyland", "cand1chu", "cand.i.chu", "candy-chu", "candy.chu", "candy.land", "candy-land", "candylnd",
        "candee land", "magic.garden", "magic-garden", "magicgarden", "magik garden", "hidden.treasure",
        "hidden-treasure", "hiddentreasure", "hiddden", "treasure secret", "swe3t deal", "sweet.deal", "dad son",
        "carding", "cc full", "bins", "hacking", "hacker", "doxing", "ddos", "generador", "bin", "metodo", "method",
        "refund", "reembolso", "dm", "dm me", "dm to access", "exclusive content", "mdma", "mdme", "molly", "mandy",
        "xtc", "pills", "c p", "csam", "l0li", "lolita", "ninf", "ninfeta", "minor", "non-con", "chicken",
        "parmesan", "pasta sauce", "girl", "school boy", "pack escolar", "little ones", "baby girl", "weirdo energy",
        "sicko", "vibes", "jeffrey epstein", "epstein list", "epstein island", "little st", "james",
        "ghislaine maxwell", "lolita express", "epstein flight logs", "epstein files", "pedo island"
    ]

    banned_symbols = [
        "🧀🍕", "🍌🍩", "🌭 🌮", "🐕🍆", "🐎 🍆", "💛🤍💜🖤", "💙💗🤍💗💙", "🎒👧", "🍭👧", "🏝️✈️",
        "🌀", "🍥", "🚸", "📛", "🎒", "👧", "🧒", "🍼", "🧀", "🍌", "🍩", "🌭", "🌮", "🐕", "🍆",
        "🐎", "👧🏼", "👧🏻", "🧒🏼", "🧒🏻", "🏩", "💳", "💛", "🤍", "💜", "🖤", "💙", "💗", "🐻", "🐼",
        "🍦", "🍬", "🍭", "🔌", "🏳️‍⚧️", "🧸", "👦", "👟", "🍕", "🌈", "🏝️", "✈️"
    ]

    spam_pattern = re.compile(r'(?i)\b(?:' + '|'.join(map(re.escape, banned_words)) + r')\b')
    emoji_pattern = re.compile(r'(?:' + '|'.join(map(re.escape, banned_symbols)) + r')')

    try:
        while True:
            data = await websocket.receive_text()
            
            try:
                payload = json.loads(data)
                msg_type = payload.get("type", "chat")
                
                # 📡 LÓGICA DE SEÑALIZACIÓN DE VIDEO P2P
                if msg_type in ["webrtc_offer", "webrtc_answer", "webrtc_ice"]:
                    target_id = payload.get("target_id")
                    if target_id:
                        payload["caller_id"] = user_id 
                        payload["caller_name"] = user.name
                        await global_manager.send_personal_message(payload, int(target_id))
                    continue
                
                if msg_type == "join_video":
                    user.is_live_video = True
                    db.commit()
                    await global_manager.broadcast({"type": "radar_update", "user_id": user_id, "name": user.name, "status": "live"})
                    continue

                if msg_type == "leave_video":
                    user.is_live_video = False
                    db.commit()
                    await global_manager.broadcast({"type": "radar_update", "user_id": user_id, "name": user.name, "status": "online"})
                    continue

                # 💬 LÓGICA DE CHAT TRADICIONAL
                text_val = payload.get("text", "")
                media_val = payload.get("media_url", None)

                current_warnings = getattr(user, 'warnings_count', 0)
                if current_warnings is None: current_warnings = 0

                if not is_admin:
                    if link_pattern.search(text_val) or spam_pattern.search(text_val) or emoji_pattern.search(text_val):
                        user.warnings_count = current_warnings + 1
                        penalty_amount = 5 
                        
                        wallet = db.query(Wallet).filter(Wallet.user_id == user_id).first()
                        if wallet and wallet.alpha_balance >= penalty_amount:
                            wallet.alpha_balance -= penalty_amount
                            tx = Transaction(sender_id=user_id, receiver_id=None, amount=penalty_amount, tx_type="spam_penalty")
                            db.add(tx)
                        db.commit()

                        warning_msg = f"⚠️ @{user.name}, contenido bloqueado por política de seguridad (Scam/CSAM/Links). Llevas {user.warnings_count} de 4 advertencias. A la 5ta serás BANEADO. Multa: -{penalty_amount} $ALPHA."
                        
                        sys_msg = ChatMessage(
                            user_id=8269470905, 
                            author_name="Centinela",
                            author_role="admin",
                            access_level=5,
                            content=json.dumps({"text": warning_msg, "media_url": None}),
                            is_system=False 
                        )
                        db.add(sys_msg)
                        db.commit()
                        db.refresh(sys_msg)
                        
                        sys_payload = {
                            "type": "new_msg",
                            "id": sys_msg.id, "user_id": sys_msg.user_id, "author_name": sys_msg.author_name,
                            "author_role": sys_msg.author_role, "access_level": sys_msg.access_level,
                            "content": sys_msg.content, "is_system": sys_msg.is_system,
                            "created_at": sys_msg.created_at.isoformat()
                        }
                        await global_manager.broadcast(sys_payload)
                        
                        if user.warnings_count >= 5:
                            await websocket.send_json({"is_error": True, "message": "🚫 Límite de advertencias superado."})
                            await websocket.close(code=1008)
                        continue
                    
                    if current_warnings >= 5:
                        await websocket.send_json({"is_error": True, "message": "🚫 Cuenta restringida (5/5 faltas)."})
                        continue

                    if "@" in text_val:
                        if user.role != "creator":
                            await websocket.send_json({"is_error": True, "message": "Etiquetar es exclusivo para Creadores."})
                            continue
                        if user.role == "creator" and user.access_level < 1:
                            await websocket.send_json({"is_error": True, "message": "Requieres Soldier Creator para etiquetar."})
                            continue

                    if media_val:
                        if media_val.startswith("data:video") and user.access_level < 3:
                            await websocket.send_json({"is_error": True, "message": "Requiere LEGEND para enviar videos."})
                            continue
                        if media_val.startswith("data:image") and user.access_level < 2:
                            await websocket.send_json({"is_error": True, "message": "Requiere VETERAN para enviar fotos."})
                            continue
                        if media_val.startswith("data:audio"):
                            await websocket.send_json({"is_error": True, "message": "🚫 Notas de voz inhabilitadas en Chat Global."})
                            continue

                    if user.role == "fan" and user.access_level == 0:
                        wallet = db.query(Wallet).filter(Wallet.user_id == user_id).first()
                        if not wallet or wallet.alpha_balance < 1:
                            await websocket.send_json({"is_error": True, "message": "Saldo insuficiente (Costo: 1 $ALPHA)."})
                            continue 
                        
                        wallet.alpha_balance -= 1
                        wallet.total_spent += 1
                        tx = Transaction(sender_id=user_id, receiver_id=None, amount=1, tx_type="spy_chat_fee")
                        db.add(tx)
                        db.commit()

                db_content = json.dumps({"text": text_val, "media_url": media_val})
                new_msg = ChatMessage(
                    user_id=user.user_id,
                    author_name=f"[Global] {user.name}",
                    author_role=user.role,
                    access_level=user.access_level,
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
                    "created_at": new_msg.created_at.isoformat()
                }
                await global_manager.broadcast(msg_payload)
            except Exception:
                pass
            
    except WebSocketDisconnect:
        user.is_online = False
        user.is_live_video = False
        user.last_seen = datetime.utcnow()
        db.commit()
        global_manager.disconnect(websocket, user_id)
        await global_manager.broadcast({"type": "radar_update", "user_id": user_id, "name": user.name, "status": "offline"})
    except Exception:
        user.is_online = False
        user.is_live_video = False
        db.commit()
        global_manager.disconnect(websocket, user_id)