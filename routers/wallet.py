import json
from typing import Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database.db import get_db
from database.models import (
    Wallet,
    User,
    Transaction,
    ChatMessage,
    PayoutRequest as DBPayoutRequest
)
from routers.chat import manager, global_manager

router = APIRouter(prefix="/wallet", tags=["Wallet & Alfa Coins"])

class TipRequest(BaseModel):
    sender_id: int
    receiver_id: int
    amount: Optional[int] = None
    amount_alpha: Optional[int] = None
    post_id: Optional[int] = None
    message: Optional[str] = None

class TonConnectRequest(BaseModel):
    user_id: int
    ton_address: str

class RechargeRequest(BaseModel):
    user_id: int
    amount_ton: float
    alpha_added: int
    boc: str

class PayoutCreateRequest(BaseModel):
    user_id: int
    amount_alpha: int
    payout_method: str  # Ej: "dolarapp_ach", "skrill", "ton", "binance"
    account_details: Optional[str] = None
    destination_account: Optional[str] = None

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
    """Devuelve el balance consolidado y las transacciones recientes para alimentar el Centro de Ajustes."""
    wallet = db.query(Wallet).filter(Wallet.user_id == user_id).first()
    if not wallet:
        wallet = Wallet(user_id=user_id, alpha_balance=0, total_earned=0, total_spent=0)
        db.add(wallet)
        db.commit()
        db.refresh(wallet)

    txs = db.query(Transaction).filter(
        (Transaction.sender_id == user_id) | (Transaction.receiver_id == user_id)
    ).order_by(Transaction.created_at.desc()).limit(25).all()

    transactions_data = []
    for t in txs:
        is_outgoing = (t.sender_id == user_id and t.receiver_id != user_id)
        effective_amount = -abs(t.amount) if is_outgoing else abs(t.amount)
        transactions_data.append({
            "id": t.id,
            "tx_type": t.tx_type,
            "amount": effective_amount,
            "created_at": t.created_at.isoformat() if t.created_at else datetime.utcnow().isoformat()
        })

    return {
        "status": "success",
        "alpha_balance": wallet.alpha_balance,
        "balance_alfa_coins": wallet.alpha_balance,
        "total_earned": wallet.total_earned or 0,
        "total_spent": wallet.total_spent or 0,
        "transactions": transactions_data
    }

@router.get("/history/{user_id}")
def get_wallet_history(user_id: int, limit: int = 50, db: Session = Depends(get_db)):
    """Historial completo de movimientos de AlphaCoins."""
    txs = db.query(Transaction).filter(
        (Transaction.sender_id == user_id) | (Transaction.receiver_id == user_id)
    ).order_by(Transaction.created_at.desc()).limit(limit).all()

    history = []
    for t in txs:
        is_outgoing = (t.sender_id == user_id and t.receiver_id != user_id)
        effective_amount = -abs(t.amount) if is_outgoing else abs(t.amount)
        history.append({
            "id": t.id,
            "tx_type": t.tx_type,
            "amount": effective_amount,
            "room_id": t.room_id,
            "reference_id": t.reference_id,
            "created_at": t.created_at.isoformat() if t.created_at else datetime.utcnow().isoformat()
        })

    return {"status": "success", "transactions": history}

