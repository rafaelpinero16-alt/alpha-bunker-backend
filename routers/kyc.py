import os
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from database.db import get_db
from database.models import User

router = APIRouter(prefix="/kyc", tags=["KYC Verificación"])

# 🔒 ID configurable por variable de entorno en vez de quemado en el código
# fuente (evita exponer el Telegram ID real del admin en el repositorio).
ADMIN_TELEGRAM_ID = int(os.getenv("ADMIN_TELEGRAM_ID", "0"))

class KYCSubmitSchema(BaseModel):
    user_id: int
    legal_name: str
    document_base64: str
    selfie_base64: str

@router.get("/status/{user_id}")
def get_kyc_status(user_id: int, db: Session = Depends(get_db)):
    # Bypass total para el Admin Maestro o cuentas autorizadas
    user = db.query(User).filter(User.user_id == user_id).first()
    
    if (ADMIN_TELEGRAM_ID and user_id == ADMIN_TELEGRAM_ID) or (user and user.role == "admin"):
        # 🔧 Antes esta rama no devolvía "name" ni "access_level": el frontend
        # (que ahora depende 100% de estos campos, sin ningún ID quemado en
        # el cliente) se quedaba sin poder pintar el rango/nombre del admin.
        return {
            "status": "success",
            "kyc_status": "verified",
            "role": "admin",
            "name": user.name if user else "Admin",
            "access_level": 4
        }
        
    if not user:
        return {"status": "success", "kyc_status": "unverified", "role": "fan", "access_level": 0}
        
    return {
        "status": "success",
        # 🔒 El valor por defecto de kyc_status DEBE ser "unverified", no
        # "verified": con el default anterior, cualquier usuario cuyo campo
        # kyc_status no estuviera seteado aparecía verificado (+18) sin haber
        # mandado documento ni selfie — anulaba el control legal de edad.
        "kyc_status": getattr(user, "kyc_status", None) or "unverified",
        "role": user.role,
        "name": user.name,
        "access_level": user.access_level
    }

@router.post("/submit")
def submit_kyc(data: KYCSubmitSchema, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.user_id == data.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado.")
    
    user.legal_name = data.legal_name
    user.kyc_status = "pending"
    db.commit()
    
    return {"status": "success", "message": "Documentos de KYC recibidos y en revisión por el Búnker Admin."}