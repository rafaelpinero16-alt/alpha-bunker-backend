import os
from dotenv import load_dotenv

# Cargar variables de entorno antes de importar módulos que las necesiten
load_dotenv()

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

# Importamos todos los módulos independientes
from routers import payments, users, posts, wallet, telegram, videocalls, kyc, chat
from database.db import init_db, SessionLocal
from database.seed import seed_tactical_packages

# Asegurar que la carpeta uploads exista antes de montar la ruta estática
os.makedirs("uploads", exist_ok=True)

@asynccontextmanager
async def lifespan(app: FastAPI):
    print("[SERVER] Iniciando secuencias de arranque del Búnker...")
    # Inicializa la base de datos
    init_db()

    # Sembrado automático de los paquetes tácticos de $ALPHA
    db = SessionLocal()
    try:
        seed_tactical_packages(db)
        print("[SERVER] Base de datos y paquetes tácticos sincronizados correctamente.")
    except Exception as e:
        print(f"[SEED ERROR] Error al sembrar los paquetes: {e}")
    finally:
        db.close()

    yield
    print("[SERVER] Apagando el ecosistema del Búnker...")

app = FastAPI(title="Alpha Tom Vault API", lifespan=lifespan)

# Configuración de CORS para permitir la conexión con el frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Habilitamos la lectura pública de la carpeta de imágenes
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

# Conexión de todas las Rutas y Endpoints del Ecosistema
app.include_router(payments.router)
app.include_router(users.router)
app.include_router(posts.router)
app.include_router(wallet.router)    # Módulo financiero $ALPHA y Propinas
app.include_router(telegram.router)  # Módulo de Webhook seguro para Telegram
app.include_router(videocalls.router)# Módulo de Videollamadas Privadas Cam2Cam
app.include_router(kyc.router)       # Módulo de Verificación de Identidad (+18)
app.include_router(chat.router)      # Módulo de WebSockets para CRM y Chat Global

@app.get("/")
def read_root():
    return {"status": "Búnker Backend Modular Online 🚀", "author": "Master Tom"}