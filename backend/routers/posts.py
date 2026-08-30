import os
import time
import shutil
import sqlite3
from fastapi import APIRouter, UploadFile, File, Form, HTTPException

router = APIRouter(tags=["Posts Globales"])

# Conexión directa a la base de datos
def get_db_connection():
    # Asumimos que tu base local se llama database.db (ajusta si le pusiste otro nombre en db.py)
    conn = sqlite3.connect("database.db")
    conn.row_factory = sqlite3.Row
    return conn

@router.post("/create-post")
async def create_post(
    author: str = Form(...),
    levelRequired: int = Form(...),
    text_es: str = Form(...),
    image: UploadFile = File(None)
):
    image_url = None
    
    # 1. Procesar y guardar la imagen física en el servidor de Railway
    if image and image.filename:
        filename = f"{int(time.time())}_{image.filename.replace(' ', '_')}"
        filepath = os.path.join("uploads", filename)
        
        with open(filepath, "wb") as buffer:
            shutil.copyfileobj(image.file, buffer)
            
        # Generar el enlace público para que Netlify pueda leer la foto
        image_url = f"https://alpha-bunker-backend-production.up.railway.app/uploads/{filename}"

    # 2. Inyectar la publicación en la Base de Datos
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Crea la tabla automáticamente si es la primera vez que se publica algo
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS posts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            author TEXT,
            levelRequired INTEGER,
            text_es TEXT,
            image_url TEXT,
            date_created DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    try:
        cursor.execute('''
            INSERT INTO posts (author, levelRequired, text_es, image_url)
            VALUES (?, ?, ?, ?)
        ''', (author, levelRequired, text_es, image_url))
        conn.commit()
        post_id = cursor.lastrowid
    except Exception as e:
        conn.close()
        raise HTTPException(status_code=500, detail=f"Error interno: {str(e)}")
        
    conn.close()
    
    return {
        "message": "Publicación subida al Muro Comunitario 🚀", 
        "post_id": post_id, 
        "image_url": image_url
    }

@router.get("/get-posts")
async def get_all_posts():
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        cursor.execute("SELECT * FROM posts ORDER BY id DESC")
        rows = cursor.fetchall()
        posts = [dict(row) for row in rows]
    except Exception:
        posts = [] # Si la tabla aún no existe, envía el muro vacío sin tumbar la app
        
    conn.close()
    return {"posts": posts}