from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from database.wallet_logic import process_tip_transaction
from database.db import get_db  # <-- ¡Esta era la importación que faltaba!

router = APIRouter(prefix="/wallet", tags=["Wallet & Alfa Coins"])

class TipRequest(BaseModel):
    sender_id: str
    creator_id: str
    amount: Decimal
    gateway: str  # 'Binance', 'TON', 'Global66', 'Skrill', 'AirTM'
    tx_id: str

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