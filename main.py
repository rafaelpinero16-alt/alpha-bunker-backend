import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

# Importamos nuestros módulos independientes (incluyendo videocalls)
from routers import payments, users, posts, wallet, telegram, videocalls
from database.db import init_db
from core.config import bot

# Configuramos el ciclo de vida para inicializar el búnker de forma limpia
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Inicializa la base de datos
    init_db()
    
    # Creamos la carpeta de subidas si no existe (para guardar las fotos de perfil y posts reales)
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

# Habilitamos la lectura pública de la carpeta de imágenes para que la Mini App pueda mostrarlas
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