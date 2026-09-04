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

# 🛡️ Nuevo Modelo para Retiros de Creadores
class PayoutRequest(BaseModel):
    user_id: int
    amount_alpha: int
    payout_method: str  # Ej: "nequi", "binance", "ton", "global66"
    account_details: str

@router.get("/payment-methods")
def get_platform_payment_methods():
    """Expone las cuentas bancarias oficiales del Búnker para fondeo internacional."""
    return {
        "status": "success",
        "methods": {
            "dolarapp_ach": {
                "bank_name": "Lead Bank",
                "account_name": "Felipe Rafael Sanchez",
                "account_number": "213994294422",
                "routing_number": "101019644",
                "account_type": "Corriente",
                "address": "Calle 43, 13-55, BUCARAMANGA, SANTANDER 680006, Colombia"
            },
            "global66_ach": {
                "bank_name": "Community Federal Savings Bank",
                "account_name": "Felipe Rafael Sanchez Piñeros",
                "account_number": "8338457346",
                "routing_number": "026073150",
                "account_type": "Checking",
                "address": "5 Penn Plaza, 14th Floor, New York, NY 10001, US"
            }
        }
    }

@router.get("/balance/{user_id}")
def get_wallet_balance(user_id: int, db: Session = Depends(get_db)):
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

        if data.sender_id == data.receiver_id:
            raise HTTPException(status_code=400, detail="No puedes enviarte propinas a ti mismo.")

        if data.amount <= 0:
            raise HTTPException(status_code=400, detail="El monto de la propina debe ser mayor a 0.")

        sender_wallet = db.query(Wallet).filter(Wallet.user_id == data.sender_id).first()
        receiver_wallet = db.query(Wallet).filter(Wallet.user_id == data.receiver_id).first()

        if not sender_wallet or sender_wallet.alpha_balance < data.amount:
            raise HTTPException(status_code=400, detail="Saldo insuficiente para enviar la propina.")

        # 🛡️ Lógica de Split 85/15 (Actualizada)
        platform_fee = int(data.amount * 0.15)
        creator_earnings = data.amount - platform_fee

        sender_wallet.alpha_balance -= data.amount
        sender_wallet.total_spent += data.amount
        
        if not receiver_wallet:
            receiver_wallet = Wallet(user_id=data.receiver_id, alpha_balance=0, total_earned=0, total_spent=0)
            db.add(receiver_wallet)
            
        receiver_wallet.alpha_balance += creator_earnings
        receiver_wallet.total_earned += creator_earnings

        # Registro del pago al creador (85%)
        tx_creator = Transaction(
            sender_id=data.sender_id,
            receiver_id=data.receiver_id,
            amount=creator_earnings,
            tx_type="tip_earnings",
            reference_id=data.post_id
        )
        
        # Registro de la comisión de la plataforma (15%)
        tx_platform = Transaction(
            sender_id=data.sender_id,
            receiver_id=None, 
            amount=platform_fee,
            tx_type="platform_fee",
            reference_id=data.post_id
        )
        
        db.add(tx_creator)
        db.add(tx_platform)

        alert_msg = f"¡{sender.name} ha enviado una propina a @{receiver.name}! 🪙💎"
        
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

        return {
            "status": "success", 
            "message": "Propina procesada.", 
            "amount_sent": data.amount,
            "creator_received": creator_earnings,
            "platform_fee": platform_fee
        }
        
    except HTTPException as http_exc:
        raise http_exc
    except Exception as e:
        db.rollback()
        print(f"[TIP ROUTE ERROR]: {e}")
        raise HTTPException(status_code=500, detail="Error crítico al procesar la propina.")

@router.post("/request-payout")
def request_payout(data: PayoutRequest, db: Session = Depends(get_db)):
    """Congela los fondos del creador y emite una orden de retiro hacia su método externo (Regla 90 Días)."""
    try:
        wallet = db.query(Wallet).filter(Wallet.user_id == data.user_id).first()
        
        if not wallet or wallet.alpha_balance < data.amount_alpha:
            raise HTTPException(status_code=400, detail="Saldo insuficiente para procesar el retiro.")

        # Descontamos los $ALPHA de su saldo disponible
        wallet.alpha_balance -= data.amount_alpha

        # Registramos la orden en la base de datos
        tx = Transaction(
            sender_id=data.user_id,
            receiver_id=None, 
            amount=data.amount_alpha,
            tx_type=f"payout_request_{data.payout_method}",
            reference_id=None
        )
        db.add(tx)
        db.commit()

        return {
            "status": "success", 
            "message": f"Solicitud de retiro de {data.amount_alpha} $ALPHA registrada exitosamente vía {data.payout_method.upper()}. Recuerda que los fondos están sujetos al período de liquidación de 90 días por seguridad."
        }
        
    except HTTPException as http_exc:
        raise http_exc
    except Exception as e:
        db.rollback()
        print(f"[PAYOUT ERROR]: {e}")
        raise HTTPException(status_code=500, detail="Falla interna al procesar el retiro.")

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
    if data.amount_ton <= 0 or data.alpha_added <= 0:
        raise HTTPException(status_code=400, detail="Montos de recarga inválidos.")
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