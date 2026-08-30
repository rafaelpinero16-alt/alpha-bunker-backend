from datetime import datetime
from sqlalchemy import Column, Integer, BigInteger, String, Boolean, DateTime, Text
from database.db import Base

class User(Base):
    __tablename__ = "users"

    user_id = Column(BigInteger, primary_key=True, index=True)
    name = Column(String(255), nullable=True, default="USER")
    bio = Column(Text, nullable=True)
    role = Column(String(50), default="fan")  # "fan" o "creator"
    access_tier = Column(String(50), default="FREE")
    access_level = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)

    # 🛡️ CAMPOS DE VERIFICACIÓN BÚNKER KYC (+18)
    kyc_status = Column(String(50), default="unverified")  # "unverified", "pending", "verified", "rejected"
    legal_name = Column(String(255), nullable=True)
    is_adult = Column(Boolean, default=False)
    document_url = Column(Text, nullable=True)
    selfie_url = Column(Text, nullable=True)
    kyc_submitted_at = Column(DateTime, nullable=True)
    kyc_verified_at = Column(DateTime, nullable=True)

class Wallet(Base):
    __tablename__ = "wallets"

    user_id = Column(BigInteger, primary_key=True, index=True)
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
    creator_id = Column(BigInteger, nullable=True, index=True)
    author = Column(String(255), nullable=True, default="mastertom")
    levelRequired = Column(Integer, default=0)
    text_es = Column(Text, nullable=True)
    image_url = Column(Text, nullable=True)
    is_ppv = Column(Boolean, default=False)
    price_alpha = Column(Integer, default=0)
    date_created = Column(DateTime, default=datetime.utcnow)

class UnlockedPost(Base):
    __tablename__ = "unlocked_posts"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(BigInteger, nullable=False)
    post_id = Column(Integer, nullable=False)
    unlocked_at = Column(DateTime, default=datetime.utcnow)