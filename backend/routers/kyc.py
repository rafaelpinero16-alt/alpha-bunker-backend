from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.orm import Session
from datetime import datetime
import os
import requests
from pydantic import BaseModel
from database.db import get_db
from database.models import User

router = APIRouter(prefix="/kyc", tags=["KYC Verification"])

# Variables de entorno
TELEGRAM_BOT_TOKEN = os.getenv("BOT_TOKEN")
TELEGRAM_ADMIN_CHAT_ID = os.getenv("ADMIN_CHAT_ID")  # ID de tu canal o grupo Búnker Admin

class KYCSubmitRequest(BaseModel):
    user_id: int
    legal_name: str
    document_base64: str
    selfie_base64: str

class KYCReviewRequest(BaseModel):
    user_id: int
    action: str  # "approve" o "reject"

@router.post("/submit")
async def submit_kyc(data: KYCSubmitRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.user_id == data.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    # Actualizar estado a pendiente
    user.kyc_status = "pending"
    user.legal_name = data.legal_name
    user.document_url = data.document_base64[:100] + "..."  # Referencia
    user.selfie_url = data.selfie_base64[:100] + "..."
    user.kyc_submitted_at = datetime.utcnow()
    db.commit()

    # Enviar notificación con botones interactivos al canal Búnker Admin
    if TELEGRAM_BOT_TOKEN and TELEGRAM_ADMIN_CHAT_ID:
        text = (
            f"🛡️ *SOLICITUD DE VERIFICACIÓN KYC (+18)*\n\n"
            f"👤 *Usuario ID:* `{user.user_id}`\n"
            f"📝 *Nombre Legal:* {data.legal_name}\n"
            f"🎭 *Rol Solicitado:* {user.role.upper()}\n"
            f"📅 *Fecha:* {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')} UTC\n\n"
            f"Verifica el documento y la selfie con la fecha de hoy."
        )

        inline_keyboard = {
            "inline_keyboard": [
                [
                    {"text": "✅ Aprobar (+18)", "callback_data": f"kyc_approve_{user.user_id}"},
                    {"text": "❌ Rechazar", "callback_data": f"kyc_reject_{user.user_id}"}
                ]
            ]
        }

        url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
        payload = {
            "chat_id": TELEGRAM_ADMIN_CHAT_ID,
            "text": text,
            "parse_mode": "Markdown",
            "reply_markup": inline_keyboard
        }

        try:
            requests.post(url, json=payload, timeout=5)
        except Exception as e:
            print(f"[TELEGRAM NOTIFICATION ERROR]: {e}")

    return {"status": "success", "message": "Solicitud enviada a revisión en el Búnker CRM"}

@router.post("/review")
async def review_kyc(data: KYCReviewRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.user_id == data.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    if data.action == "approve":
        user.kyc_status = "verified"
        user.is_adult = True
        user.kyc_verified_at = datetime.utcnow()
        message = "¡Tu cuenta ha sido verificada con éxito (+18)! Ya puedes publicar y monetizar."
    else:
        user.kyc_status = "rejected"
        user.is_adult = False
        message = "Tu solicitud de verificación fue rechazada. Revisa que tu documento y selfie sean legibles."

    db.commit()

    # Notificar directamente al usuario por Telegram
    if TELEGRAM_BOT_TOKEN:
        try:
            user_msg_url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
            requests.post(user_msg_url, json={
                "chat_id": user.user_id,
                "text": f"🛡️ *ESTADO DE VERIFICACIÓN ALPHA VAULT:*\n\n{message}",
                "parse_mode": "Markdown"
            }, timeout=5)
        except Exception as e:
            print(f"[USER NOTIFY ERROR]: {e}")

    return {"status": "success", "new_status": user.kyc_status}