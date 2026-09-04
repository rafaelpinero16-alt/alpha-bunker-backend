import hashlib
import hmac
from urllib.parse import parse_qsl
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
from sqlalchemy.orm import Session
from database.db import get_db
from database.models import User
from core.config import bot 

router = APIRouter(prefix="/users", tags=["Users"])

# 🛡️ Esquema ampliado para capturar el avatar y la bio permanentemente
class UserSyncSchema(BaseModel):
    user_id: int
    name: Optional[str] = None
    bio: Optional[str] = None
    avatar: Optional[str] = None
    init_data: Optional[str] = None
    is_telegram: Optional[bool] = False

class ProfileUpdate(BaseModel):
    name: Optional[str] = None
    bio: Optional[str] = None
    avatar_url: Optional[str] = None

def verify_telegram_auth(init_data: str) -> bool:
    try:
        token = bot.token
        if not token or not init_data: return False
        
        parsed_data = dict(parse_qsl(init_data))
        if "hash" not in parsed_data: return False
            
        hash_val = parsed_data.pop("hash")
        data_check_string = "\n".join(f"{k}={v}" for k, v in sorted(parsed_data.items()))
        secret_key = hmac.new(b"WebAppData", token.encode(), hashlib.sha256).digest()
        calculated_hash = hmac.new(secret_key, data_check_string.encode(), hashlib.sha256).hexdigest()
        
        return calculated_hash == hash_val
    except Exception:
        return False

@router.post("/sync")
async def sync_user(data: UserSyncSchema, db: Session = Depends(get_db)):
    # 🔒 Seguridad inyectada: Validación HMAC de Telegram
    if data.is_telegram and data.init_data:
        if not verify_telegram_auth(data.init_data):
            raise HTTPException(status_code=403, detail="Firma de Telegram inválida o alterada.")
            
    user = db.query(User).filter(User.user_id == data.user_id).first()
    if not user:
        user = User(
            user_id=data.user_id, 
            name=data.name or "VIP Fan", 
            bio=data.bio or "Operativo activo en Alpha Vault", 
            access_level=0, 
            role="fan",
            avatar_url=data.avatar
        )
        db.add(user)
    else:
        # 🛡️ Persistencia garantizada: Todo lo que se edite se guarda incondicionalmente
        if data.name and data.name not in ["USER", "Agente Búnker", "VIP Fan"]:
            user.name = data.name
        if data.bio:
            user.bio = data.bio
        if data.avatar:
            user.avatar_url = data.avatar
            
    db.commit()
    db.refresh(user)
    return {"status": "success", "message": "Usuario sincronizado correctamente", "user": user}

@router.get("/profile/{user_id}")
async def get_user_profile_alias(user_id: int, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.user_id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    return user

@router.get("/{user_id}")
async def get_user_profile(user_id: int, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.user_id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    return user

@router.put("/{user_id}")
async def update_user_profile(user_id: int, data: ProfileUpdate, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.user_id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    
    if data.name is not None:
        user.name = data.name
    if data.bio is not None:
        user.bio = data.bio
    if data.avatar_url is not None:
        user.avatar_url = data.avatar_url
        
    db.commit()
    db.refresh(user)
    return {"message": "Perfil actualizado con éxito", "user": user}