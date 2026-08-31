import os
from fastapi import APIRouter, Header, HTTPException, Request
from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton
from core.config import bot

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

    message = body.get("message")
    
    if message:
        sender_id = message.get("from", {}).get("id")
        username = message.get("from", {}).get("username", "Sin username")
        text = message.get("text", "")
        
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