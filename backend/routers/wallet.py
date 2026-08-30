from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import Optional
from pydantic import BaseModel, Field
from datetime import datetime

from database.db import get_db
from database.models import User, Wallet, Transaction
from core.config import bot

router = APIRouter(prefix="/wallet", tags=["Wallet & Alfa Coins"])

class RechargeRequest(BaseModel):
    user_id: int
    amount_ton: float
    alpha_added: int
    boc: Optional[str] = "DIRECT_TX"

class TipPayload(BaseModel):
    sender_id: int
    creator_id: Optional[int] = None
    receiver_id: Optional[int] = None
    amount: int = Field(default=10, gt=0)
    post_id: Optional[int] = None

class ConnectTonRequest(BaseModel):
    user_id: int
    ton_address: str

# 1. BALANCE
@router.get("/balance/{user_id}")
def get_user_balance(user_id: int, db: Session = Depends(get_db)):
    try:
        wallet = db.query(Wallet).filter(Wallet.user_id == user_id).first()[cite: 7]
        if not wallet:
            wallet = Wallet(user_id=user_id, alpha_balance=0, total_earned=0, total_spent=0)[cite: 7]
            db.add(wallet)[cite: 7]
            db.commit()[cite: 7]
            db.refresh(wallet)[cite: 7]

        return {
            "user_id": str(wallet.user_id),
            "alpha_balance": wallet.alpha_balance,
            "balance_alfa_coins": wallet.alpha_balance,
            "total_earned": wallet.total_earned,
            "total_spent": wallet.total_spent
        }[cite: 7]
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error consultando balance: {str(e)}")

# 2. RECARGA DE SALDO
@router.post("/recharge")
def recharge_wallet(data: RechargeRequest, db: Session = Depends(get_db)):
    try:
        wallet = db.query(Wallet).filter(Wallet.user_id == data.user_id).first()
        if not wallet:
            wallet = Wallet(user_id=data.user_id, alpha_balance=0, total_earned=0, total_spent=0)
            db.add(wallet)
            db.flush()

        wallet.alpha_balance += data.alpha_added
        wallet.total_earned += data.alpha_added

        tx = Transaction(
            sender_id=data.user_id,
            receiver_id=data.user_id,
            amount=data.alpha_added,
            tx_type="ton_recharge",
            reference_id=None,
            created_at=datetime.utcnow()
        )
        db.add(tx)
        db.commit()
        db.refresh(wallet)

        return {
            "status": "success",
            "message": f"Acreditados +{data.alpha_added} $ALPHA correctamente",
            "new_balance": wallet.alpha_balance
        }
    except Exception as e:
        db.rollback()
        print(f"[RECHARGE DB ERROR]: {e}")
        raise HTTPException(status_code=500, detail=f"Error en base de datos: {str(e)}")

# 3. ENVÍO DE PROPINAS
@router.post("/send-tip")
async def send_tip(payload: TipPayload, db: Session = Depends(get_db)):
    target_creator_id = payload.receiver_id or payload.creator_id
    if not target_creator_id:
        raise HTTPException(status_code=400, detail="Falta el ID del creador receptor")

    if payload.sender_id == target_creator_id:
        raise HTTPException(status_code=400, detail="No puedes enviarte propinas a ti mismo")

    try:
        sender_wallet = db.query(Wallet).filter(Wallet.user_id == payload.sender_id).first()
        if not sender_wallet or sender_wallet.alpha_balance < payload.amount:
            raise HTTPException(status_code=400, detail="Saldo insuficiente de tokens $ALPHA")

        receiver_wallet = db.query(Wallet).filter(Wallet.user_id == target_creator_id).first()
        if not receiver_wallet:
            receiver_wallet = Wallet(user_id=target_creator_id, alpha_balance=0, total_earned=0, total_spent=0)
            db.add(receiver_wallet)
            db.flush()

        sender_wallet.alpha_balance -= payload.amount
        sender_wallet.total_spent += payload.amount

        receiver_wallet.alpha_balance += payload.amount
        receiver_wallet.total_earned += payload.amount

        tip_tx = Transaction(
            sender_id=payload.sender_id,
            receiver_id=target_creator_id,
            amount=payload.amount,
            tx_type="tip",
            reference_id=payload.post_id,
            created_at=datetime.utcnow()
        )
        db.add(tip_tx)
        db.commit()
        db.refresh(sender_wallet)
        db.refresh(receiver_wallet)

        # Alerta por Telegram
        sender_user = db.query(User).filter(User.user_id == payload.sender_id).first()
        sender_name = sender_user.name if sender_user else f"Usuario #{payload.sender_id}"

        try:
            await bot.send_message(
                chat_id=target_creator_id,
                text=(
                    f"🪙 *¡HAS RECIBIDO UNA PROPINA!*\n\n"
                    f"👤 *De:* {sender_name}\n"
                    f"💰 *Monto:* +{payload.amount} $ALPHA\n"
                    f"💎 *Nuevo Balance:* {receiver_wallet.alpha_balance} $ALPHA\n\n"
                    f"¡Tu contenido en el Búnker sigue generando valor! 🚀"
                ),
                parse_mode="Markdown"
            )
        except Exception:
            pass

        return {
            "status": "success",
            "message": f"Propina de {payload.amount} $ALPHA transferida con éxito",
            "amount_sent": payload.amount,
            "new_sender_balance": sender_wallet.alpha_balance,
            "new_receiver_balance": receiver_wallet.alpha_balance
        }
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error al procesar propina: {str(e)}")

# 4. CONECTAR TON
@router.post("/connect-ton")
def connect_ton(data: ConnectTonRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.user_id == data.user_id).first()
    if user:
        user.bio = f"TON: {data.ton_address}"
        db.commit()
    return {"status": "success", "ton_address": data.ton_address}