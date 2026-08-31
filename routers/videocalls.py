from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from database.db import get_db
from database.models import User, Wallet, VideoCallSession, Transaction

router = APIRouter(prefix="/videocalls", tags=["Videollamadas Cam2Cam"])

class VideoCallRequest(BaseModel):
    fan_id: int
    creator_id: int
    cost_alpha: int

class ActionCallRequest(BaseModel):
    session_id: int
    creator_id: int
    action: str  # 'accept' o 'reject'

@router.post("/request")
def request_video_call(data: VideoCallRequest, db: Session = Depends(get_db)):
    try:
        # 1. Validar que existan fan y creador[cite: 6]
        fan = db.query(User).filter(User.user_id == data.fan_id).first()
        creator = db.query(User).filter(User.user_id == data.creator_id).first()
        
        if not fan or not creator:
            raise HTTPException(status_code=404, detail="Usuario o creador no encontrado.")

        # 2. Validar saldo del fan[cite: 6]
        fan_wallet = db.query(Wallet).filter(Wallet.user_id == data.fan_id).first()
        if not fan_wallet or fan_wallet.alpha_balance < data.cost_alpha:
            raise HTTPException(status_code=400, detail="Saldo insuficiente en $ALPHA para solicitar la videollamada.")

        # 3. Retener saldo temporalmente y registrar sesión[cite: 6]
        fan_wallet.alpha_balance -= data.cost_alpha
        fan_wallet.total_spent += data.cost_alpha

        new_session = VideoCallSession(
            fan_id=data.fan_id,
            creator_id=data.creator_id,
            cost_alpha=data.cost_alpha,
            status="pending",
            room_url=f"https://bunker-video.alpha/room_{data.fan_id}_{data.creator_id}"
        )
        db.add(new_session)

        # 4. Registrar la transacción inicial[cite: 6]
        tx = Transaction(
            sender_id=data.fan_id,
            receiver_id=data.creator_id,
            amount=data.cost_alpha,
            tx_type="videocall_hold"
        )
        db.add(tx)
        db.commit()
        db.refresh(new_session)

        return {
            "status": "success",
            "message": "Solicitud de videollamada enviada con éxito.",
            "session_id": new_session.id,
            "room_url": new_session.room_url
        }

    except HTTPException as http_exc:
        raise http_exc
    except Exception as e:
        db.rollback()
        print(f"[VIDEOCALL ERROR]: {e}")
        raise HTTPException(status_code=500, detail="Error interno al procesar la solicitud de videollamada.")

@router.post("/respond")
def respond_video_call(data: ActionCallRequest, db: Session = Depends(get_db)):
    try:
        # 1. Buscar la sesión de videollamada pendiente
        session = db.query(VideoCallSession).filter(
            VideoCallSession.id == data.session_id,
            VideoCallSession.creator_id == data.creator_id,
            VideoCallSession.status == "pending"
        ).first()

        if not session:
            raise HTTPException(status_code=404, detail="Sesión de videollamada no encontrada o ya procesada.")

        # 2. Si el creador RECHAZA la llamada
        if data.action == "reject":
            session.status = "rejected"
            
            # Devolver los tokens retenidos al fan
            fan_wallet = db.query(Wallet).filter(Wallet.user_id == session.fan_id).first()
            if fan_wallet:
                fan_wallet.alpha_balance += session.cost_alpha
                fan_wallet.total_spent -= session.cost_alpha
                
            # Registrar transacción de reembolso
            tx = Transaction(
                sender_id=session.creator_id,
                receiver_id=session.fan_id,
                amount=session.cost_alpha,
                tx_type="videocall_refund"
            )
            db.add(tx)
            db.commit()
            
            return {"status": "success", "message": "Videollamada rechazada y tokens devueltos al fan."}

        # 3. Si el creador ACEPTA la llamada
        elif data.action == "accept":
            session.status = "accepted"

            # Abonar los tokens definitivamente a la billetera del creador
            creator_wallet = db.query(Wallet).filter(Wallet.user_id == data.creator_id).first()
            if not creator_wallet:
                creator_wallet = Wallet(user_id=data.creator_id, alpha_balance=0)
                db.add(creator_wallet)

            creator_wallet.alpha_balance += session.cost_alpha
            creator_wallet.total_earned += session.cost_alpha

            # Registrar transacción finalizada de pago al creador
            tx = Transaction(
                sender_id=session.fan_id,
                receiver_id=data.creator_id,
                amount=session.cost_alpha,
                tx_type="videocall_completed",
                reference_id=session.id
            )
            db.add(tx)
            db.commit()

            return {
                "status": "success",
                "message": "Videollamada aceptada. Fondos liberados y sala abierta.",
                "room_url": session.room_url
            }
        else:
            raise HTTPException(status_code=400, detail="Acción no válida. Usa 'accept' o 'reject'.")

    except HTTPException as http_exc:
        raise http_exc
    except Exception as e:
        db.rollback()
        print(f"[VIDEOCALL RESPONSE ERROR]: {e}")
        raise HTTPException(status_code=500, detail="Error interno al responder la videollamada.")