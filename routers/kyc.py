from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from database.db import get_db
from database.models import User

router = APIRouter(prefix="/kyc", tags=["KYC Verificación"])

class KYCSubmitSchema(BaseModel):
    user_id: int
    legal_name: str
    document_base64: str
    selfie_base64: str

@router.get("/status/{user_id}")
def get_kyc_status(user_id: int, db: Session = Depends(get_db)):
    # Bypass total para el Admin Maestro o cuentas autorizadas
    ADMIN_ID = 8269470905
    user = db.query(User).filter(User.user_id == user_id).first()
    
    if user_id == ADMIN_ID or (user and user.role == "admin"):
        return {"status": "success", "kyc_status": "verified", "role": "admin"}
        
    if not user:
        return {"status": "success", "kyc_status": "unverified", "role": "fan"}
        
    return {
        "status": "success",
        "kyc_status": getattr(user, "kyc_status", "verified"),
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