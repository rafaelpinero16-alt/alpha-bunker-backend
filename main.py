import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Importamos nuestros módulos independientes (incluyendo routers adicionales si los hay)
from routers import payments, users
# Si tienes un archivo de posts u otro router, puedes descomentar la siguiente línea:
# from routers import posts
from database.db import init_db
from core.config import bot, dp

# Configuramos el ciclo de vida para encender el bot y limpiar webhooks en segundo plano
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Inicializa la base de datos
    init_db()
    # Elimina cualquier webhook anterior de Telegram para evitar conflictos con el polling
    await bot.delete_webhook(drop_pending_updates=True)
    # Pone a Aiogram a escuchar los pagos y eventos de Telegram
    bot_task = asyncio.create_task(dp.start_polling(bot))
    yield
    # Detiene el bot limpiamente al apagar el servidor
    bot_task.cancel()

app = FastAPI(title="Alpha Tom Vault API", lifespan=lifespan)

# Configuración de CORS para permitir la conexión libre
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Conexión de las rutas (Endpoints)
app.include_router(payments.router)
app.include_router(users.router)  # Ruta conectada para guardar perfiles y biografías
# app.include_router(posts.router)  # Descomenta si deseas habilitar los posts en el Swagger

@app.get("/")
def read_root():
    return {"status": "Búnker Backend Modular Online 🚀", "author": "Master Tom"}