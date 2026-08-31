from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from datetime import datetime
from database.db import get_db
from database.models import Post, UnlockedPost, User, Wallet, Transaction, ChatMessage
from routers.chat import manager  # Para lanzar la alerta dorada en el chat si se desea

router = APIRouter(prefix="/posts", tags=["Posts y Contenido"])

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

@router.get("/")
def get_posts():
    return {"message": "Módulo de posts en línea y listo para estructurar."}[cite: 6]

@router.post("/create")
def create_post(data: PostCreateRequest, db: Session = Depends(get_db)):
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

@router.get("/feed/{user_id}")
def get_feed(user_id: int, db: Session = Depends(get_db)):
    try:
        posts = db.query(Post).order_by(Post.date_created.desc()).all()
        user = db.query(User).filter(User.user_id == user_id).first()
        user_access_level = user.access_level if user else 0

        # Obtener los IDs de posts que este usuario ya ha desbloqueado mediante PPV
        unlocked_records = db.query(UnlockedPost.post_id).filter(UnlockedPost.user_id == user_id).all()
        unlocked_post_ids = {r[0] for r in unlocked_records}

        feed_data = []
        for p in posts:
            # Lógica de bloqueo: Es PPV si cuesta alpha y no lo ha desbloqueado, O si requiere un nivel superior al del usuario
            is_ppv_locked = p.is_ppv and p.price_alpha > 0 and p.id not in unlocked_post_ids
            is_tier_locked = p.levelRequired > user_access_level
            
            is_locked = is_ppv_locked or is_tier_locked

            feed_data.append({
                "id": p.id,
                "creator_id": p.creator_id,
                "author": p.author,
                "content": p.text_es,
                "media_url": None if is_locked else p.image_url, # Se oculta la imagen si está bloqueado
                "levelRequired": p.levelRequired,
                "is_ppv": p.is_ppv,
                "price_alpha": p.price_alpha,
                "is_locked": is_locked,
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

        # Verificar si ya lo tiene desbloqueado
        existing_unlock = db.query(UnlockedPost).filter(
            UnlockedPost.user_id == data.user_id,
            UnlockedPost.post_id == data.post_id
        ).first()

        if existing_unlock:
            return {"status": "success", "message": "El contenido ya estaba desbloqueado."}

        # Validar billetera del fan
        fan_wallet = db.query(Wallet).filter(Wallet.user_id == data.user_id).first()
        if not fan_wallet or fan_wallet.alpha_balance < post.price_alpha:
            raise HTTPException(status_code=400, detail="Saldo insuficiente en $ALPHA para desbloquear este contenido.")

        # Billetera del creador
        creator_wallet = db.query(Wallet).filter(Wallet.user_id == post.creator_id).first()
        if not creator_wallet:
            creator_wallet = Wallet(user_id=post.creator_id, alpha_balance=0)
            db.add(creator_wallet)

        # Transacción de tokens
        fan_wallet.alpha_balance -= post.price_alpha
        fan_wallet.total_spent += post.price_alpha

        creator_wallet.alpha_balance += post.price_alpha
        creator_wallet.total_earned += post.price_alpha

        # Registrar desbloqueo permanente
        new_unlock = UnlockedPost(user_id=data.user_id, post_id=data.post_id)
        db.add(new_unlock)

        # Transacción histórica
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
            
        # Validar que sea el dueño o el admin maestro (8269470905)
        ADMIN_ID = 8269470905
        if post.creator_id != user_id and user_id != ADMIN_ID:
            raise HTTPException(status_code=403, detail="No tienes permisos para eliminar este post.")
            
        db.delete(post)
        db.commit()
        return {"status": "success", "message": "Publicación eliminada correctamente."}
    except HTTPException as h:
        raise h
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail="Error al eliminar el post.")