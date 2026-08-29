import uuid
from decimal import Decimal
from sqlalchemy.orm import Session
from database.models import Transaction, Wallet, User

def process_tip_transaction(db: Session, sender_id: str, creator_id: str, amount: Decimal, gateway: str, tx_id: str):
    # 1. Verificar prevención de doble gasto (TxID)
    existing_tx = db.query(Transaction).filter(Transaction.tx_id == tx_id).first()
    if existing_tx:
        raise ValueError("El ID de transacción (TxID) ya ha sido utilizado.")

    # 2. Calcular el reparto 90% para el creador y 10% para la plataforma
    creator_share = amount * Decimal('0.90')
    platform_share = amount * Decimal('0.10')

    # 3. Auto-crear al Fan (Remitente) si no existe
    sender_user = db.query(User).filter(User.id == sender_id).first()
    if not sender_user:
        sender_user = User(id=sender_id, email=f"{sender_id}@bunker.test", password_hash="0000", role="Fan")
        db.add(sender_user)
        db.commit()

    # 4. Buscar o Auto-crear la Wallet del Creador
    creator_wallet = db.query(Wallet).filter(Wallet.user_id == creator_id).first()
    if not creator_wallet:
        user = db.query(User).filter(User.id == creator_id).first()
        if not user:
            user = User(id=creator_id, email=f"{creator_id}@bunker.test", password_hash="1234", role="Creator")
            db.add(user)
            db.commit()
        
        creator_wallet = Wallet(id=str(uuid.uuid4()), user_id=creator_id)
        db.add(creator_wallet)
        db.commit()

    # 5. Sumar el saldo al creador
    creator_wallet.balance_alfa_coins += creator_share

    # 6. Registrar la transacción oficial
    new_tx = Transaction(
        id=str(uuid.uuid4()),
        sender_id=sender_id,
        receiver_id=creator_id,
        alfa_coins=amount,
        gateway=gateway,
        tx_id=tx_id,
        status="Approved"
    )
    db.add(new_tx)
    db.commit()
    
    return {"status": "success", "creator_share": float(creator_share), "platform_share": float(platform_share)}