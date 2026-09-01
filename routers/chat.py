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

# 🧹 Limpieza Automática de 24 horas[cite: 16]
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
        await websocket.close(code=1008)
        return

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
    if not user:
        await websocket.close(code=1008)
        return

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

            if not is_admin:
                # 🛡️ REGLA 1: Creadores sin KYC verificado no pueden escribir
                if user.role == "creator" and user.kyc_status != "verified":
                    await websocket.send_json({"is_error": True, "message": "⚠️ Identidad no confirmada. Requieres KYC para escribir en el chat."})
                    continue

                # 🛡️ REGLA 2: Etiquetar (@) es exclusivo de Soldier Creator (Nivel 1) o superior
                if "@" in text_val:
                    if user.role != "creator":
                        await websocket.send_json({"is_error": True, "message": "⚠️ Etiquetar usuarios es exclusivo para Creadores."})
                        continue
                    if user.role == "creator" and user.access_level < 1:
                        await websocket.send_json({"is_error": True, "message": "⚠️ Necesitas membresía Soldier Creator o superior para etiquetar."})
                        continue

                # 🛡️ REGLA 3: Control de Multimedia por Rangos
                if media_val:
                    if media_val.startswith("data:video") and user.access_level < 3:
                        await websocket.send_json({"is_error": True, "message": "⚠️ Requiere rango LEGEND para enviar videos al chat."})
                        continue
                    if media_val.startswith("data:image") and user.access_level < 2:
                        await websocket.send_json({"is_error": True, "message": "⚠️ Requiere rango VETERAN para enviar fotos al chat."})
                        continue

                # 🛡️ REGLA 4: Espía (Nivel 0) paga 1 $ALPHA por cada mensaje
                if user.role == "fan" and user.access_level == 0:
                    wallet = db.query(Wallet).filter(Wallet.user_id == user_id).first()
                    if not wallet or wallet.alpha_balance < 1:
                        await websocket.send_json({"is_error": True, "message": "⚠️ Saldo insuficiente. Espías pagan 1 $ALPHA por mensaje en este canal."})
                        continue 
                    
                    wallet.alpha_balance -= 1
                    wallet.total_spent += 1
                    tx = Transaction(sender_id=user_id, receiver_id=None, amount=1, tx_type="spy_chat_fee")
                    db.add(tx)
                    db.commit()

            # Guardado en DB si pasó todas las pruebas
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

@router.get("/global/history")
def get_global_chat_history(limit: int = 50, db: Session = Depends(get_db)):
    clean_old_messages(db)
    messages = db.query(ChatMessage).filter(ChatMessage.author_name.like("[Global]%")).order_by(ChatMessage.created_at.desc()).limit(limit).all()
    return {"status": "success", "messages": messages[::-1]}