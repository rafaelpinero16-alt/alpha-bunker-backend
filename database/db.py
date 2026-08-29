import os
import sqlite3
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from database.models import Base

# Definimos la ruta para el archivo SQLite local en la carpeta database
DB_PATH = os.path.join(os.path.dirname(__file__), "bunker.db")
DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite:///{DB_PATH}")

# Motor de conexión SQLAlchemy para la nueva arquitectura (Wallet/Alfa Coins)
engine = create_engine(
    DATABASE_URL, 
    connect_args={"check_same_thread": False} if "sqlite" in DATABASE_URL else {}
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def init_db():
    """Inicializa la base de datos unificada (Nuevas tablas de APK y tabla antigua)"""
    # 1. Tabla original del bot (Para no romper payments.py ni users.py)
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            user_id INTEGER PRIMARY KEY,
            access_tier TEXT,
            stars_spent INTEGER DEFAULT 0,
            name TEXT DEFAULT 'VISITOR',
            bio TEXT DEFAULT ''
        )
    ''')
    conn.commit()
    conn.close()

    # 2. Tablas de SQLAlchemy (Wallets, Transactions y Users del APK)
    Base.metadata.create_all(bind=engine)

def get_db():
    """Provee una sesión de base de datos segura por cada petición HTTP para la Wallet"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# --- FUNCIONES ORIGINALES RESTAURADAS PARA TUS ROUTERS ACTUALES ---

def update_user_tier(user_id: int, tier: str, amount: int):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute('''
        INSERT INTO users (user_id, access_tier, stars_spent)
        VALUES (?, ?, ?)
        ON CONFLICT(user_id) DO UPDATE SET 
            access_tier = excluded.access_tier,
            stars_spent = users.stars_spent + excluded.stars_spent
    ''', (user_id, tier, amount))
    conn.commit()
    conn.close()

def update_user_profile(user_id: int, name: str, bio: str):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute('''
        UPDATE users 
        SET name = ?, bio = ?
        WHERE user_id = ?
    ''', (name, bio, user_id))
    conn.commit()
    conn.close()