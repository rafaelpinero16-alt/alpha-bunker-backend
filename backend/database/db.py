import os
from sqlalchemy import create_engine, text
from sqlalchemy.orm import declarative_base, sessionmaker

DB_NAME = "database.db"
DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite:///./{DB_NAME}")[cite: 8]

if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}[cite: 8]

engine = create_engine(
    DATABASE_URL,
    connect_args=connect_args,
    pool_pre_ping=True,
    pool_recycle=300 if not DATABASE_URL.startswith("sqlite") else -1
)[cite: 8]

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)[cite: 8]
Base = declarative_base()[cite: 8]

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()[cite: 8]

def init_db():
    import database.models
    # 1. Crear tablas si no existen
    Base.metadata.create_all(bind=engine)[cite: 8]

    # 2. Migración individual a BIGINT con transacciones aisladas
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