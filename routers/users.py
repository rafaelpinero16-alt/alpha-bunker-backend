from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
from sqlalchemy.orm import Session
from database.db import get_db
from database.models import User

router = APIRouter(prefix="/users", tags=["Users"])

class UserSyncSchema(BaseModel):
    user_id: int
    name: Optional[str] = "Agente Búnker"
    bio: Optional[str] = "Operativo activo en Alpha Vault"

class ProfileUpdate(BaseModel):
    name: Optional[str] = None
    bio: Optional[str] = None
    avatar_url: Optional[str] = None

@router.post("/sync")
async def sync_user(data: UserSyncSchema, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.user_id == data.user_id).first()
    if not user:
        user = User(
            user_id=data.user_id, 
            name=data.name, 
            bio=data.bio, 
            access_level=1
        )
        db.add(user)
    else:
        if data.name:
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