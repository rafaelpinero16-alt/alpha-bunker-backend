from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from database.db import get_connection

router = APIRouter(prefix="/users", tags=["Usuarios y Perfiles VIP"])

class UserSyncRequest(BaseModel):
    user_id: int
    name: str
    bio: Optional[str] = None

class ProfileUpdateRequest(BaseModel):
    user_id: int
    name: str
    bio: Optional[str] = None

# Mapeo oficial de insignias y rangos del Búnker
RANK_METADATA = {
    0: {"tier": "SOLDIER", "badge": "/assets/badge_0.png", "title": "Soldier Bunker"},
    1: {"tier": "VETERAN", "badge": "/assets/badge_1.png", "title": "Veteran Cyber Guard"},
    2: {"tier": "LEGEND", "badge": "/assets/badge_2.png", "title": "Legend Obsidiana"},
    3: {"tier": "ICONIC", "badge": "/assets/badge_3.png", "title": "Iconic Diamond VIP"},
    4: {"tier": "ROYAL_VIP", "badge": "/assets/badge_4.png", "title": "Master Admin & Creator"}
}

@router.post("/sync")
async def sync_user(data: UserSyncRequest):
    """
    Sincroniza o registra al usuario al ingresar desde la APK o Telegram Mini App.
    Inicializa su billetera de $ALPHA automáticamente si es un usuario nuevo.
    """
    conn = get_connection()
    cursor = conn.cursor()
    
    try:
        cursor.execute("""
            INSERT INTO users (user_id, name, bio, access_tier, access_level)
            VALUES (?, ?, ?, 'FREE', 0)
            ON CONFLICT(user_id) DO UPDATE SET
                name = excluded.name
        """, (data.user_id, data.name, data.bio or ""))
        
        cursor.execute("""
            INSERT INTO wallets (user_id, alpha_balance, total_earned, total_spent)
            VALUES (?, 0, 0, 0)
            ON CONFLICT(user_id) DO NOTHING
        """, (data.user_id,))
        
        conn.commit()
        return {"status": "success", "message": f"Usuario {data.name} sincronizado en el Vault."}
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=f"Error al sincronizar usuario: {str(e)}")
    finally:
        conn.close()


@router.get("/profile/{user_id}")
async def get_profile(user_id: int):
    """
    Obtiene el perfil completo: datos personales, rango, insignia oficial, balance de $ALPHA y permisos.
    """
    conn = get_connection()
    cursor = conn.cursor()
    
    try:
        cursor.execute("""
            SELECT u.user_id, u.name, u.bio, u.access_tier, u.access_level, u.created_at,
                   COALESCE(w.alpha_balance, 0) AS alpha_balance,
                   COALESCE(w.total_earned, 0) AS total_earned,
                   COALESCE(w.total_spent, 0) AS total_spent
            FROM users u
            LEFT JOIN wallets w ON u.user_id = w.user_id
            WHERE u.user_id = ?
        """, (user_id,))
        
        user = cursor.fetchone()
        if not user:
            raise HTTPException(status_code=404, detail="Usuario no encontrado en el Vault.")
        
        user_data = dict(user)
        level = user_data.get("access_level", 0)
        rank_info = RANK_METADATA.get(level, RANK_METADATA[0])
        
        user_data["badge_url"] = rank_info["badge"]
        user_data["rank_title"] = rank_info["title"]
        user_data["is_master"] = (level >= 4)
        
        return user_data
    except HTTPException as http_err:
        raise http_err
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al consultar perfil: {str(e)}")
    finally:
        conn.close()


@router.post("/update-profile")
async def update_profile(data: ProfileUpdateRequest):
    """
    Actualiza el nombre público y biografía del usuario con persistencia atómica.
    """
    conn = get_connection()
    cursor = conn.cursor()
    
    try:
        cursor.execute("""
            UPDATE users 
            SET name = ?, bio = ?
            WHERE user_id = ?
        """, (data.name, data.bio or "", data.user_id))
        
        if cursor.rowcount == 0:
            cursor.execute("""
                INSERT INTO users (user_id, name, bio, access_tier, access_level)
                VALUES (?, ?, ?, 'FREE', 0)
            """, (data.user_id, data.name, data.bio or ""))
        
        conn.commit()
        return {
            "status": "success", 
            "message": f"El perfil de {data.name} ha sido blindado y actualizado en el Vault."
        }
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=400, detail=f"Error al actualizar perfil: {str(e)}")
    finally:
        conn.close()