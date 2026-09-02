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

class UserSyncSchema(BaseModel):
    user_id: int
    name: Optional[str] = "Agente Búnker"
    bio: Optional[str] = "Operativo activo en Alpha Vault"
    init_data: Optional[str] = None
    is_telegram: Optional[bool] = False

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
    if data.is_telegram and data.init_data:
        if not verify_telegram_auth(data.init_data):
            raise HTTPException(status_code=403, detail="Firma de Telegram inválida o alterada.")
            
    user = db.query(User).filter(User.user_id == data.user_id).first()
    if not user:
        user = User(
            user_id=data.user_id, 
            name=data.name, 
            bio=data.bio, 
            access_level=0, 
            role="fan"
        )
        db.add(user)
    else:
        if data.name and user.name in ["USER", "Cyber Operative", "Agente Búnker"]:
            user.name = data.name
            
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
async def update_user_profile(user_id: int, data: dict, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.user_id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    
    if "name" in data and data["name"] is not None:
        user.name = data["name"]
    if "bio" in data and data["bio"] is not None:
        user.bio = data["bio"]
    if "avatar_url" in data and data["avatar_url"] is not None:
        user.avatar_url = data["avatar_url"]
        
    db.commit()
    db.refresh(user)
    return {"message": "Perfil actualizado con éxito", "user": user}