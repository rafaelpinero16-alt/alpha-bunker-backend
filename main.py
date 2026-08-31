import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

# Importamos nuestros módulos independientes (incluyendo videocalls)
from routers import payments, users, posts, wallet, telegram, videocalls
from database.db import init_db, SessionLocal
from database.seed import seed_tactical_packages
from core.config import bot

# Configuramos el ciclo de vida para inicializar el búnker de forma limpia
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
    # Limpieza al apagar el servidor si es necesaria

app = FastAPI(title="Alpha Tom Vault API", lifespan=lifespan)

# Configuración de CORS para permitir la conexión con Netlify
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

# Conexión de las rutas (Endpoints)
app.include_router(payments.router)
app.include_router(users.router)
app.include_router(posts.router)
app.include_router(wallet.router)    # Módulo financiero $ALPHA y Propinas
app.include_router(telegram.router)  # Módulo de Webhook seguro para Telegram
app.include_router(videocalls.router)# Módulo de Videollamadas Privadas Cam2Cam

@app.get("/")
def read_root():
    return {"status": "Búnker Backend Modular Online 🚀", "author": "Master Tom"}