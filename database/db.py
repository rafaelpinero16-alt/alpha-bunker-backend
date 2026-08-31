import os
import sqlite3
from sqlalchemy import create_engine, text
from sqlalchemy.orm import declarative_base, sessionmaker

DB_NAME = "database.db"
DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite:///./{DB_NAME}")

# Conexión directa SQLite para compatibilidad
def get_connection():
    conn = sqlite3.connect(DB_NAME)
    conn.row_factory = sqlite3.Row
    return conn

# Compatibilidad para conexiones en Railway (postgres:// -> postgresql://)
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
    from database.models import Package

    # 1. Crear tablas si no existen
    Base.metadata.create_all(bind=engine)

    # 2. Migración a BIGINT con transacciones aisladas
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

    # 3. Sembrado inicial de paquetes de tokens $ALPHA
    db = SessionLocal()
    try:
        if db.query(Package).count() == 0:
            default_packages = [
                Package(
                    slug="starter",
                    name="Starter Spy",
                    description="Acceso inicial al Búnker",
                    alpha_base=50,
                    bonus_percentage=0,
                    alpha_total=50,
                    price_stars=250,
                    price_ton=1,
                    badge="🕵️ Recluta"
                ),
                Package(
                    slug="agent",
                    name="Agent Pack",
                    description="Bonificación +20%",
                    alpha_base=100,
                    bonus_percentage=20,
                    alpha_total=120,
                    price_stars=500,
                    price_ton=2,
                    badge="🎖️ Agent"
                ),
                Package(
                    slug="combat",
                    name="Combat Pack",
                    description="Bonificación +30%",
                    alpha_base=250,
                    bonus_percentage=30,
                    alpha_total=325,
                    price_stars=1150,
                    price_ton=5,
                    badge="⚔️ Veteran"
                ),
                Package(
                    slug="boss",
                    name="Bunker Boss",
                    description="Bonificación +45%",
                    alpha_base=600,
                    bonus_percentage=45,
                    alpha_total=870,
                    price_stars=2600,
                    price_ton=10,
                    badge="👑 Boss"
                ),
                Package(
                    slug="whale",
                    name="Whale VIP",
                    description="Bonificación máxima +65%",
                    alpha_base=1500,
                    bonus_percentage=65,
                    alpha_total=2475,
                    price_stars=6000,
                    price_ton=24,
                    badge="💎 Whale"
                )
            ]
            db.add_all(default_packages)
            db.commit()
            print("[DB SEED]: Paquetes de tokens $ALPHA registrados exitosamente.")
    except Exception as e:
        db.rollback()
        print(f"[DB SEED ERROR]: {e}")
    finally:
        db.close()