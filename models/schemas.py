from pydantic import BaseModel, Field

# Esquema de seguridad estricto para validar los datos de pago
class InvoiceRequest(BaseModel):
    user_id: int
    tier_name: str
    amount_stars: int

# NUEVO: Guardia de seguridad para proteger la edición de perfiles
class ProfileUpdate(BaseModel):
    user_id: int
    name: str = Field(..., max_length=50)
    bio: str = Field(..., max_length=150)