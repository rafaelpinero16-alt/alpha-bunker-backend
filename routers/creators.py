from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from database.db import get_db
from database.models import TipMenuSlot, User, Wallet, Transaction

router = APIRouter(prefix="/creators", tags=["Creators & Tip Menu"])

class TipMenuSlotSchema(BaseModel):
    user_id: int
    slot_number: int  # Del 1 al 10
    title: str
    price_alpha: int

class SubscribeTierSchema(BaseModel):
    user_id: int
    tier_slug: str  # 'soldier_creator' o 'icon_creator'

@router.get("/{creator_id}/tip-menu")
def get_creator_tip_menu(creator_id: int, db: Session = Depends(get_db)):
    """Obtiene los 10 espacios del Tip Menu del creador de forma segura."""
    slots = db.query(TipMenuSlot).filter(TipMenuSlot.creator_id == creator_id).all()
    return {"status": "success", "slots": slots or []}

@router.post("/tip-menu/update")
def update_tip_menu_slot(data: TipMenuSlotSchema, db: Session = Depends(get_db)):
    """Crea o actualiza uno de los 10 espacios del Tip Menu (Requiere ser creador verificado)."""
    if not (1 <= data.slot_number <= 10):
        raise HTTPException(status_code=400, detail="El espacio debe ser un número entre 1 y 10.")
    
    creator = db.query(User).filter(
        User.user_id == data.user_id,
        User.role.in_(["creator", "admin"])
    ).first()
    
    if not creator:
        raise HTTPException(status_code=403, detail="Acceso denegado. Solo creadores verificados pueden editar su Tip Menu.")
    
    slot = db.query(TipMenuSlot).filter(
        TipMenuSlot.creator_id == data.user_id, 
        TipMenuSlot.slot_number == data.slot_number
    ).first()
    
    if slot:
        slot.title = data.title
        slot.price_alpha = data.price_alpha
    else:
        slot = TipMenuSlot(
            creator_id=data.user_id,
            slot_number=data.slot_number,
            title=data.title,
            price_alpha=data.price_alpha
        )
        db.add(slot)
    
    db.commit()
    return {"status": "success", "message": f"Espacio {data.slot_number} actualizado correctamente."}

@router.get("/discount-status/{user_id}")
def get_user_discount_status(user_id: int, db: Session = Depends(get_db)):
    """Verifica si el usuario cuenta con un 10% de descuento disponible por referido en su primera compra."""
    user = db.query(User).filter(User.user_id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado.")
    return {
        "status": "success",
        "has_discount": getattr(user, 'has_referral_discount', False)
    }

@router.post("/subscribe-tier")
def subscribe_creator_tier(data: SubscribeTierSchema, db: Session = Depends(get_db)):
    """Procesa la suscripción a membresías B2B aplicando automáticamente el 10% de descuento por referido."""
    user = db.query(User).filter(User.user_id == data.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado.")
    
    tier_prices = {
        "soldier_creator": 4.99,
        "icon_creator": 7.99
    }
    
    if data.tier_slug not in tier_prices:
        raise HTTPException(status_code=400, detail="Nivel de creador inválido.")
        
    base_price = tier_prices[data.tier_slug]
    has_discount = getattr(user, 'has_referral_discount', False)
    
    # Aplicar 10% de descuento si proviene de enlace de referido en su primera compra
    final_price = round(base_price * 0.9, 2) if has_discount else base_price
    
    if user.role == "fan":
        user.role = "creator"
        user.access_level = 1 if data.tier_slug == "soldier_creator" else 2
        
    if has_discount:
        user.has_referral_discount = False # El descuento de primera vez se consume
        
    db.commit()
    
    return {
        "status": "success",
        "message": f"Suscripción a {data.tier_slug} procesada con éxito.",
        "original_price": base_price,
        "final_price": final_price,
        "discount_applied": has_discount
    }