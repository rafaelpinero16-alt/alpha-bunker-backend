from sqlalchemy.orm import Session
from database.db import SessionLocal
from database.models import User, Transaction

def update_user_tier(user_id: int, tier: str, amount: int):
    """
    Sube el rango del usuario en la base de datos automáticamente
    después de un pago exitoso con Telegram Stars.
    """
    # Abrimos una sesión local porque esta función es llamada por el bot de Telegram
    db: Session = SessionLocal()
    try:
        user = db.query(User).filter(User.user_id == user_id).first()
        
        if not user:
            # Si el usuario pagó pero no estaba en la DB, lo creamos
            user = User(user_id=user_id, name=f"VIP_{user_id}", role="fan")
            db.add(user)
        
        # Mapeo de slugs de paquetes a niveles de acceso del Búnker
        # Ajusta estos nombres según los slugs que hayas configurado en tu tabla Packages
        tier_map = {
            "starter": 1,        # Soldier
            "advanced": 2,       # Veteran
            "elite": 3,          # Legend
            "lifetime": 4,       # Icon Legend
        }
        
        new_level = tier_map.get(tier.lower(), 1)
        
        # Solo lo actualizamos si el nivel comprado es superior al que ya tiene
        if user.access_level < new_level:
            user.access_level = new_level
            
        # Registramos el pago en el historial de transacciones
        tx = Transaction(
            sender_id=user_id,
            receiver_id=user_id,
            amount=amount,
            tx_type="stars_subscription",
        )
        db.add(tx)
        
        db.commit()
    except Exception as e:
        db.rollback()
        print(f"[LOGIC ERROR] Falla al actualizar el tier: {e}")
    finally:
        db.close()