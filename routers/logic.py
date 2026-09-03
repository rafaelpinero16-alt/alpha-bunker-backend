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

# 🛡️ Asignación de Alpha Coins por paquete (según catálogo oficial del frontend)
ALPHA_REWARDS = {
    "soldier": 150,
    "starter": 150,
    "veteran": 330,
    "advanced": 330,
    "legend": 650,
    "elite": 650,
    "icon-legend": 1500,
    "lifetime": 1500
}

async def update_user_tier(user_id: str | int, tier: str, amount: int):
    """
    Sube el rango del usuario en la base de datos automáticamente,
    acredita los $ALPHA correspondientes, registra la transacción 
    y le envía un enlace de invitación único en Telegram.
    """
    db: Session = SessionLocal()
    try:
        # 🛡️ Cast estricto a entero para evitar desajustes en la query de la base de datos
        safe_user_id = int(user_id)
        user = db.query(User).filter(User.user_id == safe_user_id).first()
        
        if not user:
            # Si el usuario pagó pero no estaba registrado previamente, lo creamos
            user = User(user_id=safe_user_id, name=f"VIP_{safe_user_id}", role="fan", access_level=0)
            db.add(user)
            db.commit() # Asegurar la creación antes de modificar los atributos
            db.refresh(user)
        
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
        alpha_bonus = ALPHA_REWARDS.get(clean_tier, 0)
        
        # 🛡️ Solo lo actualizamos si el nivel comprado es superior o igual al actual
        if user.access_level < new_level:
            user.access_level = new_level
            
        # 🛡️ Otorgar permisos de Creador B2B si el nivel es Legend o Icon Legend
        if new_level >= 3:
            user.role = "creator"
            
        # 🛡️ Acreditar los $ALPHA correspondientes al paquete en la base de datos
        # Implementación segura verificando el atributo exacto de tu modelo
        if hasattr(user, 'alpha_balance'):
            user.alpha_balance = (user.alpha_balance or 0) + alpha_bonus
        elif hasattr(user, 'balance_alfa_coins'):
            user.balance_alfa_coins = (user.balance_alfa_coins or 0) + alpha_bonus

        # Registramos el pago en el historial de transacciones
        tx = Transaction(
            sender_id=safe_user_id,
            receiver_id=safe_user_id,
            amount=amount,
            tx_type="stars_subscription",
        )
        db.add(tx)
        
        db.commit()
        print(f"⚡ [DB SYNC] Usuario {safe_user_id} actualizado al nivel {new_level} (Tier: {clean_tier}). +{alpha_bonus} $ALPHA añadidos.")

        # 🚀 Generación automática de enlace VIP único en Telegram
        target_chat_id = TIER_CHATS.get(clean_tier)
        if target_chat_id and target_chat_id != "-100XXXXXXXXXX":
            try:
                invite_link = await bot.create_chat_invite_link(
                    chat_id=target_chat_id,
                    member_limit=1,
                    name=f"Acceso VIP {clean_tier.upper()} - {safe_user_id}"
                )

                await bot.send_message(
                    chat_id=safe_user_id,
                    text=(
                        f"🎉 **¡PAGO CON TELEGRAM STARS EXITOSO!** 💎\n\n"
                        f"Tu rango en el Búnker ha subido oficialmente a: **{clean_tier.upper()}** 🚀\n"
                        f"💰 Se han acreditado **{alpha_bonus} $ALPHA** a tu billetera.\n\n"
                        f"🎟️ Aquí tienes tu enlace de acceso exclusivo y seguro al canal privado:\n"
                        f"{invite_link.invite_link}\n\n"
                        f"¡Bienvenido al siguiente nivel, agente! 🛡️"
                    ),
                    parse_mode="Markdown"
                )
                print(f"✅ [TELEGRAM] Enlace VIP enviado con éxito al usuario {safe_user_id} para el tier {clean_tier}")
            except Exception as tg_err:
                print(f"⚠️ [TELEGRAM INVITATION ERROR] No se pudo enviar el mensaje al usuario {safe_user_id}: {tg_err}")
        else:
            print(f"ℹ️ [INFO] Rango '{clean_tier}' procesado en BD, pero falta configurar el Chat ID en variables de entorno.")

    except Exception as e:
        db.rollback()
        print(f"[❌ LOGIC ERROR] Falla crítica al actualizar el tier: {e}")
    finally:
        db.close()