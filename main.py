import asyncio
import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

# Importamos nuestros módulos independientes
from routers import payments, users, posts, wallet
from database.db import init_db
from core.config import bot, dp

# Configuramos el ciclo de vida para encender el bot y limpiar webhooks en segundo plano
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Inicializa la base de datos
    init_db()
    
    # Creamos la carpeta de subidas si no existe (para guardar las fotos de perfil y posts reales)
    if not os.path.exists("uploads"):
        os.makedirs("uploads")
        
    # Elimina cualquier webhook anterior de Telegram para evitar conflictos con el polling
    await bot.delete_webhook(drop_pending_updates=True)
    # Pone a Aiogram a escuchar los pagos y eventos de Telegram
    bot_task = asyncio.create_task(dp.start_polling(bot))
    yield
    # Detiene el bot limpiamente al apagar el servidor
    bot_task.cancel()

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
app.include_router(wallet.router)  # Módulo financiero $ALPHA y Propinas

@app.get("/")
def read_root():
    return {"status": "Búnker Backend Modular Online 🚀", "author": "Master Tom"}