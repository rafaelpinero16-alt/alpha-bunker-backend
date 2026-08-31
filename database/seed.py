from sqlalchemy.orm import Session
from database.models import Package

def seed_tactical_packages(db: Session):
    """
    Registra o actualiza los 5 packs tácticos oficiales de $ALPHA 
    con sus bonificaciones por volumen y precios en TON/Stars.
    """
    packages_data = [
        {
            "slug": "spy",
            "name": "SPY (Reconocimiento)",
            "description": "Pack base de reconocimiento operativo.",
            "alpha_base": 100,
            "bonus_percentage": 0,
            "alpha_total": 100,
            "price_stars": 100,
            "price_ton": 1.0,
            "badge": "SPY 🕵️"
        },
        {
            "slug": "soldier",
            "name": "SOLDIER (Infantería)",
            "description": "Pack táctico con +5% de bonificación por volumen.",
            "alpha_base": 333,
            "bonus_percentage": 5,
            "alpha_total": 350,
            "price_stars": 350,
            "price_ton": 3.2,
            "badge": "SOLDIER 🎖️"
        },
        {
            "slug": "veteran",
            "name": "VETERAN (Táctico)",
            "description": "Pack avanzado con +10% de bonificación.",
            "alpha_base": 727,
            "bonus_percentage": 10,
            "alpha_total": 800,
            "price_stars": 800,
            "price_ton": 7.0,
            "badge": "VETERAN ⚔️"
        },
        {
            "slug": "legend",
            "name": "LEGEND (Comandante)",
            "description": "Pack de élite con +15% de bonificación.",
            "alpha_base": 1565,
            "bonus_percentage": 15,
            "alpha_total": 1800,
            "price_stars": 1800,
            "price_ton": 15.0,
            "badge": "LEGEND 👑"
        },
        {
            "slug": "icon-legend",
            "name": "ICON LEGEND (General Supremo)",
            "description": "Pack supremo con +25% de bonificación máxima y acceso total.",
            "alpha_base": 3200,
            "bonus_percentage": 25,
            "alpha_total": 4000,
            "price_stars": 4000,
            "price_ton": 30.0,
            "badge": "ICON LEGEND 💎"
        }
    ]
    
    for pkg in packages_data:
        existing = db.query(Package).filter(Package.slug == pkg["slug"]).first()
        if not existing:
            db.add(Package(**pkg))
            print(f"📦 [SEED] Pack táctico creado: {pkg['name']}")
        else:
            existing.alpha_total = pkg["alpha_total"]
            existing.price_ton = pkg["price_ton"]
            existing.price_stars = pkg["price_stars"]
            existing.bonus_percentage = pkg["bonus_percentage"]
            print(f"🔄 [SEED] Pack táctico actualizado: {pkg['name']}")
            
    db.commit()