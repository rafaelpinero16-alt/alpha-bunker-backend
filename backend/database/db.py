import sqlite3

DB_NAME = "database.db"

def get_connection():
    conn = sqlite3.connect(DB_NAME)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_connection()
    cursor = conn.cursor()
    
    # 1. Tabla de Usuarios y Perfiles
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            user_id INTEGER PRIMARY KEY,
            name TEXT,
            bio TEXT,
            access_tier TEXT DEFAULT 'FREE',
            access_level INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    ''')

    # 2. Tabla de Billeteras y Balance de $ALPHA
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS wallets (
            user_id INTEGER PRIMARY KEY,
            alpha_balance INTEGER DEFAULT 0,
            total_earned INTEGER DEFAULT 0,
            total_spent INTEGER DEFAULT 0,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(user_id)
        )
    ''')

    # 3. Tabla de Transacciones y Propinas (Historial de movimientos)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS transactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            sender_id INTEGER,
            receiver_id INTEGER,
            amount INTEGER NOT NULL,
            tx_type TEXT NOT NULL, -- 'tip', 'ppv_unlock', 'recharge', 'sub_payment'
            reference_id INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    ''')

    # 4. Tabla de Contenido Desbloqueado por Usuario (PPV)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS unlocked_posts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            post_id INTEGER NOT NULL,
            unlocked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(user_id, post_id)
        )
    ''')

    # 5. Tabla de Publicaciones Globales
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS posts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            author TEXT,
            levelRequired INTEGER,
            text_es TEXT,
            image_url TEXT,
            is_ppv BOOLEAN DEFAULT 0,
            price_alpha INTEGER DEFAULT 0,
            date_created DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    conn.commit()
    conn.close()