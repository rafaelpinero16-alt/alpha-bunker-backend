import sqlite3
import os

# Definimos la ruta donde se creará el archivo de la base de datos
DB_PATH = os.path.join(os.path.dirname(__file__), "bunker.db")

def init_db():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    # Ampliamos la tabla para incluir nombre y biografía
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

# NUEVA FUNCIÓN: Guarda las ediciones del perfil que el usuario haga en la Mini App
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