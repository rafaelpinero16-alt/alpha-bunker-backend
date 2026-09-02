import os
import requests
import base64
from datetime import datetime, timedelta
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
    
    if not user.subscription_expires_at and user.role == "creator":
        user.subscription_expires_at = datetime.utcnow() + timedelta(days=30)
        user.creator_tier = "soldier_creator"
        user.is_creator = True
        
    db.commit()
    
    TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "") 
    ADMIN_ID = "8269470905"
    
    if TELEGRAM_BOT_TOKEN:
        try:
            def extract_b64(base64_str):
                if "," in base64_str:
                    return base64.b64decode(base64_str.split(",")[1])
                return base64.b64decode(base64_str)
            
            doc_bytes = extract_b64(data.document_base64)
            selfie_bytes = extract_b64(data.selfie_base64)
            
            requests.post(
                f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendPhoto",
                data={"chat_id": ADMIN_ID, "caption": f"🚨 NUEVO KYC (+18) 🚨\n\n👤 Usuario: {data.legal_name}\n🆔 ID: {data.user_id}\n\n📄 Documento de Identidad:"},
                files={"photo": ("doc.jpg", doc_bytes, "image/jpeg")}
            )
            
            requests.post(
                f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendPhoto",
                data={"chat_id": ADMIN_ID, "caption": f"📸 Selfie con fecha del usuario {data.user_id}.\nVerifica desde la Base de Datos para aprobar."},
                files={"photo": ("selfie.jpg", selfie_bytes, "image/jpeg")}
            )
        except Exception as e:
            print(f"[KYC TELEGRAM ERROR]: {e}")
            
    return {"status": "success", "message": "Documentos de KYC recibidos y enviados al Búnker Admin para su verificación."}