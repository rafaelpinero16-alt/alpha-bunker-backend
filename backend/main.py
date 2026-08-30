import asyncio
import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from routers import payments, users, posts, wallet, kyc
from database.db import init_db
from core.config import bot, dp

os.makedirs("uploads", exist_ok=True)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # 1. Inicializar tablas en la base de datos
    try:
        init_db()
    except Exception as e:
        print(f"[DB INIT ERROR]: {e}")

    # 2. Asegurar existencia de carpeta uploads
    os.makedirs("uploads", exist_ok=True)
        
    # 3. Limpiar webhook residual en Telegram y purgar actualizaciones pendientes
    try:
        await bot.delete_webhook(drop_pending_updates=True)
    except Exception as e:
        print(f"[TG WEBHOOK CLEANUP ERROR]: {e}")

    # 4. Iniciar Polling de Aiogram como tarea en segundo plano
    bot_task = asyncio.create_task(dp.start_polling(bot))
    yield
    # 5. Cierre limpio al apagar el contenedor
    bot_task.cancel()
    try:
        await bot.session.close()
    except Exception:
        pass

app = FastAPI(
    title="Alpha Tom Vault API",
    description="Backend API Modular con soporte KYC, Wallet TON, Muro de Publicaciones y Pagos",
    version="1.0.0",
    lifespan=lifespan
)

# Configuración de CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Montaje de archivos estáticos
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

# Conexión de rutas
app.include_router(payments.router)
app.include_router(users.router)
app.include_router(posts.router)
app.include_router(wallet.router)
app.include_router(kyc.router)

@app.get("/")
def read_root():
    return {"status": "Búnker Backend Modular Online 🚀", "author": "Master Tom"}