from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from datetime import datetime
from typing import Optional
from pydantic import BaseModel
from database.db import get_db
from database.models import User, Post, UnlockedPost, Wallet, Transaction

router = APIRouter(tags=["Posts Globales"])

class CreatePostRequest(BaseModel):
    user_id: int
    author: Optional[str] = "mastertom"
    text_es: Optional[str] = ""
    image_url: Optional[str] = None
    levelRequired: int = 0
    is_ppv: bool = False
    price_alpha: int = 0

class UnlockPostRequest(BaseModel):
    user_id: int
    post_id: int

class DeletePostRequest(BaseModel):
    user_id: int
    post_id: int

# ==========================================
# 1. CREAR PUBLICACIÓN (Conexión BD + KYC)
# ==========================================
@router.post("/posts/create")
@router.post("/create-post")
def create_post(data: CreatePostRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.user_id == data.user_id).first()
    if not user:
        user = User(
            user_id=data.user_id,
            name=data.author or "mastertom",
            role="creator",
            kyc_status="verified",
            is_adult=True
        )
        db.add(user)
        db.commit()
        db.refresh(user)

    if user.kyc_status != "verified" and not user.is_adult:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, 
            detail="Acceso restringido: debes completar la verificación KYC (+18) para publicar en el Muro."
        )

    new_post = Post(
        creator_id=data.user_id,
        author=data.author or user.name or "mastertom",
        levelRequired=data.levelRequired,
        text_es=data.text_es,
        image_url=data.image_url,
        is_ppv=data.is_ppv,
        price_alpha=data.price_alpha,
        date_created=datetime.utcnow()
    )
    db.add(new_post)
    db.commit()
    db.refresh(new_post)

    return {
        "status": "success",
        "message": "Publicación subida al Muro Comunitario 🚀",
        "post_id": new_post.id,
        "image_url": new_post.image_url
    }

# ==========================================
# 2. FEED CON CONTROL DE ACCESO POR RANGO / PPV
# ==========================================
@router.get("/posts/feed/{user_id}")
def get_user_feed(user_id: int, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.user_id == user_id).first()
    user_level = user.access_level if user else 0

    unlocked_records = db.query(UnlockedPost.post_id).filter(UnlockedPost.user_id == user_id).all()
    unlocked_ids = {r[0] for r in unlocked_records}

    posts = db.query(Post).order_by(Post.date_created.desc()).all()
    feed = []

    for post in posts:
        can_view = (
            post.id in unlocked_ids or
            (user_level >= post.levelRequired and not post.is_ppv) or
            (post.creator_id == user_id)
        )

        feed.append({
            "id": post.id,
            "creator_id": post.creator_id,
            "author": post.author or "mastertom",
            "content": post.text_es,
            "media_url": post.image_url if can_view else None,
            "levelRequired": post.levelRequired,
            "is_ppv": post.is_ppv,
            "price_alpha": post.price_alpha,
            "is_locked": not can_view,
            "date_created": post.date_created.isoformat() if post.date_created else None
        })

    return {"status": "success", "posts": feed}

# ==========================================
# 3. FEED GLOBAL (COMPATIBILIDAD)
# ==========================================
@router.get("/get-posts")
def get_all_posts(db: Session = Depends(get_db)):
    posts = db.query(Post).order_by(Post.date_created.desc()).all()
    feed = []
    for post in posts:
        feed.append({
            "id": post.id,
            "creator_id": post.creator_id,
            "author": post.author or "mastertom",
            "content": post.text_es,
            "text_es": post.text_es,
            "media_url": post.image_url,
            "image_url": post.image_url,
            "levelRequired": post.levelRequired,
            "is_ppv": post.is_ppv,
            "price_alpha": post.price_alpha,
            "is_locked": False,
            "date_created": post.date_created.isoformat() if post.date_created else None
        })
    return {"posts": feed}

# ==========================================
# 4. DESBLOQUEO DE CONTENIDO EXCLUSIVO
# ==========================================
@router.post("/posts/unlock")
def unlock_post(data: UnlockPostRequest, db: Session = Depends(get_db)):
    post = db.query(Post).filter(Post.id == data.post_id).first()
    if not post:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Publicación no encontrada")

    already_unlocked = db.query(UnlockedPost).filter(
        UnlockedPost.user_id == data.user_id,
        UnlockedPost.post_id == data.post_id
    ).first()
    if already_unlocked:
        return {
            "status": "success",
            "message": "Contenido ya desbloqueado previamente",
            "media_url": post.image_url
        }

    wallet = db.query(Wallet).filter(Wallet.user_id == data.user_id).first()
    if not wallet or wallet.alpha_balance < post.price_alpha:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Saldo insuficiente de tokens $ALPHA")

    wallet.alpha_balance -= post.price_alpha
    wallet.total_spent += post.price_alpha

    tx = Transaction(
        sender_id=data.user_id,
        amount=post.price_alpha,
        tx_type="post_unlock",
        reference_id=data.post_id,
        created_at=datetime.utcnow()
    )
    db.add(tx)

    unlocked_entry = UnlockedPost(
        user_id=data.user_id,
        post_id=data.post_id,
        unlocked_at=datetime.utcnow()
    )
    db.add(unlocked_entry)
    db.commit()

    return {
        "status": "success",
        "message": "Contenido desbloqueado con éxito",
        "media_url": post.image_url
    }

# ==========================================
# 5. ELIMINAR PUBLICACIÓN (AUTOR O MASTER ADMIN)
# ==========================================
@router.post("/posts/delete")
def delete_post(data: DeletePostRequest, db: Session = Depends(get_db)):
    post = db.query(Post).filter(Post.id == data.post_id).first()
    if not post:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Publicación no encontrada")

    ADMIN_ID = 8269470905
    if post.creator_id != data.user_id and data.user_id != ADMIN_ID:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, 
            detail="No tienes autorización para eliminar este contenido"
        )

    # Limpiar desbloqueos relacionados con este post
    db.query(UnlockedPost).filter(UnlockedPost.post_id == data.post_id).delete()

    # Eliminar registro del post
    db.delete(post)
    db.commit()

    return {
        "status": "success",
        "message": f"Publicación #{data.post_id} eliminada permanentemente del Muro."
    }