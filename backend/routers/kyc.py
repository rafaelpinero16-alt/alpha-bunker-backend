from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime
import os
import requests
from pydantic import BaseModel
from database.db import get_db, SessionLocal
from database.models import User
from core.config import dp, bot
from aiogram import types, F

router = APIRouter(prefix="/kyc", tags=["KYC Verification"])

TELEGRAM_BOT_TOKEN = os.getenv("BOT_TOKEN")
TELEGRAM_ADMIN_CHAT_ID = os.getenv("ADMIN_CHAT_ID")

class KYCSubmitRequest(BaseModel):
    user_id: int
    legal_name: str
    document_base64: str
    selfie_base64: str

# 1. ENDPOINT PARA RECIBIR LA SOLICITUD DESDE LA MINI APP
@router.post("/submit")
async def submit_kyc(data: KYCSubmitRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.user_id == data.user_id).first()
    if not user:
        user = User(
            user_id=data.user_id,
            name=data.legal_name,
            role="creator",
            kyc_status="pending",
            legal_name=data.legal_name,
            kyc_submitted_at=datetime.utcnow()
        )
        db.add(user)
    else:
        user.kyc_status = "pending"
        user.legal_name = data.legal_name
        user.kyc_submitted_at = datetime.utcnow()
    
    db.commit()

    # Enviar ficha con botones interactivos al canal privado de Telegram
    if TELEGRAM_BOT_TOKEN and TELEGRAM_ADMIN_CHAT_ID:
        text = (
            f"🛡️ *NUEVA SOLICITUD DE VERIFICACIÓN (+18)*\n\n"
            f"👤 *Usuario ID:* `{data.user_id}`\n"
            f"📝 *Nombre Legal:* {data.legal_name}\n"
            f"📅 *Fecha:* {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')} UTC\n\n"
            f"Por favor revisa la documentación y presiona una acción:"
        )

        inline_keyboard = {
            "inline_keyboard": [
                [
                    {"text": "✅ Aprobar (+18)", "callback_data": f"kyc_approve_{data.user_id}"},
                    {"text": "❌ Rechazar", "callback_data": f"kyc_reject_{data.user_id}"}
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
            requests.post(url, json=payload, timeout=8)
        except Exception as e:
            print(f"[TELEGRAM NOTIFICATION ERROR]: {e}")

    return {"status": "success", "message": "Solicitud enviada al Búnker"}

# 2. MANEJADOR AIOGRAM: BOTÓN APROBAR
@dp.callback_query(F.data.startswith("kyc_approve_"))
async def process_kyc_approve(callback: types.CallbackQuery):
    user_id = int(callback.data.replace("kyc_approve_", ""))
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.user_id == user_id).first()
        if user:
            user.kyc_status = "verified"
            user.is_adult = True
            user.kyc_verified_at = datetime.utcnow()
            db.commit()

            await callback.message.edit_text(
                f"{callback.message.text}\n\n✅ *ESTADO: APROBADO (+18)*\n👮 *Revisado por:* {callback.from_user.full_name}",
                parse_mode="Markdown"
            )

            try:
                await bot.send_message(
                    chat_id=user_id,
                    text="🛡️ *ALPHA VAULT - ESTADO DE CUENTA:*\n\n¡Tu cuenta ha sido verificada (+18) con éxito! 🎉 Ya puedes publicar contenido en el Muro y monetizar.",
                    parse_mode="Markdown"
                )
            except Exception:
                pass
            
            await callback.answer("✅ Usuario aprobado con éxito")
    finally:
        db.close()

# 3. MANEJADOR AIOGRAM: BOTÓN RECHAZAR
@dp.callback_query(F.data.startswith("kyc_reject_"))
async def process_kyc_reject(callback: types.CallbackQuery):
    user_id = int(callback.data.replace("kyc_reject_", ""))
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.user_id == user_id).first()
        if user:
            user.kyc_status = "rejected"
            user.is_adult = False
            db.commit()

            await callback.message.edit_text(
                f"{callback.message.text}\n\n❌ *ESTADO: RECHAZADO*\n👮 *Revisado por:* {callback.from_user.full_name}",
                parse_mode="Markdown"
            )

            try:
                await bot.send_message(
                    chat_id=user_id,
                    text="🛡️ *ALPHA VAULT - ESTADO DE CUENTA:*\n\nTu solicitud de verificación fue rechazada. Verifica que tus fotos sean legibles y vuelve a intentarlo.",
                    parse_mode="Markdown"
                )
            except Exception:
                pass

            await callback.answer("❌ Solicitud rechazada")
    finally:
        db.close()