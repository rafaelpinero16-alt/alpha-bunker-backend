import os
import sqlite3
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

# Configuración de base de datos
DB_NAME = "database.db"
DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite:///./{DB_NAME}")

# Conexión directa SQLite (para routers existentes)
def get_connection():
    conn = sqlite3.connect(DB_NAME)
    conn.row_factory = sqlite3.Row
    return conn

# Configuración SQLAlchemy (para wallet y modelos ORM)
connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}

engine = create_engine(DATABASE_URL, connect_args=connect_args)
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
    Base.metadata.create_all(bind=engine)