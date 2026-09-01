from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from datetime import datetime
from database.db import get_db
from database.models import Wallet, User, Transaction, ChatMessage
from routers.chat import manager  # ⚡ Cerebro del WebSocket en vivo

router = APIRouter(prefix="/wallet", tags=["Wallet & Alfa Coins"])

class TipRequest(BaseModel):
    sender_id: int
    receiver_id: int
    amount: int
    post_id: int | None = None

class TonConnectRequest(BaseModel):
    user_id: int
    ton_address: str

class RechargeRequest(BaseModel):
    user_id: int
    amount_ton: float
    alpha_added: int
    boc: str

@router.get("/balance/{user_id}")
def get_wallet_balance(user_id: int, db: Session = Depends(get_db)):
    """Consulta el balance de la billetera. Si no existe, la autogenera para evitar el error 404."""
    wallet = db.query(Wallet).filter(Wallet.user_id == user_id).first()
    if not wallet:
        wallet = Wallet(user_id=user_id, alpha_balance=0, total_earned=0, total_spent=0)
        db.add(wallet)
        db.commit()
        db.refresh(wallet)
    return {
        "status": "success", 
        "alpha_balance": wallet.alpha_balance, 
        "balance_alfa_coins": wallet.alpha_balance
    }

@router.post("/send-tip")
async def send_tip(data: TipRequest, db: Session = Depends(get_db)):
    try:
        sender = db.query(User).filter(User.user_id == data.sender_id).first()
        receiver = db.query(User).filter(User.user_id == data.receiver_id).first()
        
        if not sender or not receiver:
            raise HTTPException(status_code=404, detail="Usuario no encontrado en la base de datos.")

        sender_wallet = db.query(Wallet).filter(Wallet.user_id == data.sender_id).first()
        receiver_wallet = db.query(Wallet).filter(Wallet.user_id == data.receiver_id).first()

        if not sender_wallet or sender_wallet.alpha_balance < data.amount:
            raise HTTPException(status_code=400, detail="Saldo insuficiente para enviar la propina.")

        sender_wallet.alpha_balance -= data.amount
        sender_wallet.total_spent += data.amount
        
        if not receiver_wallet:
            receiver_wallet = Wallet(user_id=data.receiver_id, alpha_balance=0, total_earned=0, total_spent=0)
            db.add(receiver_wallet)
            
        receiver_wallet.alpha_balance += data.amount
        receiver_wallet.total_earned += data.amount

        tx = Transaction(
            sender_id=data.sender_id,
            receiver_id=data.receiver_id,
            amount=data.amount,
            tx_type="tip",
            reference_id=data.post_id
        )
        db.add(tx)

        alert_msg = f"¡{sender.name} ha enviado una propina de {data.amount} $ALPHA a @{receiver.name}! 🪙💎"
        
        new_system_msg = ChatMessage(
            user_id=data.sender_id,
            author_name="Búnker System",
            author_role="admin",
            access_level=99,
            content=alert_msg,
            is_system=True
        )
        db.add(new_system_msg)
        db.commit()
        db.refresh(new_system_msg)

        msg_payload = {
            "id": new_system_msg.id,
            "user_id": new_system_msg.user_id,
            "author_name": new_system_msg.author_name,
            "author_role": new_system_msg.author_role,
            "access_level": new_system_msg.access_level,
            "content": new_system_msg.content,
            "is_system": new_system_msg.is_system,
            "created_at": new_system_msg.created_at.isoformat()
        }
        await manager.broadcast(msg_payload)

        return {"status": "success", "message": "Propina enviada y alerta disparada.", "amount_sent": data.amount}
        
    except HTTPException as http_exc:
        raise http_exc
    except Exception as e:
        db.rollback()
        print(f"[TIP ROUTE ERROR]: {e}")
        raise HTTPException(status_code=500, detail="Error crítico al procesar la propina.")

@router.post("/connect-ton")
def connect_ton_wallet(data: TonConnectRequest, db: Session = Depends(get_db)):
    try:
        wallet = db.query(Wallet).filter(Wallet.user_id == data.user_id).first()
        if not wallet:
            wallet = Wallet(user_id=data.user_id, alpha_balance=0, total_earned=0, total_spent=0)
            db.add(wallet)
        
        db.commit()
        return {"status": "success", "message": "Billetera TON vinculada correctamente", "address": data.ton_address}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail="Error al vincular la billetera TON.")

@router.post("/recharge")
def recharge_wallet(data: RechargeRequest, db: Session = Depends(get_db)):
    try:
        wallet = db.query(Wallet).filter(Wallet.user_id == data.user_id).first()
        if not wallet:
            wallet = Wallet(user_id=data.user_id, alpha_balance=0, total_earned=0, total_spent=0)
            db.add(wallet)
            
        wallet.alpha_balance += data.alpha_added
        
        tx = Transaction(
            sender_id=data.user_id,
            receiver_id=data.user_id,
            amount=data.alpha_added,
            tx_type="package_recharge",
        )
        db.add(tx)
        db.commit()
        
        return {
            "status": "success", 
            "message": f"Recarga de {data.alpha_added} $ALPHA acreditada con éxito",
            "alpha_added": data.alpha_added
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail="Error al procesar la recarga de $ALPHA.")