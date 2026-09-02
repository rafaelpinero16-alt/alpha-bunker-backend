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

# --- 1. SOPORTE BÚNKER (CRM PRIVADO CON ADMIN) ---
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
        print(f"[CRM CHAT ERROR]: {e}")
        manager.disconnect(websocket)

@router.get("/history")
def get_chat_history(limit: int = 50, db: Session = Depends(get_db)):
    clean_old_messages(db)
    messages = db.query(ChatMessage).filter(ChatMessage.author_name.notlike("[Global]%")).order_by(ChatMessage.created_at.desc()).limit(limit).all()
    return {"status": "success", "messages": messages[::-1]}

# --- 2. CHAT GLOBAL & VIDEO BÚNKER (INDEPENDIENTE) ---
@router.websocket("/global/ws/{user_id}")
async def global_websocket_endpoint(websocket: WebSocket, user_id: int, db: Session = Depends(get_db)):
    await global_manager.connect(websocket)
    
    # 🛡️ AUTO-MIGRACIÓN SILENCIOSA: Inyecta la columna de advertencias si no existe en Railway
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

    # 🛡️ Regex Perfeccionado: Solo detecta links reales, no palabras que contengan "com"
    link_pattern = re.compile(
        r'(?i)\b(?:https?://|www\.)\S+\b|\b[a-zA-Z0-9-]+\.(?:com|net|org|me|io|tm|co|tv|app)\b'
    )

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

            is_admin = (user.role == "admin" or user.user_id == 8269470905)

            # 🛡️ BLOQUE BLINDADO: Para evitar crasheos si falta algún dato
            try:
                current_warnings = getattr(user, 'warnings_count', 0)
                if current_warnings is None: current_warnings = 0

                if not is_admin:
                    
                    # 1. Filtro Anti-Spam
                    if link_pattern.search(text_val):
                        user.warnings_count = current_warnings + 1
                        penalty_amount = 5 
                        
                        wallet = db.query(Wallet).filter(Wallet.user_id == user_id).first()
                        if wallet and wallet.alpha_balance >= penalty_amount:
                            wallet.alpha_balance -= penalty_amount
                            tx = Transaction(sender_id=user_id, receiver_id=None, amount=penalty_amount, tx_type="spam_penalty")
                            db.add(tx)
                        db.commit()

                        warning_msg = f"⚠️ @{user.name}, los enlaces externos están prohibidos. Advertencia {user.warnings_count}/5. Penalización: -{penalty_amount} $ALPHA."
                        
                        sys_msg = ChatMessage(
                            user_id=user.user_id,
                            author_name="[System] Centinela",
                            author_role="admin",
                            access_level=5,
                            content=json.dumps({"text": warning_msg, "media_url": None}),
                            is_system=True
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
                            await websocket.send_json({"is_error": True, "message": "🚫 Límite de advertencias superado. Envío restringido."})
                        continue
                    
                    # 2. Control de Baneos
                    if current_warnings >= 5:
                        await websocket.send_json({"is_error": True, "message": "🚫 Cuenta restringida por exceso de spam (5/5)."})
                        continue

                    # 3. Control de KYC para creadores
                    if user.role == "creator" and user.kyc_status != "verified":
                        await websocket.send_json({"is_error": True, "message": "⚠️ Identidad no confirmada. Requieres KYC para escribir."})
                        continue

                    # 4. Control de Menciones
                    if "@" in text_val:
                        if user.role != "creator":
                            await websocket.send_json({"is_error": True, "message": "⚠️ Etiquetar usuarios es exclusivo para Creadores."})
                            continue
                        if user.role == "creator" and user.access_level < 1:
                            await websocket.send_json({"is_error": True, "message": "⚠️ Necesitas membresía Soldier Creator o superior para etiquetar."})
                            continue

                    # 5. Control de Multimedia
                    if media_val:
                        if media_val.startswith("data:video") and user.access_level < 3:
                            await websocket.send_json({"is_error": True, "message": "⚠️ Requiere rango LEGEND para enviar videos."})
                            continue
                        if media_val.startswith("data:image") and user.access_level < 2:
                            await websocket.send_json({"is_error": True, "message": "⚠️ Requiere rango VETERAN para enviar fotos."})
                            continue

                    # 6. Cobro de Espías (Tier 0)
                    if user.role == "fan" and user.access_level == 0:
                        wallet = db.query(Wallet).filter(Wallet.user_id == user_id).first()
                        if not wallet or wallet.alpha_balance < 1:
                            await websocket.send_json({"is_error": True, "message": "⚠️ Saldo insuficiente. Espías pagan 1 $ALPHA por mensaje."})
                            continue 
                        
                        wallet.alpha_balance -= 1
                        wallet.total_spent += 1
                        tx = Transaction(sender_id=user_id, receiver_id=None, amount=1, tx_type="spy_chat_fee")
                        db.add(tx)
                        db.commit()

            except Exception as e:
                print(f"[RULE CHECK ERROR]: {e}")
                # Si falla una regla, permitimos que el mensaje siga en lugar de desconectar

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
        print(f"[GLOBAL CHAT ERROR]: {e}")
        global_manager.disconnect(websocket)

@router.get("/global/history")
def get_global_chat_history(limit: int = 50, db: Session = Depends(get_db)):
    clean_old_messages(db)
    messages = db.query(ChatMessage).filter(ChatMessage.author_name.like("[Global]%")).order_by(ChatMessage.created_at.desc()).limit(limit).all()
    return {"status": "success", "messages": messages[::-1]}