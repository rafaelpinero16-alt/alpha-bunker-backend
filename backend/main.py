import asyncio
import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

# Importación de routers modulares y base de datos
from routers import payments, users, posts, wallet, kyc[cite: 8]
from database.db import init_db[cite: 8]
from core.config import bot, dp[cite: 8]

# Asegurar existencia del directorio de archivos multimedia antes de montar la app
os.makedirs("uploads", exist_ok=True)

# Configuramos el ciclo de vida para encender el bot y limpiar webhooks en segundo plano
@asynccontextmanager
async def lifespan(app: FastAPI):
    # 1. Inicializar tablas en la base de datos
    try:
        init_db()[cite: 8]
    except Exception as e:
        print(f"[DB INIT ERROR]: {e}")

    # 2. Asegurar existencia de carpeta uploads en el contenedor
    os.makedirs("uploads", exist_ok=True)[cite: 8]
        
    # 3. Eliminar cualquier webhook residual en Telegram y purgar actualizaciones pendientes
    try:
        await bot.delete_webhook(drop_pending_updates=True)[cite: 8]
    except Exception as e:
        print(f"[TG WEBHOOK CLEANUP ERROR]: {e}")

    # 4. Iniciar Polling de Aiogram como tarea en segundo plano sin congelar FastAPI
    bot_task = asyncio.create_task(dp.start_polling(bot))[cite: 8]
    yield
    # 5. Cierre limpio al detener el contenedor
    bot_task.cancel()[cite: 8]
    try:
        await bot.session.close()
    except Exception:
        pass

app = FastAPI(
    title="Alpha Tom Vault API",
    description="Backend API Modular con soporte KYC, Wallet TON, Muro de Publicaciones y Pagos",
    version="1.0.0",
    lifespan=lifespan
)[cite: 8]

# Configuración de CORS para permitir la conexión desde Telegram Mini App y Netlify
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)[cite: 8]

# Montaje de la carpeta estática para servir fotos de perfil y multimedia de publicaciones
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")[cite: 8]

# Conexión de las rutas (Endpoints)
app.include_router(payments.router)[cite: 8]
app.include_router(users.router)[cite: 8]
app.include_router(posts.router)[cite: 8]
app.include_router(wallet.router)  # Módulo financiero $ALPHA y Propinas
app.include_router(kyc.router)     # Módulo de verificación de identidad (+18)[cite: 8]

@app.get("/")
def read_root():
    return {"status": "Búnker Backend Modular Online 🚀", "author": "Master Tom"}[cite: 8]