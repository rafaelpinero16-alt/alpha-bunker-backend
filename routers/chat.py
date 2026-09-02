import json
import re
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import List
from datetime import datetime, timedelta
from database.db import get_db
from database.models import User, ChatMessage, Wallet, Transaction

router = APIRouter(prefix="/chat", tags=["Chat En Vivo y CRM"])

class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, message: dict):
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except Exception:
                pass

manager = ConnectionManager()
global_manager = ConnectionManager()

def clean_old_messages(db: Session):
    time_threshold = datetime.utcnow() - timedelta(hours=24)
    db.query(ChatMessage).filter(ChatMessage.created_at < time_threshold).delete()
    db.commit()

@router.websocket("/ws/{user_id}")
async def websocket_endpoint(websocket: WebSocket, user_id: int, db: Session = Depends(get_db)):
    await manager.connect(websocket)
    user = db.query(User).filter(User.user_id == user_id).first()
    
    if not user:
        user = User(user_id=user_id, name="Agente Búnker", role="fan", access_level=0, kyc_status="unverified")
        db.add(user)
        db.commit()
        db.refresh(user)

    try:
        while True:
            data = await websocket.receive_text()
            db_content = json.dumps({"text": data, "media_url": None})
            
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
        manager.disconnect(websocket)
    except Exception as e:
        manager.disconnect(websocket)

@router.get("/history")
def get_chat_history(limit: int = 50, db: Session = Depends(get_db)):
    clean_old_messages(db)
    messages = db.query(ChatMessage).filter(ChatMessage.author_name.notlike("[Global]%")).order_by(ChatMessage.created_at.desc()).limit(limit).all()
    return {"status": "success", "messages": messages[::-1]}

@router.websocket("/global/ws/{user_id}")
async def global_websocket_endpoint(websocket: WebSocket, user_id: int, db: Session = Depends(get_db)):
    try:
        db.execute(text("SELECT warnings_count FROM users LIMIT 1"))
    except Exception:
        db.rollback()
        try:
            db.execute(text("ALTER TABLE users ADD COLUMN warnings_count INTEGER DEFAULT 0"))
            db.commit()
        except Exception:
            db.rollback()

    user = db.query(User).filter(User.user_id == user_id).first()
    
    if not user:
        user = User(user_id=user_id, name="Agente Búnker", role="fan", access_level=0, kyc_status="unverified", warnings_count=0)
        db.add(user)
        db.commit()
        db.refresh(user)

    is_admin = (user.role == "admin" or user.user_id == 8269470905)

    if not is_admin and user.role == "creator" and user.kyc_status != "verified":
        await websocket.accept()
        await websocket.send_json({"is_error": True, "message": "🚫 ACCESO DENEGADO: Creadores requieren KYC (+18) aprobado para el Chat Global."})
        await websocket.close(code=1008)
        return

    await global_manager.connect(websocket)

    # 🛡️ Regex Base para Enlaces
    link_pattern = re.compile(
        r'(?i)(?:https?://|www\.|t\.me/)\S+|(?:\b[a-z0-9-]+\.)+(?:com|net|org|me|io|tm|co|tv|app|ly|gl)\b'
    )

    # 🛡️ Matriz de Palabras Prohibidas (Blacklist Absoluta)
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
            text_val = data
            media_val = None
            try:
                payload = json.loads(data)
                text_val = payload.get("text", "")
                media_val = payload.get("media_url", None)
            except:
                pass

            try:
                current_warnings = getattr(user, 'warnings_count', 0)
                if current_warnings is None: current_warnings = 0

                if not is_admin:
                    # 1. Filtro Estricto: Links O Palabras/Emojis Prohibidos
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

            except Exception as e:
                pass

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
            
    except WebSocketDisconnect:
        global_manager.disconnect(websocket)
    except Exception as e:
        global_manager.disconnect(websocket)

@router.get("/global/history")
def get_global_chat_history(limit: int = 50, db: Session = Depends(get_db)):
    clean_old_messages(db)
    messages = db.query(ChatMessage).filter(ChatMessage.author_name.like("[Global]%")).order_by(ChatMessage.created_at.desc()).limit(limit).all()
    return {"status": "success", "messages": messages[::-1]}