from fastapi import APIRouter, HTTPException
from models.schemas import ProfileUpdate
from database.db import update_user_profile

# Inicializamos el enrutador para el módulo de usuarios
router = APIRouter()

@router.post("/update-profile")
async def update_profile(data: ProfileUpdate):
    try:
        # Ejecutamos la función de la base de datos para guardar los cambios
        update_user_profile(user_id=data.user_id, name=data.name, bio=data.bio)
        
        return {
            "status": "success", 
            "message": f"El perfil de {data.name} ha sido blindado en el Vault."
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))