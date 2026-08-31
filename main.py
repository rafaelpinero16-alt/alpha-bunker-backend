import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

# Importamos todos los módulos independientes incluyendo kyc y chat
from routers import payments, users, posts, wallet, telegram, videocalls, kyc, chat
from database.db import init_db, SessionLocal
from database.seed import seed_tactical_packages
from core.config import bot

@asynccontextmanager
async def lifespan(app: FastAPI):
    # 1. Inicializa la base de datos
    init_db()
    
    # 2. Ejecuta el sembrado automático de los 5 packs tácticos de $ALPHA
    db = SessionLocal()
    try:
        seed_tactical_packages(db)
    except Exception as e:
        print(f"[SEED ERROR] Error al sembrar los paquetes: {e}")
    finally:
        db.close()
    
    # 3. Creamos la carpeta de subidas si no existe
    if not os.path.exists("uploads"):
        os.makedirs("uploads")
        
    yield

app = FastAPI(title="Alpha Tom Vault API", lifespan=lifespan)

# Configuración de CORS para permitir la conexión con el frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Habilitamos la lectura pública de la carpeta de imágenes
if os.path.exists("uploads"):
    app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

# Conexión de todas las Rutas y Endpoints del Ecosistema
app.include_router(payments.router)
app.include_router(users.router)
app.include_router(posts.router)
app.include_router(wallet.router)    # Módulo financiero $ALPHA y Propinas
app.include_router(telegram.router)  # Módulo de Webhook seguro para Telegram
app.include_router(videocalls.router)# Módulo de Videollamadas Privadas Cam2Cam
app.include_router(kyc.router)       # Módulo de Verificación de Identidad (+18)[cite: 21]
app.include_router(chat.router)      # Módulo de WebSockets para CRM y Chat Global[cite: 21]

@app.get("/")
def read_root():
    return {"status": "Búnker Backend Modular Online 🚀", "author": "Master Tom"}