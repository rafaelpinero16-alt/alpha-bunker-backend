from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from database.db import get_db
from database.models import TipMenuSlot, User

router = APIRouter(prefix="/creators", tags=["Tip Menu"])

class TipMenuSlotSchema(BaseModel):
    user_id: int
    slot_number: int  # Del 1 al 10
    title: str
    price_alpha: int

@router.get("/{creator_id}/tip-menu")
def get_creator_tip_menu(creator_id: int, db: Session = Depends(get_db)):
    """Obtiene los 10 espacios del Tip Menu del creador."""
    slots = db.query(TipMenuSlot).filter(TipMenuSlot.creator_id == creator_id).all()
    return {"status": "success", "slots": slots}

@router.post("/tip-menu/update")
def update_tip_menu_slot(data: TipMenuSlotSchema, db: Session = Depends(get_db)):
    """Crea o actualiza uno de los 10 espacios del Tip Menu (Requiere ser creador verificado)."""
    if not (1 <= data.slot_number <= 10):
        raise HTTPException(status_code=400, detail="El espacio debe ser un número entre 1 y 10.")
    
    # Verificar que el usuario sea creador
    creator = db.query(User).filter(User.user_id == data.user_id, User.is_creator == True).first()
    if not creator:
        raise HTTPException(status_code=403, detail="Acceso denegado. Solo creadores verificados pueden editar su Tip Menu.")
    
    # Buscar si ya existe el slot
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