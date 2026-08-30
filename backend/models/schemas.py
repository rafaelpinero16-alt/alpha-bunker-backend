from pydantic import BaseModel, Field
from typing import Optional

# 1. Esquema para generación de facturas en Telegram Stars
class InvoiceRequest(BaseModel):
    user_id: int
    tier_name: str = Field(..., description="Nombre del rango (SOLDIER, VETERAN, LEGEND, ICONIC) o pack de monedas")
    amount_stars: int = Field(..., gt=0, description="Monto en Telegram Stars (mínimo 1 XTR)")

# 2. Esquema para transacciones de propinas en $ALPHA
class TipRequest(BaseModel):
    sender_id: int
    receiver_id: int
    amount: int = Field(..., gt=0, description="Cantidad de tokens $ALPHA a transferir")
    post_id: Optional[int] = None

# 3. Esquema para desbloqueo de publicaciones Pay-Per-View (PPV)
class UnlockPostRequest(BaseModel):
    user_id: int
    post_id: int

# 4. Esquema para creación de publicaciones en el muro global
class PostCreateRequest(BaseModel):
    author: str
    text_es: str
    image_url: Optional[str] = None
    level_required: int = Field(default=0, ge=0, le=4)
    is_ppv: bool = False
    price_alpha: int = Field(default=0, ge=0)

# 5. Esquema para actualización de perfil de usuario
class UserProfileUpdate(BaseModel):
    name: Optional[str] = None
    bio: Optional[str] = None