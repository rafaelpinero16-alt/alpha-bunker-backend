from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from database.wallet_logic import process_tip_transaction
from database.db import get_db
# Importa tu modelo de Wallet si ya lo tienes definido en tu base de datos:
# from database.models import Wallet

router = APIRouter(prefix="/wallet", tags=["Wallet & Alfa Coins"])

class TipRequest(BaseModel):
    sender_id: str
    creator_id: str
    amount: Decimal
    gateway: str  # 'Binance', 'TON', 'Global66', 'Skrill', 'AirTM'
    tx_id: str

class TonConnectRequest(BaseModel):
    user_id: int
    ton_address: str

class RechargeRequest(BaseModel):
    user_id: int
    amount_ton: float
    alpha_added: int
    boc: str

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

@router.post("/connect-ton")
def connect_ton_wallet(data: TonConnectRequest, db: Session = Depends(get_db)):
    try:
        # Lógica de base de datos para vincular la wallet TON al usuario
        # wallet = db.query(Wallet).filter(Wallet.user_id == data.user_id).first()
        # if not wallet:
        #     wallet = Wallet(user_id=data.user_id, alpha_balance=0)
        #     db.add(wallet)
        # wallet.ton_address = data.ton_address
        # db.commit()
        
        return {
            "status": "success", 
            "message": "Billetera TON vinculada correctamente", 
            "address": data.ton_address
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail="Error al vincular la billetera TON.")

@router.post("/recharge")
def recharge_wallet(data: RechargeRequest, db: Session = Depends(get_db)):
    try:
        # Lógica de base de datos para sumar los $ALPHA coins al balance
        # wallet = db.query(Wallet).filter(Wallet.user_id == data.user_id).first()
        # if not wallet:
        #     wallet = Wallet(user_id=data.user_id, alpha_balance=0)
        #     db.add(wallet)
        # wallet.alpha_balance += data.alpha_added
        # db.commit()
        # db.refresh(wallet)
        
        return {
            "status": "success", 
            "message": f"Recarga de {data.alpha_added} $ALPHA acreditada con éxito",
            "alpha_added": data.alpha_added,
            "ton_spent": data.amount_ton
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail="Error al procesar la recarga de $ALPHA.")