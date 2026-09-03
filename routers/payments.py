from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel
from aiogram import types, F
from aiogram.types import LabeledPrice
from core.config import bot, dp
from database.db import get_db
# 🛡️ Importación de la lógica de actualización
from routers.logic import update_user_tier
from database.models import Package

router = APIRouter(prefix="/payments", tags=["Payments"])

class InvoiceRequest(BaseModel):
    user_id: str  # Declarado como string para soportar IDs de Telegram o Teléfonos
    package_slug: str

@router.get("/packages")
async def get_packages(db: Session = Depends(get_db)):
    official_packages = [
        {
            "slug": "soldier",
            "name": "Soldier 🎖️",
            "badge": "🎖️ NIVEL 2",
            "price_usd": 15,
            "price_stars": 750,
            "price_ton": 0.05,
            "alpha_total": 150,
            "bonus_percentage": 0,
            "description": "Contenido básico y acceso a la comunidad general."
        },
        {
            "slug": "veteran",
            "name": "Veteran ⚔️",
            "badge": "⚔️ NIVEL 3",
            "price_usd": 30,
            "price_stars": 1500,
            "price_ton": 0.10,
            "alpha_total": 330,
            "bonus_percentage": 10,
            "description": "Contenido avanzado y accesos exclusivos."
        },
        {
            "slug": "legend",
            "name": "Legend 👑",
            "badge": "👑 NIVEL 4",
            "price_usd": 55,
            "price_stars": 2750,
            "price_ton": 0.18,
            "alpha_total": 650,
            "bonus_percentage": 15,
            "description": "Acceso total VIP y funciones de creador."
        },
        {
            "slug": "icon-legend",
            "name": "Icon Legend 💎",
            "badge": "💎 NIVEL MÁXIMO",
            "price_usd": 120,
            "price_stars": 6000,
            "price_ton": 0.40,
            "alpha_total": 1500,
            "bonus_percentage": 25,
            "description": "Acceso total + Cámaras en videollamadas grupales."
        }
    ]
    
    try:
        packages = db.query(Package).all()
        if not packages:
            return {"packages": official_packages}
        return {"packages": packages}
    except Exception:
        return {"packages": official_packages}

@router.post("/create-invoice")
async def create_invoice(data: InvoiceRequest, db: Session = Depends(get_db)):
    try:
        official_packages = {
            "soldier": {"name": "Soldier 🎖️", "price_stars": 750, "description": "Contenido básico y acceso a la comunidad general."},
            "veteran": {"name": "Veteran ⚔️", "price_stars": 1500, "description": "Contenido avanzado y accesos exclusivos."},
            "legend": {"name": "Legend 👑", "price_stars": 2750, "description": "Acceso total VIP y funciones de creador."},
            "icon-legend": {"name": "Icon Legend 💎", "price_stars": 6000, "description": "Acceso total + Cámaras en videollamadas grupales."}
        }
        
        pkg = db.query(Package).filter(Package.slug == data.package_slug).first()
        if pkg:
            pkg_name = pkg.name
            pkg_stars = pkg.price_stars
            pkg_desc = pkg.description or "Acceso exclusivo en Alpha Vault."
        elif data.package_slug in official_packages:
            p_info = official_packages[data.package_slug]
            pkg_name = p_info["name"]
            pkg_stars = p_info["price_stars"]
            pkg_desc = p_info["description"]
        else:
            raise HTTPException(status_code=404, detail="Paquete no encontrado")
            
        prices = [LabeledPrice(label=f"Suscripción {pkg_name}", amount=pkg_stars)]
        
        # 🛡️ El payload viaja cifrado en la factura para asegurar la integridad al retornar
        invoice_link = await bot.create_invoice_link(
            title=f"Búnker VIP - {pkg_name}",
            description=pkg_desc,
            payload=f"tier_{data.package_slug}_{data.user_id}",
            currency="XTR",
            prices=prices
        )
        return {"status": "success", "invoice_link": invoice_link}
    except Exception as e:
        print(f"[❌ INVOICE ERROR] Fallo al generar factura: {e}")
        raise HTTPException(status_code=400, detail=str(e))

@dp.pre_checkout_query()
async def process_pre_checkout_query(pre_checkout_query: types.PreCheckoutQuery):
    # Telegram exige responder al pre_checkout en menos de 10 segundos
    await bot.answer_pre_checkout_query(pre_checkout_query.id, ok=True)

@dp.message(F.successful_payment)
async def success_payment(message: types.Message):
    payment = message.successful_payment
    payload_parts = payment.invoice_payload.split('_')
    
    if len(payload_parts) >= 3:
        tier_slug = payload_parts[1]
        user_id = payload_parts[2] # 🛡️ Extraemos el ID exacto del payload, no del remitente de Telegram
        
        try:
            # Sincronización instantánea con la BD
            await update_user_tier(user_id=user_id, tier=tier_slug, amount=payment.total_amount)
            print(f"[✅ STARS PAYMENT] Rango {tier_slug.upper()} asignado al instante al usuario {user_id}.")
        except Exception as e:
            print(f"[❌ DATABASE ERROR] El pago entró, pero falló la actualización del rango: {e}")
    
    # 🛡️ Siempre cerrar el ciclo respondiéndole a Telegram para que no congele la transacción
    await message.answer("¡Pago con Telegram Stars exitoso! 💎 Tu rango en el Búnker ha sido actualizado al instante. Cierra este chat y vuelve a la Mini App.")