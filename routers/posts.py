import os
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import text
from datetime import datetime
from database.db import get_db
from database.models import Post, UnlockedPost, User, Wallet, Transaction, ChatMessage
from routers.chat import manager

router = APIRouter(prefix="/posts", tags=["Posts y Contenido"])

ADMIN_TELEGRAM_ID = int(os.getenv("ADMIN_TELEGRAM_ID", "8269470905"))

class PostCreateRequest(BaseModel):
    user_id: int
    author: str
    text_es: str | None = None
    image_url: str | None = None
    levelRequired: int = 0
    is_ppv: bool = False
    price_alpha: int = 0

class UnlockPostRequest(BaseModel):
    user_id: int
    post_id: int

class LikeRequest(BaseModel):
    user_id: int
    post_id: int
    action: str

# 🛡️ Función para forzar la estructura correcta en la Base de Datos
def ensure_db_schema(db: Session):
    try:
        db.execute(text("ALTER TABLE posts ALTER COLUMN image_url TYPE TEXT"))
        db.commit()
    except:
        db.rollback()
    try:
        db.execute(text("ALTER TABLE posts ADD COLUMN likes_count INTEGER DEFAULT 0"))
        db.commit()
    except:
        db.rollback()

@router.get("/")
def get_posts(db: Session = Depends(get_db)):
    ensure_db_schema(db)
    return {"message": "Módulo de posts en línea y blindado."}

@router.post("/create")
def create_post(data: PostCreateRequest, db: Session = Depends(get_db)):
    ensure_db_schema(db)
    try:
        new_post = Post(
            creator_id=data.user_id,
            author=data.author,
            text_es=data.text_es,
            image_url=data.image_url,
            levelRequired=data.levelRequired,
            is_ppv=data.is_ppv,
            price_alpha=data.price_alpha
        )
        db.add(new_post)
        db.commit()
        db.refresh(new_post)
        return {"status": "success", "message": "Publicación creada con éxito.", "post_id": new_post.id}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail="Error al crear la publicación.")

# 🛡️ Nuevo Endpoint para sumar Likes Reales
@router.post("/like")
def toggle_like(data: LikeRequest, db: Session = Depends(get_db)):
    ensure_db_schema(db)
    try:
        post = db.query(Post).filter(Post.id == data.post_id).first()
        if not post:
            raise HTTPException(status_code=404, detail="Post no encontrado")
        
        if not hasattr(post, 'likes_count') or post.likes_count is None:
            post.likes_count = 0
            
        if data.action == 'like':
            post.likes_count += 1
        else:
            post.likes_count = max(0, post.likes_count - 1)
            
        db.commit()
        return {"status": "success", "likes_count": post.likes_count}
    except Exception as e:
        db.rollback()
        return {"status": "error"}

@router.get("/feed/{user_id}")
def get_feed(user_id: int, db: Session = Depends(get_db)):
    ensure_db_schema(db)
    try:
        posts = db.query(Post).order_by(Post.date_created.desc()).all()
        user = db.query(User).filter(User.user_id == user_id).first()
        user_access_level = user.access_level if user else 0

        unlocked_records = db.query(UnlockedPost.post_id).filter(UnlockedPost.user_id == user_id).all()
        unlocked_post_ids = {r[0] for r in unlocked_records}

        feed_data = []
        for p in posts:
            post_author = db.query(User).filter(User.user_id == p.creator_id).first()
            author_role = post_author.role if post_author else "fan"

            is_ppv_locked = p.is_ppv and p.price_alpha > 0 and p.id not in unlocked_post_ids
            is_tier_locked = p.levelRequired > user_access_level
            
            is_locked = is_ppv_locked or is_tier_locked
            
            likes_c = getattr(p, 'likes_count', 0)

            feed_data.append({
                "id": p.id,
                "creator_id": p.creator_id,
                "author": p.author,
                "author_role": author_role,
                "content": p.text_es,
                "media_url": None if is_locked else p.image_url,
                "levelRequired": p.levelRequired,
                "is_ppv": p.is_ppv,
                "price_alpha": p.price_alpha,
                "is_locked": is_locked,
                "likes_count": likes_c if likes_c is not None else 0,
                "date_created": p.date_created.isoformat()
            })

        return {"status": "success", "posts": feed_data}
    except Exception as e:
        print(f"[FEED ERROR]: {e}")
        raise HTTPException(status_code=500, detail="Error al cargar el feed.")

@router.post("/unlock")
async def unlock_post(data: UnlockPostRequest, db: Session = Depends(get_db)):
    try:
        post = db.query(Post).filter(Post.id == data.post_id).first()
        if not post:
            raise HTTPException(status_code=404, detail="Publicación no encontrada.")

        existing_unlock = db.query(UnlockedPost).filter(
            UnlockedPost.user_id == data.user_id,
            UnlockedPost.post_id == data.post_id
        ).first()

        if existing_unlock:
            return {"status": "success", "message": "El contenido ya estaba desbloqueado."}

        fan_wallet = db.query(Wallet).filter(Wallet.user_id == data.user_id).first()
        if not fan_wallet or fan_wallet.alpha_balance < post.price_alpha:
            raise HTTPException(status_code=400, detail="Saldo insuficiente en $ALPHA para desbloquear este contenido.")

        creator_wallet = db.query(Wallet).filter(Wallet.user_id == post.creator_id).first()
        if not creator_wallet:
            creator_wallet = Wallet(user_id=post.creator_id, alpha_balance=0, total_earned=0, total_spent=0)
            db.add(creator_wallet)

        fan_wallet.alpha_balance -= post.price_alpha
        fan_wallet.total_spent += post.price_alpha

        creator_wallet.alpha_balance += post.price_alpha
        creator_wallet.total_earned += post.price_alpha

        new_unlock = UnlockedPost(user_id=data.user_id, post_id=data.post_id)
        db.add(new_unlock)

        tx = Transaction(
            sender_id=data.user_id,
            receiver_id=post.creator_id,
            amount=post.price_alpha,
            tx_type="ppv_unlock",
            reference_id=data.post_id
        )
        db.add(tx)
        db.commit()

        return {"status": "success", "message": "Contenido desbloqueado con éxito.", "price_paid": post.price_alpha}

    except HTTPException as http_exc:
        raise http_exc
    except Exception as e:
        db.rollback()
        print(f"[UNLOCK ERROR]: {e}")
        raise HTTPException(status_code=500, detail="Error interno al procesar el desbloqueo.")

@router.post("/delete")
def delete_post(data: dict, db: Session = Depends(get_db)):
    try:
        user_id = data.get("user_id")
        post_id = data.get("post_id")
        
        post = db.query(Post).filter(Post.id == post_id).first()
        if not post:
            raise HTTPException(status_code=404, detail="Post no encontrado")
            
        if post.creator_id != user_id and user_id != ADMIN_TELEGRAM_ID and user_id != 123456789: # JaviAdmin ID placeholder
            raise HTTPException(status_code=403, detail="No tienes permisos para eliminar este post.")
            
        db.delete(post)
        db.commit()
        return {"status": "success", "message": "Publicación eliminada correctamente."}
    except HTTPException as h:
        raise h
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail="Error al eliminar el post.")