from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel
from aiogram import types, F
from aiogram.types import LabeledPrice
from core.config import bot, dp
from database.db import get_db
from routers.logic import update_user_tier
from database.models import Package, Wallet, Transaction

router = APIRouter(prefix="/payments", tags=["Payments"])

class InvoiceRequest(BaseModel):
    user_id: str  
    package_slug: str

class VerifyStarsRequest(BaseModel):
    user_id: int
    package_slug: str

@router.get("/packages")
async def get_packages(db: Session = Depends(get_db)):
    official_packages = [
        {
            "slug": "soldier",
            "name": "Soldier 🎖️",
            "badge": "🎖️ CREADOR PRO",
            "price_usd": 2.99,
            "price_stars": 150,
            "price_ton": 0.05,
            "alpha_total": 150,
            "bonus_percentage": 0,
            "description": "Herramientas de Creador (1 Mes Prueba Gratis)."
        },
        {
            "slug": "veteran",
            "name": "Veteran ⚔️",
            "badge": "⚔️ CREADOR ÉLITE",
            "price_usd": 5.99,
            "price_stars": 300,
            "price_ton": 0.10,
            "alpha_total": 330,
            "bonus_percentage": 10,
            "description": "Contenido avanzado y pagos Wompi/Skrill."
        },
        {
            "slug": "legend",
            "name": "Legend 👑",
            "badge": "👑 NIVEL 4",
            "price_usd": 25.00,
            "price_stars": 1250,
            "price_ton": 0.18,
            "alpha_total": 650,
            "bonus_percentage": 15,
            "description": "Acceso total VIP y funciones máximas."
        },
        {
            "slug": "icon-legend",
            "name": "Icon Legend 💎",
            "badge": "💎 NIVEL MÁXIMO",
            "price_usd": 53.00,
            "price_stars": 2650,
            "price_ton": 0.40,
            "alpha_total": 1500,
            "bonus_percentage": 25,
            "description": "Acceso total + Cámaras en videollamadas."
        }
    ]
    return {"packages": official_packages}

@router.post("/create-invoice")
async def create_invoice(data: InvoiceRequest, db: Session = Depends(get_db)):
    try:
        official_packages = {
            "soldier": {"name": "Soldier 🎖️", "price_stars": 150, "description": "Herramientas Creador (Mes Prueba)"},
            "veteran": {"name": "Veteran ⚔️", "price_stars": 300, "description": "Creador Élite avanzado"},
            "legend": {"name": "Legend 👑", "price_stars": 1250, "description": "Acceso VIP total."},
            "icon-legend": {"name": "Icon Legend 💎", "price_stars": 2650, "description": "Nivel Máximo."}
        }
        
        if data.package_slug in official_packages:
            p_info = official_packages[data.package_slug]
            pkg_name = p_info["name"]
            pkg_stars = p_info["price_stars"]
            pkg_desc = p_info["description"]
        else:
            raise HTTPException(status_code=404, detail="Paquete no encontrado")
            
        prices = [LabeledPrice(label=f"Suscripción {pkg_name}", amount=pkg_stars)]
        
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

# 🛡️ Endpoint Puente: Inyecta los $ALPHA al instante confirmados por el frontend
@router.post("/verify-stars")
async def verify_stars_payment(data: VerifyStarsRequest, db: Session = Depends(get_db)):
    try:
        packages_alpha = {
            "spy": 50, "soldier": 150, "veteran": 330, "legend": 650, "icon-legend": 1500
        }
        alpha_to_add = packages_alpha.get(data.package_slug, 0)
        
        if alpha_to_add > 0:
            wallet = db.query(Wallet).filter(Wallet.user_id == data.user_id).first()
            if not wallet:
                wallet = Wallet(user_id=data.user_id, alpha_balance=0, total_earned=0, total_spent=0)
                db.add(wallet)
                
            wallet.alpha_balance += alpha_to_add
            
            tx = Transaction(
                sender_id=0,
                receiver_id=data.user_id,
                amount=alpha_to_add,
                tx_type="stars_recharge",
                reference_id=int(datetime.utcnow().timestamp())
            )
            db.add(tx)
            db.commit()
            return {"status": "success", "alpha_added": alpha_to_add}
        return {"status": "error", "detail": "Paquete inválido"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@dp.pre_checkout_query()
async def process_pre_checkout_query(pre_checkout_query: types.PreCheckoutQuery):
    await bot.answer_pre_checkout_query(pre_checkout_query.id, ok=True)

@dp.message(F.successful_payment)
async def success_payment(message: types.Message):
    payment = message.successful_payment
    payload_parts = payment.invoice_payload.split('_')
    
    if len(payload_parts) >= 3:
        tier_slug = payload_parts[1]
        user_id = payload_parts[2]
        
        try:
            await update_user_tier(user_id=user_id, tier=tier_slug, amount=payment.total_amount)
            print(f"[✅ STARS PAYMENT] Rango {tier_slug.upper()} asignado.")
        except Exception as e:
            print(f"[❌ DATABASE ERROR] {e}")
    
    await message.answer("¡Pago con Telegram Stars exitoso! 💎 Tus $ALPHA han sido recargados y tu rango actualizado. Vuelve a la Mini App.")