import os
from aiogram import Bot, Dispatcher
from dotenv import load_dotenv

# Cargar las variables del archivo .env
load_dotenv()

# Token oficial de tu bot de Telegram
TOKEN = os.getenv("BOT_TOKEN", "8415102882:AAGmsUiDRDWZ6LCpoUSsMMwJDf9Eo5mY_PU")

# Inicializamos el Bot y el Dispatcher de forma centralizada
bot = Bot(token=TOKEN)
dp = Dispatcher()