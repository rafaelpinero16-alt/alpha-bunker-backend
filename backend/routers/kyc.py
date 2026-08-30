from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime
import os
import requests
import base64
from io import BytesIO
from pydantic import BaseModel
from database.db import get_db, SessionLocal
from database.models import User
from core.config import dp, bot
from aiogram import types, F

router = APIRouter(prefix="/kyc", tags=["KYC Verification"])

TELEGRAM_BOT_TOKEN = os.getenv("BOT_TOKEN")
TELEGRAM_ADMIN_CHAT_ID = os.getenv("ADMIN_CHAT_ID", "-1003702657063")

class KYCSubmitRequest(BaseModel):
    user_id: int
    legal_name: str
    document_base64: str
    selfie_base64: str

# 🔍 ENDPOINT DE PRUEBA DIRECTA AL CANAL
@router.get("/test-channel")
def test_channel_connection():
    if not TELEGRAM_BOT_TOKEN:
        return {"error": "BOT_TOKEN no está definido en Railway"}
    
    url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
    payload = {
        "chat_id": TELEGRAM_ADMIN_CHAT_ID,
        "text": "🛡️ *PRUEBA DE CONEXIÓN BÚNKER ADMIN*\n\nSi ves este mensaje, la conexión entre el backend y el canal está 100% activa.",
        "parse_mode": "Markdown",
        "reply_markup": {
            "inline_keyboard": [
                [
                    {"text": "✅ Botón Prueba 1", "callback_data": "test_1"},
                    {"text": "❌ Botón Prueba 2", "callback_data": "test_2"}
                ]
            ]
        }
    }
    
    response = requests.post(url, json=payload, timeout=10)
    return {
        "chat_id_usado": TELEGRAM_ADMIN_CHAT_ID,
        "telegram_response": response.json()
    }

# 🚀 PROCESAR Y ENVIAR SOLICITUD KYC CON FOTOS
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

    # Enviar ficha con botones al canal
    if TELEGRAM_BOT_TOKEN and TELEGRAM_ADMIN_CHAT_ID:
        caption = (
            f"🛡️ *NUEVA SOLICITUD DE VERIFICACIÓN (+18)*\n\n"
            f"👤 *Usuario ID:* `{data.user_id}`\n"
            f"📝 *Nombre:* {data.legal_name}\n"
            f"📅 *Fecha:* {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')} UTC"
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
            "text": caption,
            "parse_mode": "Markdown",
            "reply_markup": inline_keyboard
        }

        try:
            tg_res = requests.post(url, json=payload, timeout=10)
            print(f"[TELEGRAM RES]: {tg_res.text}")
        except Exception as e:
            print(f"[TELEGRAM ERROR]: {e}")

    return {"status": "success", "message": "Solicitud enviada al Búnker"}

# 🎯 MANEJADORES DE CLICS EN CANAL
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
                    text="🛡️ *ALPHA VAULT:*\n\n¡Tu cuenta ha sido verificada (+18) con éxito! 🎉 Ya puedes publicar contenido en el muro y monetizar.",
                    parse_mode="Markdown"
                )
            except Exception:
                pass
            
            await callback.answer("✅ Usuario aprobado")
    finally:
        db.close()

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
                    text="🛡️ *ALPHA VAULT:*\n\nTu solicitud de verificación fue rechazada. Verifica que tus documentos sean legibles y vuelve a intentarlo.",
                    parse_mode="Markdown"
                )
            except Exception:
                pass

            await callback.answer("❌ Solicitud rechazada")
    finally:
        db.close()