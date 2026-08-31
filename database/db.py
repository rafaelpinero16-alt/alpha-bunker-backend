import os
import sqlite3
from sqlalchemy import create_engine, text
from sqlalchemy.orm import declarative_base, sessionmaker

DB_NAME = "database.db"
DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite:///./{DB_NAME}")

def get_connection():
    conn = sqlite3.connect(DB_NAME)
    conn.row_factory = sqlite3.Row
    return conn

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
    from database.models import Package
    Base.metadata.create_all(bind=engine)
    
    db = SessionLocal()
    try:
        # Sincronizamos y actualizamos los paquetes oficiales con la nueva nomenclatura y precios ajustados
        db.query(Package).delete()
        db.add_all([
            Package(
                slug="soldier", 
                name="Soldier (Tier 1)", 
                description="Acceso inicial, contenido básico y chat general", 
                alpha_base=150, bonus_percentage=0, alpha_total=150, 
                price_stars=750, price_ton=1, badge="🎖️ Soldier"
            ),
            Package(
                slug="veteran", 
                name="Veteran (Tier 2)", 
                description="Chat privado CRM, permisos en muro y bono +10%", 
                alpha_base=300, bonus_percentage=10, alpha_total=330, 
                price_stars=1500, price_ton=2, badge="⚔️ Veteran"
            ),
            Package(
                slug="legend", 
                name="Legend (Tier 3)", 
                description="Acceso Elite completo, videollamadas Cam2Cam y bono +18%", 
                alpha_base=550, bonus_percentage=18, alpha_total=650, 
                price_stars=2750, price_ton=5, badge="👑 Legend"
            ),
            Package(
                slug="icon_legend", 
                name="Icon Legend (Tier 4)", 
                description="Publica fotos, videos, mensajes y activa cámara en videollamada grupal", 
                alpha_base=1200, bonus_percentage=25, alpha_total=1500, 
                price_stars=6000, price_ton=12, badge="💎 Icon Legend"
            )
        ])
        db.commit()
        print("[DB SEED]: Paquetes oficiales con rangos y precios coherentes registrados exitosamente.")
    except Exception as e:
        db.rollback()
        print(f"[DB SEED ERROR]: {e}")
    finally:
        db.close()