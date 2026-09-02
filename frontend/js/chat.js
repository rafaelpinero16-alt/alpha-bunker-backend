import json
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends
from sqlalchemy.orm import Session
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
        if websocket not in self.active_connections:
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
    try:
        time_threshold = datetime.utcnow() - timedelta(hours=24)
        db.query(ChatMessage).filter(ChatMessage.created_at < time_threshold).delete()
        db.commit()
    except Exception:
        db.rollback()

# --- 1. SOPORTE BÚNKER (CRM PRIVADO CON ADMIN) ---
@router.websocket("/ws/{user_id}")
async def websocket_endpoint(websocket: WebSocket, user_id: int, db: Session = Depends(get_db)):
    await manager.connect(websocket)
    user = db.query(User).filter(User.user_id == user_id).first()
    
    u_name = getattr(user, "name", "Agente") if user else "Agente"
    u_role = getattr(user, "role", "fan") if user else "fan"
    u_access = getattr(user, "access_level", 0) if user else 0

    try:
        while True:
            data = await websocket.receive_text()
            db_content = json.dumps({"text": data, "media_url": None})
            
            # BROADCAST INMEDIATO (El chat nunca se congela)
            msg_payload = {
                "id": int(datetime.utcnow().timestamp()),
                "user_id": user_id,
                "author_name": u_name,
                "author_role": u_role,
                "access_level": u_access,
                "content": db_content,
                "is_system": False,
                "created_at": datetime.utcnow().isoformat()
            }
            await manager.broadcast(msg_payload)

            # GUARDADO SILENCIOSO
            try:
                new_msg = ChatMessage(
                    user_id=user_id,
                    author_name=u_name,
                    author_role=u_role,
                    access_level=u_access,
                    content=db_content,
                    is_system=False
                )
                db.add(new_msg)
                db.commit()
            except Exception as db_err:
                db.rollback()
                print(f"[DB CRM ERROR]: {db_err}")

    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as e:
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
    user = db.query(User).filter(User.user_id == user_id).first()
    
    # 🛡️ Fallbacks seguros para evitar crashes si el usuario falta
    u_name = getattr(user, "name", "Agente Búnker") if user else "Agente Búnker"
    u_role = getattr(user, "role", "fan") if user else "fan"
    u_access = getattr(user, "access_level", 0) if user else 0
    kyc = getattr(user, "kyc_status", "unverified") if user else "unverified"

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

            is_admin = (u_role == "admin" or user_id == 8269470905)

            if not is_admin:
                if u_role == "creator" and kyc != "verified":
                    await websocket.send_json({"is_error": True, "message": "⚠️ Identidad no confirmada. Requieres KYC para escribir."})
                    continue

                if "@" in text_val:
                    if u_role != "creator" or u_access < 1:
                        await websocket.send_json({"is_error": True, "message": "⚠️ Necesitas membresía Soldier Creator o superior para etiquetar."})
                        continue

                if media_val:
                    if media_val.startswith("data:video") and u_access < 3:
                        await websocket.send_json({"is_error": True, "message": "⚠️ Requiere rango LEGEND para enviar videos al chat."})
                        continue
                    if media_val.startswith("data:image") and u_access < 2:
                        await websocket.send_json({"is_error": True, "message": "⚠️ Requiere rango VETERAN para enviar fotos al chat."})
                        continue

                if u_role == "fan" and u_access == 0:
                    wallet = db.query(Wallet).filter(Wallet.user_id == user_id).first()
                    if not wallet or getattr(wallet, "alpha_balance", 0) < 1:
                        await websocket.send_json({"is_error": True, "message": "⚠️ Saldo insuficiente. Espías pagan 1 $ALPHA por mensaje."})
                        continue 
                    
                    try:
                        wallet.alpha_balance -= 1
                        wallet.total_spent = getattr(wallet, "total_spent", 0) + 1
                        tx = Transaction(sender_id=user_id, receiver_id=None, amount=1, tx_type="spy_chat_fee")
                        db.add(tx)
                        db.commit()
                    except Exception as we:
                        db.rollback()

            db_content = json.dumps({"text": text_val, "media_url": media_val})

            # 🛡️ 1. BROADCAST INMEDIATO AL FRONTEND (Garantiza que el mensaje salga de inmediato)
            msg_payload = {
                "id": int(datetime.utcnow().timestamp()),
                "user_id": user_id,
                "author_name": f"[Global] {u_name}",
                "author_role": u_role,
                "access_level": u_access,
                "content": db_content,
                "is_system": False,
                "created_at": datetime.utcnow().isoformat()
            }
            await global_manager.broadcast(msg_payload)

            # 🛡️ 2. GUARDADO DB SILENCIOSO (Si falla por estructura, el socket NO se corta)
            try:
                new_msg = ChatMessage(
                    user_id=user_id,
                    author_name=f"[Global] {u_name}",
                    author_role=u_role,
                    access_level=u_access,
                    content=db_content,
                    is_system=False
                )
                db.add(new_msg)
                db.commit()
            except Exception as db_err:
                db.rollback()
                print(f"[DB SAVE ERROR IGNORADO]: {db_err}")
            
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