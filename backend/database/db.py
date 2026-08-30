import os
import sqlite3
from sqlalchemy import create_engine, text
from sqlalchemy.orm import declarative_base, sessionmaker

DB_NAME = "database.db"
DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite:///./{DB_NAME}")

# Conexión directa SQLite para compatibilidad con routers existentes
def get_connection():
    conn = sqlite3.connect(DB_NAME)
    conn.row_factory = sqlite3.Row
    return conn

# Compatibilidad para cadenas de conexión en Railway (postgres:// -> postgresql://)
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}

engine = create_engine(
    DATABASE_URL,
    connect_args=connect_args,
    pool_pre_ping=True,
    pool_recycle=300 if not DATABASE_URL.startswith("sqlite") else -1
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def init_db():
    import database.models
    # 1. Crear tablas si no existen
    Base.metadata.create_all(bind=engine)

    # 2. Migración forzada a BIGINT con transacciones independientes
    if "postgresql" in DATABASE_URL:
        migrations = [
            "ALTER TABLE users ALTER COLUMN user_id TYPE BIGINT;",
            "ALTER TABLE wallets ALTER COLUMN user_id TYPE BIGINT;",
            "ALTER TABLE transactions ALTER COLUMN sender_id TYPE BIGINT;",
            "ALTER TABLE transactions ALTER COLUMN receiver_id TYPE BIGINT;",
            "ALTER TABLE posts ALTER COLUMN creator_id TYPE BIGINT;",
            "ALTER TABLE unlocked_posts ALTER COLUMN user_id TYPE BIGINT;"
        ]
        for query in migrations:
            try:
                with engine.begin() as conn:
                    conn.execute(text(query))
            except Exception as e:
                print(f"[MIGRATION NOTICE]: {e}")