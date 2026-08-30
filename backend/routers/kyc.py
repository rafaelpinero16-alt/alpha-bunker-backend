from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime
import os
import base64
from pydantic import BaseModel
from database.db import get_db, SessionLocal
from database.models import User
from core.config import dp, bot
from aiogram import types, F
from aiogram.types import BufferedInputFile, InputMediaPhoto, InlineKeyboardMarkup, InlineKeyboardButton

router = APIRouter(prefix="/kyc", tags=["KYC Verification"])

TELEGRAM_ADMIN_CHAT_ID = os.getenv("ADMIN_CHAT_ID", "-1003702657063")

class KYCSubmitRequest(BaseModel):
    user_id: int
    legal_name: str
    document_base64: str
    selfie_base64: str

def decode_base64_img(b64_str: str) -> bytes:
    if "," in b64_str:
        b64_str = b64_str.split(",", 1)[1]
    return base64.b64decode(b64_str)

# 🚀 PROCESAR Y ENVIAR SOLICITUD KYC CON FOTOS AL CANAL
@router.post("/submit")
async def submit_kyc(data: KYCSubmitRequest, db: Session = Depends(get_db)):
    # 1. Registrar / Actualizar usuario en la base de datos
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

    # 2. Enviar fotos y panel interactivo al canal de administración
    try:
        doc_bytes = decode_base64_img(data.document_base64)
        selfie_bytes = decode_base64_img(data.selfie_base64)

        doc_file = BufferedInputFile(doc_bytes, filename="documento.jpg")
        selfie_file = BufferedInputFile(selfie_bytes, filename="selfie.jpg")

        # Publicar álbum con ambas imágenes en el canal
        media_group = [
            InputMediaPhoto(media=doc_file, caption=f"🪪 *Documento:* {data.legal_name} (ID: `{data.user_id}`)"),
            InputMediaPhoto(media=selfie_file, caption=f"📸 *Selfie con fecha:* {data.legal_name}")
        ]
        await bot.send_media_group(chat_id=int(TELEGRAM_ADMIN_CHAT_ID), media=media_group)

        # Publicar tarjeta de control con botones inline
        keyboard = InlineKeyboardMarkup(inline_keyboard=[
            [
                InlineKeyboardButton(text="✅ Aprobar (+18)", callback_data=f"kyc_approve_{data.user_id}"),
                InlineKeyboardButton(text="❌ Rechazar", callback_data=f"kyc_reject_{data.user_id}")
            ]
        ])

        control_text = (
            f"🛡️ *SOLICITUD DE AUDITORÍA KYC (+18)*\n\n"
            f"👤 *Usuario ID:* `{data.user_id}`\n"
            f"📝 *Nombre Legal:* {data.legal_name}\n"
            f"📅 *Fecha:* {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')} UTC\n\n"
            f"Revisa las imágenes anteriores y selecciona una acción:"
        )

        await bot.send_message(
            chat_id=int(TELEGRAM_ADMIN_CHAT_ID),
            text=control_text,
            parse_mode="Markdown",
            reply_markup=keyboard
        )
    except Exception as e:
        print(f"[ERROR ENVIANDO FOTOS A TELEGRAM]: {e}")

    return {"status": "success", "message": "Solicitud enviada al Búnker"}

# 🎯 MANEJADORES DE ACCIÓN INTERACTIVA EN EL CANAL
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
                f"{callback.message.text}\n\n✅ *ESTADO: APROBADO (+18)*\n👮 *Auditado por:* {callback.from_user.full_name}",
                parse_mode="Markdown"
            )

            try:
                await bot.send_message(
                    chat_id=user_id,
                    text="🛡️ *ALPHA VAULT - NOTIFICACIÓN:*\n\n¡Tu cuenta ha sido verificada (+18) con éxito! 🎉 Ya puedes publicar contenido en el muro y monetizar.",
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
                f"{callback.message.text}\n\n❌ *ESTADO: RECHAZADO*\n👮 *Auditado por:* {callback.from_user.full_name}",
                parse_mode="Markdown"
            )

            try:
                await bot.send_message(
                    chat_id=user_id,
                    text="🛡️ *ALPHA VAULT - NOTIFICACIÓN:*\n\nTu solicitud de verificación fue rechazada. Verifica que tus documentos sean claros y vuelve a intentarlo.",
                    parse_mode="Markdown"
                )
            except Exception:
                pass

            await callback.answer("❌ Solicitud rechazada")
    finally:
        db.close()