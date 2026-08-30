from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import or_
from database.db import get_db
from database.models import Wallet, Transaction
from database.wallet_logic import process_tip_transaction

router = APIRouter(
    prefix="/wallet",
    tags=["Wallet & Alfa Coins"]
)

class TipRequest(BaseModel):
    sender_id: str
    creator_id: str
    amount: Decimal
    gateway: str  # 'Binance', 'TON', 'Global66', etc.
    tx_id: str

@router.get("/balance/{user_id}")
def get_user_balance(user_id: str, db: Session = Depends(get_db)):
    wallet = db.query(Wallet).filter(Wallet.user_id == str(user_id)).first()
    if not wallet:
        return {"user_id": user_id, "balance_alfa_coins": 0.0000}
    return {
        "user_id": user_id,
        "balance_alfa_coins": float(wallet.balance_alfa_coins)
    }

@router.get("/history/{user_id}")
def get_wallet_history(user_id: str, db: Session = Depends(get_db)):
    txs = db.query(Transaction).filter(
        or_(Transaction.sender_id == str(user_id), Transaction.receiver_id == str(user_id))
    ).order_by(Transaction.timestamp.desc()).all()
    
    history = [{
        "id": tx.id,
        "sender_id": tx.sender_id,
        "receiver_id": tx.receiver_id,
        "amount": float(tx.alfa_coins),
        "gateway": tx.gateway,
        "status": tx.status,
        "timestamp": str(tx.timestamp)
    } for tx in txs]
    
    return {"user_id": user_id, "transactions": history}

@router.post("/send-tip")
def send_tip(data: TipRequest, db: Session = Depends(get_db)):
    try:
        result = process_tip_transaction(
            db=db,
            sender_id=data.sender_id,
            creator_id=data.creator_id,
            amount=data.amount,
            gateway=data.gateway,
            tx_id=data.tx_id
        )
        return {"message": "Propina procesada con éxito y split 90/10 aplicado.", "details": result}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail="Error interno al procesar la transacción.")