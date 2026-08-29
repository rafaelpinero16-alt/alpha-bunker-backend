from fastapi import APIRouter, HTTPException
from aiogram import types, F
from aiogram.types import LabeledPrice
from core.config import bot, dp
from database.db import update_user_tier
from models.schemas import InvoiceRequest  # <-- Aquí llamamos a tu guardia de seguridad

router = APIRouter()

@router.post("/create-invoice")
async def create_invoice(data: InvoiceRequest):
    try:
        prices = [LabeledPrice(label=f"Suscripción {data.tier_name}", amount=data.amount_stars)]
        
        invoice_link = await bot.create_invoice_link(
            title=f"Acceso VIP - {data.tier_name}",
            description="Desbloqueo de contenido exclusivo en el Vault de Alpha Tom.",
            payload=f"tier_{data.tier_name}_{data.user_id}",
            currency="XTR",
            prices=prices
        )
        return {"invoice_link": invoice_link}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@dp.pre_checkout_query()
async def process_pre_checkout_query(pre_checkout_query: types.PreCheckoutQuery):
    await bot.answer_pre_checkout_query(pre_checkout_query.id, ok=True)

@dp.message(F.successful_payment)
async def success_payment(message: types.Message):
    payment = message.successful_payment
    
    # Extraemos el nombre del tier desde el payload
    payload_parts = payment.invoice_payload.split('_')
    
    if len(payload_parts) >= 2:
        tier_name = payload_parts[1]
        user_id = message.from_user.id
        
        # GUARDAMOS AL USUARIO Y SU DINERO EN LA BASE DE DATOS
        update_user_tier(user_id=user_id, tier=tier_name, amount=payment.total_amount)
    
    await message.answer("¡Pago con Telegram Stars exitoso! 💎 Tu rango en el Vault ha sido actualizado y asegurado.")