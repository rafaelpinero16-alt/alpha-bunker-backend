import os
from sqlalchemy.orm import Session
from core.config import bot
from database.db import SessionLocal
from database.models import User, Transaction

# Mapeo oficial de los IDs de los canales o grupos VIP del Búnker en Telegram
TIER_CHATS = {
    "soldier": os.getenv("CHANNEL_SOLDIER_ID", "-100XXXXXXXXXX"),
    "veteran": os.getenv("CHANNEL_VETERAN_ID", "-100XXXXXXXXXX"),
    "legend": os.getenv("CHANNEL_LEGEND_ID", "-100XXXXXXXXXX"),
    "icon-legend": os.getenv("CHANNEL_ICON_LEGEND_ID", "-100XXXXXXXXXX")
}

async def update_user_tier(user_id: int, tier: str, amount: int):
    """
    Sube el rango del usuario en la base de datos automáticamente,
    registra la transacción y le envia un enlace de invitación único en Telegram.
    """
    db: Session = SessionLocal()
    try:
        user = db.query(User).filter(User.user_id == user_id).first()
        
        if not user:
            # Si el usuario pagó pero no estaba registrado, lo creamos
            user = User(user_id=user_id, name=f"VIP_{user_id}", role="fan")
            db.add(user)
        
        # Mapeo robusto de slugs (soporta nombres oficiales y alternativos)
        tier_map = {
            "soldier": 1,
            "starter": 1,
            "veteran": 2,
            "advanced": 2,
            "legend": 3,
            "elite": 3,
            "icon-legend": 4,
            "lifetime": 4
        }
        
        clean_tier = tier.lower().strip()
        new_level = tier_map.get(clean_tier, 1)
        
        # Solo lo actualizamos si el nivel comprado es superior al actual
        if user.access_level < new_level:
            user.access_level = new_level
            if new_level == 4:
                user.role = "creator"
                
        # Registramos el pago en el historial de transacciones
        tx = Transaction(
            sender_id=user_id,
            receiver_id=user_id,
            amount=amount,
            tx_type="stars_subscription",
        )
        db.add(tx)
        
        db.commit()
        print(f"⚡ [DB SYNC] Usuario {user_id} actualizado al nivel {new_level} (Tier: {clean_tier})")

        # 🚀 MEJORA: Generación automática de enlace VIP único en Telegram
        target_chat_id = TIER_CHATS.get(clean_tier)
        if target_chat_id and target_chat_id != "-100XXXXXXXXXX":
            try:
                invite_link = await bot.create_chat_invite_link(
                    chat_id=target_chat_id,
                    member_limit=1,
                    name=f"Acceso VIP {clean_tier.upper()} - {user_id}"
                )

                await bot.send_message(
                    chat_id=user_id,
                    text=(
                        f"🎉 **¡PAGO CON TELEGRAM STARS EXITOSO!** 💎\n\n"
                        f"Tu rango en el Búnker ha subido oficialmente a: **{clean_tier.upper()}** 🚀\n\n"
                        f"🎟️ Aquí tienes tu enlace de acceso exclusivo y seguro al canal privado:\n"
                        f"{invite_link.invite_link}\n\n"
                        f"¡Bienvenido al siguiente nivel, agente! 🛡️"
                    ),
                    parse_mode="Markdown"
                )
                print(f"✅ [TELEGRAM] Enlace VIP enviado con éxito al usuario {user_id} para el tier {clean_tier}")
            except Exception as tg_err:
                print(f"⚠️ [TELEGRAM INVITATION ERROR]: {tg_err}")
        else:
            print(f"ℹ️ [INFO] Rango '{clean_tier}' procesado en BD, pero falta configurar el Chat ID en variables de entorno.")

    except Exception as e:
        db.rollback()
        print(f"[LOGIC ERROR] Falla al actualizar el tier: {e}")
    finally:
        db.close()