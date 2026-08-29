import os
from fastapi import APIRouter, Header, HTTPException, Request

router = APIRouter(prefix="/telegram", tags=["Telegram Webhook"])

# Obtenemos el token secreto configurado en el entorno
TELEGRAM_SECRET_TOKEN = os.getenv("TELEGRAM_SECRET_TOKEN", "tu_token_secreto_por_defecto")

@router.post("/webhook")
async def telegram_webhook(
    request: Request,
    x_telegram_bot_api_secret_token: str = Header(None)
):
    # Capa de seguridad: Validar el token secreto enviado por Telegram
    if x_telegram_bot_api_secret_token != TELEGRAM_SECRET_TOKEN:
        raise HTTPException(status_code=403, detail="Acceso denegado: Token secreto inválido.")
    
    # Capturamos el cuerpo de la petición (JSON) enviado por Telegram
    body = await request.json()
    
    # Extraemos la información del mensaje si existe en el payload
    message = body.get("message")
    if message:
        sender_id = message.get("from", {}).get("id")
        username = message.get("from", {}).get("username", "Sin username")
        text = message.get("text", "")
        
        print(f"📩 Webhook Telegram recibido -> ID: {sender_id} | User: @{username} | Texto: {text}")
        
        # Aquí conectaremos la lógica de comandos o respuestas en los siguientes pasos

    return {"status": "success", "message_received": True}