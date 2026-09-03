import os
from fastapi import APIRouter, Header, HTTPException, Request, Depends
from sqlalchemy.orm import Session
from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton

from core.config import bot
from database.db import get_db
from database.models import Wallet, Transaction, Package, User
from routers.logic import update_user_tier

router = APIRouter(prefix="/telegram", tags=["Telegram Webhook"])

# 🔒 Valores actualizados con los datos proporcionados
TELEGRAM_SECRET_TOKEN = os.getenv("TELEGRAM_SECRET_TOKEN", "AlphaBunker2026").strip()
MINI_APP_URL = os.getenv("MINI_APP_URL", "https://alpha-bunker-backend.vercel.app/").strip()

@router.post("/webhook")
async def telegram_webhook(
    request: Request,
    x_telegram_bot_api_secret_token: str = Header(None),
    db: Session = Depends(get_db)
):
    # 🔒 Falla cerrado: sin secreto configurado, no se aceptan webhooks.
    if not TELEGRAM_SECRET_TOKEN:
        raise HTTPException(status_code=500, detail="TELEGRAM_SECRET_TOKEN no está configurado en el servidor.")
    if x_telegram_bot_api_secret_token != TELEGRAM_SECRET_TOKEN:
        raise HTTPException(status_code=403, detail="Acceso denegado: Token secreto inválido.")
    
    try:
        body = await request.json()
    except Exception:
        return {"status": "error", "detail": "Invalid JSON"}

    # =====================================================================
    # 1. FASE DE AUTORIZACIÓN: Telegram Stars (pre_checkout_query)
    # =====================================================================
    if "pre_checkout_query" in body:
        pre_checkout_query = body["pre_checkout_query"]
        pre_checkout_id = pre_checkout_query["id"]
        
        try:
            # Confirmamos a Telegram que hay inventario digital disponible para cobrar
            await bot.answer_pre_checkout_query(pre_checkout_query_id=pre_checkout_id, ok=True)
            print(f"✅ [STARS] Pre-checkout autorizado. ID: {pre_checkout_id}")
        except Exception as e:
            print(f"❌ [STARS] Error autorizando pre_checkout: {e}")
        return {"status": "ok"}

    message = body.get("message")
    
    if message:
        sender_id = message.get("from", {}).get("id")
        username = message.get("from", {}).get("username", "Sin username")
        text = message.get("text", "")
        
        # =====================================================================
        # 2. FASE DE ACREDITACIÓN E INYECCIÓN A LA BASE DE DATOS
        # =====================================================================
        if "successful_payment" in message:
            payment_info = message["successful_payment"]
            payload = payment_info.get("invoice_payload", "")  # Ej: "legend", "soldier"
            total_amount = payment_info.get("total_amount", 0)
            currency = payment_info.get("currency", "XTR")
            
            print(f"💰 [STARS] PAGO RECIBIDO -> ID: {sender_id} | Paquete: {payload} | Monto: {total_amount} {currency}")
            
            try:
                # Buscar el paquete en la base de datos para saber cuántos $ALPHA entregar
                package = db.query(Package).filter(Package.slug == payload).first()
                alpha_added = package.alpha_total if package else 0
                
                if alpha_added > 0:
                    # Auto-crear usuario si por alguna razón no existe en DB
                    user = db.query(User).filter(User.user_id == sender_id).first()
                    if not user:
                        user = User(user_id=sender_id, name=username)
                        db.add(user)
                        db.commit()

                    # Buscar o crear la Billetera
                    wallet = db.query(Wallet).filter(Wallet.user_id == sender_id).first()
                    if not wallet:
                        wallet = Wallet(user_id=sender_id, alpha_balance=0)
                        db.add(wallet)
                    
                    # Inyectar el saldo
                    wallet.alpha_balance += alpha_added
                    
                    # Guardar el recibo inmutable en Transactions
                    new_tx = Transaction(
                        sender_id=None,  # None = Sistema/Búnker
                        receiver_id=sender_id,
                        amount=alpha_added,
                        tx_type="package_recharge"
                    )
                    db.add(new_tx)
                    db.commit()
                    print(f"💎 [DATABASE] +{alpha_added} $ALPHA inyectados a la wallet de {sender_id}.")
                else:
                    print(f"⚠️ [DATABASE] Paquete '{payload}' no encontrado. No se inyectó saldo.")

            except Exception as e:
                db.rollback()
                print(f"❌ [DATABASE] Error al procesar billetera: {e}")

            # 🔒 Acreditación de Rango y Generación de Enlace VIP
            try:
                await update_user_tier(user_id=sender_id, tier=payload, amount=total_amount)
            except Exception as e:
                print(f"❌ [TIER UPDATE ERROR]: {e}")
            
            # 3. CONFIRMACIÓN AL FAN EN TELEGRAM
            try:
                await bot.send_message(
                    chat_id=sender_id,
                    text=f"💎 <b>¡Recarga Táctica Confirmada!</b>\n\nTu pago ha sido procesado exitosamente. Se han acreditado <b>+{alpha_added} $ALPHA</b> en tu Billetera del Búnker. 🚀",
                    parse_mode="HTML"
                )
            except Exception as e:
                print(f"❌ [STARS] Error enviando confirmación al usuario: {e}")
                
            return {"status": "success", "payment_processed": True}

        # =====================================================================
        # 4. MANEJO DE COMANDOS BÁSICOS
        # =====================================================================
        if text == "/start":
            keyboard = InlineKeyboardMarkup(
                inline_keyboard=[
                    [
                        InlineKeyboardButton(
                            text="🚀 Abrir Alpha Vault Mini App",
                            web_app={"url": MINI_APP_URL}
                        )
                    ]
                ]
            )
            await bot.send_message(
                chat_id=sender_id,
                text=f"¡Bienvenido al Búnker! 🐺 Haz clic en el botón de abajo para entrar a la plataforma:",
                reply_markup=keyboard
            )

    return {"status": "success", "message_received": True}