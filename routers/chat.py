from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime
from database.db import get_db
from database.models import User, ChatMessage

router = APIRouter(prefix="/chat", tags=["Chat En Vivo"])

class ConnectionManager:
    def __init__(self):
        # Almacena los WebSockets de los usuarios actualmente conectados
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
                pass # Evita que un error en un cliente cuelgue el chat

manager = ConnectionManager()

@router.websocket("/ws/{user_id}")
async def websocket_endpoint(websocket: WebSocket, user_id: int, db: Session = Depends(get_db)):
    await manager.connect(websocket)
    
    # 1. Validar que el usuario existe en la base de datos
    user = db.query(User).filter(User.user_id == user_id).first()
    if not user:
        await websocket.close(code=1008)
        return

    try:
        while True:
            # 2. Esperar mensaje del frontend
            data = await websocket.receive_text()
            
            # 3. Guardar el mensaje en el historial (Base de datos)
            new_msg = ChatMessage(
                user_id=user.user_id,
                author_name=user.name,
                author_role=user.role,
                access_level=user.access_level,
                content=data,
                is_system=False
            )
            db.add(new_msg)
            db.commit()
            db.refresh(new_msg)

            # 4. Transmitir el mensaje a todos los usuarios conectados instantáneamente
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
    """Obtiene el historial para que al entrar se vean los últimos 50 mensajes."""
    messages = db.query(ChatMessage).order_by(ChatMessage.created_at.desc()).limit(limit).all()
    # Los devolvemos al revés para que los más recientes queden abajo
    return {"status": "success", "messages": messages[::-1]}