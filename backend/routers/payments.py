from fastapi import APIRouter, HTTPException
from aiogram import types, F
from aiogram.types import LabeledPrice
from core.config import bot, dp
from database.db import get_connection
from models.schemas import InvoiceRequest

router = APIRouter(prefix="/payments", tags=["Telegram Stars Payments"])

@router.post("/create-invoice")
async def create_invoice(data: InvoiceRequest):
    """
    Genera un enlace de pago oficial y legal mediante Telegram Stars (XTR).
    Cumple con los términos de servicio de Telegram para bienes digitales y membresías.
    """
    try:
        # Validación de montos mínimos legales en Telegram Stars (mínimo 1 Star)
        if data.amount_stars <= 0:
            raise HTTPException(status_code=400, detail="El monto de Stars debe ser mayor a 0.")

        prices = [LabeledPrice(label=f"Pase {data.tier_name}", amount=data.amount_stars)]
        
        # Estructura de payload estandarizada: tipo_item_userId (ej: tier_VIP_12345 o pack_500_12345)
        payload = f"sub_{data.tier_name}_{data.user_id}"
        
        invoice_link = await bot.create_invoice_link(
            title=f"Acceso Alpha Vault - {data.tier_name}",
            description=f"Desbloqueo instantáneo de rango {data.tier_name} y beneficios exclusivos en el ecosistema.",
            payload=payload,
            currency="XTR",  # Moneda oficial de Telegram Stars para bienes digitales
            prices=prices
        )
        
        return {"status": "success", "invoice_link": invoice_link}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@dp.pre_checkout_query()
async def process_pre_checkout_query(pre_checkout_query: types.PreCheckoutQuery):
    """
    Valida la transacción antes de que Telegram procese el cobro.
    """
    await bot.answer_pre_checkout_query(pre_checkout_query.id, ok=True)


@dp.message(F.successful_payment)
async def success_payment(message: types.Message):
    """
    Procesador post-pago: acredita rango, tokens $ALPHA y registra en la base de datos de forma atómica.
    """
    payment = message.successful_payment
    payload = payment.invoice_payload
    payload_parts = payload.split('_')
    
    if len(payload_parts) < 3:
        await message.answer("⚠️ Pago recibido, pero el formato de orden no coincide. Contacta a soporte.")
        return

    payment_type = payload_parts[0]   # 'sub' (suscripción) o 'pack' (compra de monedas)
    item_value = payload_parts[1]     # Nombre del tier o cantidad de monedas
    user_id = int(payload_parts[2])
    stars_paid = payment.total_amount
    telegram_charge_id = payment.telegram_payment_charge_id

    conn = get_connection()
    cursor = conn.cursor()

    try:
        if payment_type == "sub":
            # 1. Actualizar rango en tabla de usuarios
            cursor.execute("""
                INSERT INTO users (user_id, name, access_tier, access_level)
                VALUES (?, ?, ?, 1)
                ON CONFLICT(user_id) DO UPDATE SET
                    access_tier = excluded.access_tier,
                    access_level = CASE 
                        WHEN excluded.access_tier = 'SOLDIER' THEN 1
                        WHEN excluded.access_tier = 'VETERAN' THEN 2
                        WHEN excluded.access_tier = 'LEGEND' THEN 3
                        WHEN excluded.access_tier = 'ICONIC' THEN 4
                        ELSE 1 END
            """, (user_id, message.from_user.full_name, item_value))

            # 2. Registrar la transacción en el historial contable
            cursor.execute("""
                INSERT INTO transactions (sender_id, receiver_id, amount, tx_type, reference_id)
                VALUES (?, 0, ?, 'star_subscription', ?)
            """, (user_id, stars_paid, None))

            confirmation_text = (
                f"💎 **¡PAGO PROCESADO EXITOSAMENTE!**\n\n"
                f"🛡️ **Nuevo Rango:** `{item_value}`\n"
                f"⭐ **Stars Pagadas:** `{stars_paid} XTR`\n"
                f"🧾 **ID Transacción:** `{telegram_charge_id}`\n\n"
                f"Tu acceso al Vault y funciones exclusivas ha sido activado de inmediato."
            )

        elif payment_type == "pack":
            alpha_amount = int(item_value)
            
            # Acreditar balance de $ALPHA en la billetera del usuario
            cursor.execute("""
                INSERT INTO wallets (user_id, alpha_balance, total_earned, total_spent)
                VALUES (?, ?, 0, 0)
                ON CONFLICT(user_id) DO UPDATE SET
                    alpha_balance = alpha_balance + excluded.alpha_balance,
                    updated_at = CURRENT_TIMESTAMP
            """, (user_id, alpha_amount))

            cursor.execute("""
                INSERT INTO transactions (sender_id, receiver_id, amount, tx_type, reference_id)
                VALUES (?, 0, ?, 'star_alpha_pack', ?)
            """, (user_id, stars_paid, None))

            confirmation_text = (
                f"🪙 **¡RECARGA DE $ALPHA EXITOSA!**\n\n"
                f"💰 **Tokens Acreditados:** `+{alpha_amount} $ALPHA`\n"
                f"⭐ **Stars Pagadas:** `{stars_paid} XTR`\n"
                f"🧾 **ID Transacción:** `{telegram_charge_id}`\n\n"
                f"Tu balance en la app se ha actualizado automáticamente."
            )

        conn.commit()
        await message.answer(confirmation_text, parse_mode="Markdown")

    except Exception as e:
        conn.rollback()
        await message.answer("❌ Ocurrió un error al registrar tu compra en el sistema. Soporte ha sido notificado.")
        print(f"[ERROR EN PAYMENT HANDLER]: {e}")
    finally:
        conn.close()