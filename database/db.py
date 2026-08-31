def update_user_tier(user_id: int, tier: str, amount: int):
    from database.db import SessionLocal
    from database.models import User, Wallet, Transaction
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.user_id == user_id).first()
        if not user:
            user = User(user_id=user_id, name="User", access_level=1)
            db.add(user)
            db.commit()
        
        tier_levels = {"starter": 1, "agent": 2, "combat": 3, "boss": 4, "whale": 5}
        level = tier_levels.get(tier.lower(), 1)
        if user.access_level < level:
            user.access_level = level
        
        wallet = db.query(Wallet).filter(Wallet.user_id == user_id).first()
        if not wallet:
            wallet = Wallet(user_id=user_id, alpha_balance=0)
            db.add(wallet)
        
        tx = Transaction(receiver_id=user_id, amount=amount, tx_type=f"purchase_{tier}")
        db.add(tx)
        db.commit()
        return True
    except Exception as e:
        db.rollback()
        print(f"Error updating user tier: {e}")
        return False
    finally:
        db.close()