from sqlalchemy.orm import Session
from fastapi import HTTPException
from database.models import Wallet, Transaction

def process_tip_transaction(sender_id: int, receiver_id: int, amount: int, post_id: int = None, db: Session = None):
    if amount <= 0:
        raise HTTPException(status_code=400, detail="El monto de la propina debe ser mayor a 0.")

    # Verificar billetera del emisor
    sender_wallet = db.query(Wallet).filter(Wallet.user_id == sender_id).first()
    if not sender_wallet or sender_wallet.alpha_balance < amount:
        raise HTTPException(status_code=400, detail="Saldo insuficiente de tokens $ALPHA.")

    # Verificar o crear billetera del receptor
    receiver_wallet = db.query(Wallet).filter(Wallet.user_id == receiver_id).first()
    if not receiver_wallet:
        receiver_wallet = Wallet(user_id=receiver_id, alpha_balance=0, total_earned=0, total_spent=0)
        db.add(receiver_wallet)
        db.flush()

    # Split: 90% creador, 10% ecosistema
    creator_share = int(amount * 0.90)

    # Actualizar balances
    sender_wallet.alpha_balance -= amount
    sender_wallet.total_spent += amount

    receiver_wallet.alpha_balance += creator_share
    receiver_wallet.total_earned += creator_share

    # Registrar en historial de transacciones
    new_tx = Transaction(
        sender_id=sender_id,
        receiver_id=receiver_id,
        amount=amount,
        tx_type="tip",
        reference_id=post_id
    )
    db.add(new_tx)
    db.commit()
    db.refresh(new_tx)

    return {
        "status": "success",
        "tx_id": new_tx.id,
        "sender_id": sender_id,
        "receiver_id": receiver_id,
        "amount_sent": amount,
        "creator_received": creator_share,
        "platform_fee": amount - creator_share
    }