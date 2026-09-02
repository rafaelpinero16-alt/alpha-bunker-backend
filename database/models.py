from sqlalchemy import Column, Integer, BigInteger, String, Boolean, DateTime, Text, ForeignKey, Float
from sqlalchemy.orm import relationship
from datetime import datetime
from database.db import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(BigInteger, unique=True, index=True, nullable=False)
    name = Column(String(100), default="USER")
    bio = Column(String(255), nullable=True)
    avatar_url = Column(Text, nullable=True)
    role = Column(String(20), default="fan")             # fan, creator, admin
    access_level = Column(Integer, default=0)            # 0: Espía, 1: Soldier, 2: Veteran, 3: Legend, 4: Icon Legend
    kyc_status = Column(String(20), default="unverified") # unverified, pending, verified, rejected
    legal_name = Column(String(150), nullable=True)
    is_adult = Column(Boolean, default=False)
    
    # 🛡️ Sistema de Sanciones
    warnings_count = Column(Integer, default=0)          # Control de faltas en el chat (Max 5)

    # 🛡️ Controles de Membresía y Creadores (Suscripciones B2B)
    is_creator = Column(Boolean, default=False)
    creator_tier = Column(String(30), default="none")            # none, soldier_creator, icon_creator
    subscription_expires_at = Column(DateTime, nullable=True)     # Controla el mes gratis y los cobros recurrentes
    can_receive_tips = Column(Boolean, default=True)             # Se bloquea si vence la membresía B2B
    
    created_at = Column(DateTime, default=datetime.utcnow)

class TipMenuSlot(Base):
    __tablename__ = "tip_menu_slots"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    creator_id = Column(BigInteger, ForeignKey("users.user_id"), index=True, nullable=False)
    slot_number = Column(Integer, nullable=False)  # Del 1 al 10 (Los 10 espacios editables del Tip Menu)
    title = Column(String(100), nullable=False)    # Ej: "Videollamada privada 5 min"
    price_alpha = Column(Integer, nullable=False)  # Costo en tokens $ALPHA
    is_active = Column(Boolean, default=True)

class Wallet(Base):
    __tablename__ = "wallets"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(BigInteger, unique=True, index=True, nullable=False)
    alpha_balance = Column(Integer, default=0)
    total_earned = Column(Integer, default=0)
    total_spent = Column(Integer, default=0)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class Transaction(Base):
    __tablename__ = "transactions"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    sender_id = Column(BigInteger, nullable=True)
    receiver_id = Column(BigInteger, nullable=True)
    amount = Column(Integer, nullable=False)
    tx_type = Column(String(50), nullable=False)        # tip, subscription, package_recharge, creator_membership
    reference_id = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class Post(Base):
    __tablename__ = "posts"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    creator_id = Column(BigInteger, index=True, nullable=False)
    author = Column(String(100), default="mastertom")
    text_es = Column(Text, nullable=True)
    image_url = Column(Text, nullable=True)
    levelRequired = Column(Integer, default=0)
    is_ppv = Column(Boolean, default=False)
    price_alpha = Column(Integer, default=0)
    date_created = Column(DateTime, default=datetime.utcnow)

class UnlockedPost(Base):
    __tablename__ = "unlocked_posts"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(BigInteger, index=True, nullable=False)
    post_id = Column(Integer, index=True, nullable=False)
    unlocked_at = Column(DateTime, default=datetime.utcnow)

class Package(Base):
    __tablename__ = "packages"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    slug = Column(String(50), unique=True, index=True, nullable=False) # spy, soldier, veteran, legend, icon-legend
    name = Column(String(100), nullable=False)
    description = Column(String(255), nullable=True)
    alpha_base = Column(Integer, nullable=False)
    bonus_percentage = Column(Integer, default=0)
    alpha_total = Column(Integer, nullable=False)
    price_stars = Column(Integer, nullable=False)
    price_ton = Column(Float, nullable=False)                     
    badge = Column(String(50), nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(BigInteger, ForeignKey("users.user_id"), index=True, nullable=False)
    author_name = Column(String(100), nullable=False)
    author_role = Column(String(20), default="fan")  
    access_level = Column(Integer, default=0)        
    content = Column(Text, nullable=False)
    is_system = Column(Boolean, default=False)       
    created_at = Column(DateTime, default=datetime.utcnow)

class VideoCallSession(Base):
    __tablename__ = "video_call_sessions"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    fan_id = Column(BigInteger, ForeignKey("users.user_id"), index=True, nullable=False)
    creator_id = Column(BigInteger, ForeignKey("users.user_id"), index=True, nullable=False)
    cost_alpha = Column(Integer, nullable=False)
    status = Column(String(20), default="pending")  
    room_url = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)