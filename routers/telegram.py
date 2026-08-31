import os
from fastapi import APIRouter, Header, HTTPException, Request
from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton
from core.config import bot

# Si tienes un controlador de base de datos para la billetera, lo importaremos aquí luego.
# Ejemplo: from database.wallet_crud import add_alpha_balance

router = APIRouter(prefix="/telegram", tags=["Telegram Webhook"])

TELEGRAM_SECRET_TOKEN = os.getenv("TELEGRAM_SECRET_TOKEN", "").strip()
# URL de tu frontend en Netlify o Railway para la Mini App
MINI_APP_URL = os.getenv("MINI_APP_URL", "https://tu-miniapp.netlify.app")

@router.post("/webhook")
async def telegram_webhook(
    request: Request,
    x_telegram_bot_api_secret_token: str = Header(None)
):
    # Validar el token secreto solo si está configurado en el entorno
    if TELEGRAM_SECRET_TOKEN and x_telegram_bot_api_secret_token != TELEGRAM_SECRET_TOKEN:
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
            # Confirmamos a Telegram que estamos listos para cobrar
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
        # 2. FASE DE ACREDITACIÓN: Cobro exitoso (successful_payment)
        # =====================================================================
        if "successful_payment" in message:
            payment_info = message["successful_payment"]
            payload = payment_info.get("invoice_payload", "")
            total_amount = payment_info.get("total_amount", 0)
            currency = payment_info.get("currency", "XTR")
            
            print(f"💰 [STARS] PAGO RECIBIDO -> ID: {sender_id} | Paquete: {payload} | Monto: {total_amount} {currency}")
            
            # 🛠️ AQUÍ INYECTAREMOS LA LÓGICA DE TU BASE DE DATOS EN EL PRÓXIMO PASO:
            # await add_alpha_balance(sender_id, pack_slug=payload)
            
            # 3. CONFIRMACIÓN AL FAN EN TELEGRAM
            try:
                await bot.send_message(
                    chat_id=sender_id,
                    text=f"💎 <b>¡Recarga Táctica Confirmada!</b>\n\nTu pago ha sido procesado exitosamente. El paquete <code>{payload}</code> ha sido acreditado en tu Billetera $ALPHA del Búnker. 🚀",
                    parse_mode="HTML"
                )
            except Exception as e:
                print(f"❌ [STARS] Error enviando confirmación al usuario: {e}")
                
            return {"status": "success", "payment_processed": True}

        # Mensajes normales (Logs)
        print(f"📩 Webhook Telegram recibido -> ID: {sender_id} | User: @{username} | Texto: {text}")
        
        # Bloque de lógica para responder al comando /start con la Mini App
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