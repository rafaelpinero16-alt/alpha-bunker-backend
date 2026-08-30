from fastapi import APIRouter

router = APIRouter(
    prefix="/wallet",
    tags=["Wallet"]
)

@router.get("/")
async def get_wallet_info():
    return {"status": "success", "message": "Alpha Wallet operando al 100%"}