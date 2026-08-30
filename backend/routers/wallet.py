from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import Optional
from pydantic import BaseModel, Field
from datetime import datetime

from database.db import get_db
from database.models import User, Wallet, Transaction
from core.config import bot

router = APIRouter(prefix="/wallet", tags=["Wallet & Alfa Coins"])

# ==========================================
# ESQUEMAS DE VALIDACIÓN (PYDANTIC)
# ==========================================
class DepositPayload(BaseModel):
    user_id: int
    amount: int = Field(..., gt=0, description="Monto en tokens $ALPHA a recargar")

class TipPayload(BaseModel):
    sender_id: int
    creator_id: Optional[int] = None
    receiver_id: Optional[int] = None
    amount: int = Field(default=10, gt=0, description="Monto en tokens $ALPHA")
    post_id: Optional[int] = None

class RechargeRequest(BaseModel):
    user_id: int
    amount_ton: float
    alpha_added: int
    boc: Optional[str] = "DIRECT_TX"

class ConnectTonRequest(BaseModel):
    user_id: int
    ton_address: str

# ==========================================
# 1. CONSULTAR BALANCE DE USUARIO
# ==========================================
@router.get("/balance/{user_id}")
def get_user_balance(user_id: int, db: Session = Depends(get_db)):
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

# ==========================================
# 2. ENVIAR PROPINA (CON TRANSFERENCIA Y ALERTA TELEGRAM)
# ==========================================
@router.post("/send-tip")
async def send_tip(payload: TipPayload, db: Session = Depends(get_db)):
    target_creator_id = payload.receiver_id or payload.creator_id
    if not target_creator_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Debes especificar el ID del creador receptor (receiver_id o creator_id)"
        )

    if payload.sender_id == target_creator_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No puedes enviarte propinas a ti mismo"
        )

    sender_wallet = db.query(Wallet).filter(Wallet.user_id == payload.sender_id).first()
    if not sender_wallet or sender_wallet.alpha_balance < payload.amount:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Saldo insuficiente de tokens $ALPHA para enviar la propina"
        )

    receiver_wallet = db.query(Wallet).filter(Wallet.user_id == target_creator_id).first()
    if not receiver_wallet:
        receiver_wallet = Wallet(user_id=target_creator_id, alpha_balance=0, total_earned=0, total_spent=0)
        db.add(receiver_wallet)
        db.flush()

    # Débito y abono contable
    sender_wallet.alpha_balance -= payload.amount
    sender_wallet.total_spent += payload.amount

    receiver_wallet.alpha_balance += payload.amount
    receiver_wallet.total_earned += payload.amount

    # Registro de transacción
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

    # Notificación directa al bot de Telegram
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

# ==========================================
# 3. RECARGA DE SALDO VÍA BLOCKCHAIN TON
# ==========================================
@router.post("/recharge")
def recharge_wallet(data: RechargeRequest, db: Session = Depends(get_db)):
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

# ==========================================
# 4. DEPÓSITO DIRECTO DE PRUEBA / SISTEMA
# ==========================================
@router.post("/deposit")
def deposit_alfa_coins(payload: DepositPayload, db: Session = Depends(get_db)):
    wallet = db.query(Wallet).filter(Wallet.user_id == payload.user_id).first()[cite: 7]
    if not wallet:
        wallet = Wallet(user_id=payload.user_id, alpha_balance=0, total_earned=0, total_spent=0)[cite: 7]
        db.add(wallet)[cite: 7]
        db.flush()[cite: 7]

    wallet.alpha_balance += payload.amount[cite: 7]
    
    deposit_tx = Transaction(
        sender_id=None,
        receiver_id=payload.user_id,
        amount=payload.amount,
        tx_type="deposit",
        reference_id=None,
        created_at=datetime.utcnow()
    )[cite: 7]
    db.add(deposit_tx)[cite: 7]
    db.commit()[cite: 7]
    db.refresh(wallet)[cite: 7]

    return {
        "status": "success",
        "message": f"Se han acreditado {payload.amount} $ALPHA exitosamente.",
        "user_id": str(wallet.user_id),
        "new_balance": wallet.alpha_balance
    }[cite: 7]

# ==========================================
# 5. REGISTRAR WALLET TON DE USUARIO
# ==========================================
@router.post("/connect-ton")
def connect_ton(data: ConnectTonRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.user_id == data.user_id).first()
    if user:
        user.bio = f"TON: {data.ton_address}"
        db.commit()
    return {"status": "success", "ton_address": data.ton_address}