@router.post("/transfer")
@router.post("/send-tip")
async def send_tip_or_transfer(data: TipRequest, db: Session = Depends(get_db)):
    """Procesa propinas directas desde el muro, perfiles o DMs con split 85/15."""
    amount = data.amount_alpha if data.amount_alpha is not None else data.amount
    if not amount or amount <= 0:
        raise HTTPException(status_code=400, detail="El monto de la propina debe ser mayor a 0 $ALPHA.")

    if data.sender_id == data.receiver_id:
        raise HTTPException(status_code=400, detail="No puedes enviarte propinas a ti mismo.")

    sender = db.query(User).filter(User.user_id == data.sender_id).first()
    receiver = db.query(User).filter(User.user_id == data.receiver_id).first()
    
    if not sender or not receiver:
        raise HTTPException(status_code=404, detail="Usuario emisor o receptor no encontrado.")

    sender_wallet = db.query(Wallet).filter(Wallet.user_id == data.sender_id).first()
    if not sender_wallet or sender_wallet.alpha_balance < amount:
        raise HTTPException(status_code=400, detail="Saldo insuficiente de $ALPHA Coins.")

    receiver_wallet = db.query(Wallet).filter(Wallet.user_id == data.receiver_id).first()
    if not receiver_wallet:
        receiver_wallet = Wallet(user_id=data.receiver_id, alpha_balance=0, total_earned=0, total_spent=0)
        db.add(receiver_wallet)

    platform_fee = int(amount * 0.15)
    creator_earnings = amount - platform_fee

    sender_wallet.alpha_balance -= amount
    sender_wallet.total_spent = (sender_wallet.total_spent or 0) + amount

    receiver_wallet.alpha_balance += creator_earnings
    receiver_wallet.total_earned = (receiver_wallet.total_earned or 0) + creator_earnings

    tx_creator = Transaction(
        sender_id=data.sender_id,
        receiver_id=data.receiver_id,
        amount=creator_earnings,
        tx_type="tip_earnings",
        reference_id=data.post_id
    )
    tx_platform = Transaction(
        sender_id=data.sender_id,
        receiver_id=None,
        amount=platform_fee,
        tx_type="platform_fee",
        reference_id=data.post_id
    )
    db.add(tx_creator)
    db.add(tx_platform)

    custom_note = f" \"{data.message}\"" if data.message else ""
    alert_msg = f"🪙 ¡@{sender.name} envió una propina de {amount} $ALPHA a @{receiver.name}!{custom_note} 💎"

    new_system_msg = ChatMessage(
        user_id=8269470905,
        author_name="Búnker System",
        author_role="admin",
        access_level=5,
        content=json.dumps({"text": alert_msg, "media_url": None}),
        is_system=True
    )
    db.add(new_system_msg)
    db.commit()
    db.refresh(new_system_msg)

    msg_payload = {
        "type": "new_msg",
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
    await global_manager.broadcast(msg_payload)

    return {
        "status": "success",
        "message": "Propina enviada con éxito.",
        "amount_sent": amount,
        "creator_received": creator_earnings,
        "platform_fee": platform_fee
    }

@router.post("/request-payout")
def request_payout(data: PayoutCreateRequest, db: Session = Depends(get_db)):
    """Registra una orden de retiro para creadores hacia pasarelas o cuentas bancarias."""
    if data.amount_alpha <= 0:
        raise HTTPException(status_code=400, detail="El monto a retirar debe ser mayor a 0 $ALPHA.")

    user = db.query(User).filter(User.user_id == data.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado.")

    is_admin = (user.role == "admin" or user.user_id in [8269470905, 123456789])
    if not is_admin and user.role == "creator" and user.kyc_status != "verified":
        raise HTTPException(status_code=403, detail="Los creadores requieren verificación KYC (+18) aprobada para retirar fondos.")

    wallet = db.query(Wallet).filter(Wallet.user_id == data.user_id).first()
    if not wallet or wallet.alpha_balance < data.amount_alpha:
        raise HTTPException(status_code=400, detail="Saldo insuficiente de $ALPHA Coins para procesar el retiro.")

    wallet.alpha_balance -= data.amount_alpha

    destination = (data.destination_account or data.account_details or "Cuenta registrada").strip()
    amount_usd = round(data.amount_alpha * 0.05, 2)  # Conversión base: 20 $ALPHA = $1 USD

    payout_record = DBPayoutRequest(
        user_id=data.user_id,
        amount_alpha=data.amount_alpha,
        amount_usd=amount_usd,
        payout_method=data.payout_method.lower(),
        destination_account=destination,
        status="pending"
    )
    db.add(payout_record)

    tx = Transaction(
        sender_id=data.user_id,
        receiver_id=None,
        amount=data.amount_alpha,
        tx_type=f"payout_request_{data.payout_method.lower()}",
        reference_id=None
    )
    db.add(tx)
    db.commit()

    return {
        "status": "success",
        "payout_id": payout_record.id,
        "amount_alpha": data.amount_alpha,
        "amount_usd": amount_usd,
        "message": f"Solicitud de retiro de {data.amount_alpha} $ALPHA (~${amount_usd} USD) registrada exitosamente vía {data.payout_method.upper()}."
    }

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