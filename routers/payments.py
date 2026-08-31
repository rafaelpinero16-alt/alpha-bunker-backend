from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel
from aiogram import types, F
from aiogram.types import LabeledPrice
from core.config import bot, dp
from database.db import get_db, update_user_tier
from database.models import Package

router = APIRouter(prefix="/payments", tags=["Payments"])

class InvoiceRequest(BaseModel):
    user_id: int
    package_slug: str

@router.get("/packages")
async def get_packages(db: Session = Depends(get_db)):
    packages = db.query(Package).all()
    return {"packages": packages}

@router.post("/create-invoice")
async def create_invoice(data: InvoiceRequest, db: Session = Depends(get_db)):
    try:
        pkg = db.query(Package).filter(Package.slug == data.package_slug).first()
        if not pkg:
            raise HTTPException(status_code=404, detail="Paquete no encontrado")
            
        prices = [LabeledPrice(label=f"Suscripción {pkg.name}", amount=pkg.price_stars)]
        
        invoice_link = await bot.create_invoice_link(
            title=f"Búnker VIP - {pkg.name}",
            description=pkg.description or "Acceso exclusivo en Alpha Vault.",
            payload=f"tier_{pkg.slug}_{data.user_id}",
            currency="XTR",
            prices=prices
        )
        return {"status": "success", "invoice_link": invoice_link}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@dp.pre_checkout_query()
async def process_pre_checkout_query(pre_checkout_query: types.PreCheckoutQuery):
    await bot.answer_pre_checkout_query(pre_checkout_query.id, ok=True)

@dp.message(F.successful_payment)
async def success_payment(message: types.Message):
    payment = message.successful_payment
    payload_parts = payment.invoice_payload.split('_')
    
    if len(payload_parts) >= 3:
        tier_slug = payload_parts[1]
        user_id = message.from_user.id
        update_user_tier(user_id=user_id, tier=tier_slug, amount=payment.total_amount)
    
    await message.answer("¡Pago con Telegram Stars exitoso! 💎 Tu rango en el Búnker ha sido actualizado.")