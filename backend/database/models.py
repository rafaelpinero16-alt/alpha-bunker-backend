from datetime import datetime
from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey
from database.db import Base

class User(Base):
    __tablename__ = "users"

    user_id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=True)
    bio = Column(String, nullable=True)
    access_tier = Column(String, default="FREE")
    access_level = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)

class Wallet(Base):
    __tablename__ = "wallets"

    user_id = Column(Integer, primary_key=True, index=True)
    alpha_balance = Column(Integer, default=0)
    total_earned = Column(Integer, default=0)
    total_spent = Column(Integer, default=0)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class Transaction(Base):
    __tablename__ = "transactions"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    sender_id = Column(Integer, nullable=True)
    receiver_id = Column(Integer, nullable=True)
    amount = Column(Integer, nullable=False)
    tx_type = Column(String, nullable=False)
    reference_id = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class Post(Base):
    __tablename__ = "posts"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    author = Column(String, nullable=True)
    levelRequired = Column(Integer, default=0)
    text_es = Column(String, nullable=True)
    image_url = Column(String, nullable=True)
    is_ppv = Column(Boolean, default=False)
    price_alpha = Column(Integer, default=0)
    date_created = Column(DateTime, default=datetime.utcnow)

class UnlockedPost(Base):
    __tablename__ = "unlocked_posts"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, nullable=False)
    post_id = Column(Integer, nullable=False)
    unlocked_at = Column(DateTime, default=datetime.utcnow)