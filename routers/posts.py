from fastapi import APIRouter

router = APIRouter(prefix="/posts", tags=["Posts y Contenido"])

@router.get("/")
def get_posts():
    return {"message": "Módulo de posts en línea y listo para estructurar."}