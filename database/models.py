from sqlalchemy import Column, Integer, BigInteger, String, Boolean, DateTime, Text, ForeignKey
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
    role = Column(String(20), default="fan")             
    access_level = Column(Integer, default=0)            
    kyc_status = Column(String(20), default="unverified") 
    legal_name = Column(String(150), nullable=True)
    is_adult = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

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
    tx_type = Column(String(50), nullable=False)        
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
    slug = Column(String(50), unique=True, index=True, nullable=False)
    name = Column(String(100), nullable=False)
    description = Column(String(255), nullable=True)
    alpha_base = Column(Integer, nullable=False)
    bonus_percentage = Column(Integer, default=0)
    alpha_total = Column(Integer, nullable=False)
    price_stars = Column(Integer, nullable=False)
    price_ton = Column(Integer, nullable=False)
    badge = Column(String(50), nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)