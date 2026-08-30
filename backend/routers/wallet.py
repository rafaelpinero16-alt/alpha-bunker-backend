from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import Optional
from pydantic import BaseModel, Field

from database.db import get_db
from database.models import Wallet, Transaction
from database.wallet_logic import process_tip_transaction

router = APIRouter(prefix="/wallet", tags=["Wallet & Alfa Coins"])

# Esquema para recarga / depósito de prueba
class DepositPayload(BaseModel):
    user_id: int
    amount: int = Field(..., gt=0, description="Monto en tokens $ALPHA a recargar")

# Esquema para envío de propinas
class TipPayload(BaseModel):
    sender_id: int
    creator_id: int
    amount: int = Field(..., gt=0, description="Monto en tokens $ALPHA")
    post_id: Optional[int] = None

@router.get("/balance/{user_id}")
def get_user_balance(user_id: int, db: Session = Depends(get_db)):
    wallet = db.query(Wallet).filter(Wallet.user_id == user_id).first()
    if not wallet:
        wallet = Wallet(user_id=user_id, alpha_balance=0, total_earned=0, total_spent=0)
        db.add(wallet)
        db.commit()
        db.refresh(wallet)
    return {
        "user_id": str(wallet.user_id),
        "balance_alfa_coins": wallet.alpha_balance,
        "total_earned": wallet.total_earned,
        "total_spent": wallet.total_spent
    }

@router.post("/deposit")
def deposit_alfa_coins(payload: DepositPayload, db: Session = Depends(get_db)):
    wallet = db.query(Wallet).filter(Wallet.user_id == payload.user_id).first()
    if not wallet:
        wallet = Wallet(user_id=payload.user_id, alpha_balance=0, total_earned=0, total_spent=0)
        db.add(wallet)
        db.flush()

    wallet.alpha_balance += payload.amount
    
    # Registro de la transacción de recarga
    deposit_tx = Transaction(
        sender_id=None,
        receiver_id=payload.user_id,
        amount=payload.amount,
        tx_type="deposit",
        reference_id=None
    )
    db.add(deposit_tx)
    db.commit()
    db.refresh(wallet)

    return {
        "status": "success",
        "message": f"Se han acreditado {payload.amount} $ALPHA exitosamente.",
        "user_id": str(wallet.user_id),
        "new_balance": wallet.alpha_balance
    }

@router.post("/send-tip")
def send_tip(payload: TipPayload, db: Session = Depends(get_db)):
    try:
        result = process_tip_transaction(
            sender_id=payload.sender_id,
            receiver_id=payload.creator_id,
            amount=payload.amount,
            post_id=payload.post_id,
            db=db
        )
        return result
    except HTTPException as http_exc:
        raise http_exc
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al procesar la propina: {str(e)}"
        )