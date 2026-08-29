from datetime import datetime
from decimal import Decimal
from sqlalchemy import Column, DateTime, ForeignKey, Numeric, String, UniqueConstraint
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship

Base = declarative_base()

class User(Base):
    __tablename__ = "vault_users"  # <--- ¡Nombre cambiado para no chocar con el bot!

    id = Column(String(36), primary_key=True)
    email = Column(String(255), unique=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(50), default="Fan")
    kyc_status = Column(String(50), default="Pending")
    contact_info = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    wallet = relationship("Wallet", back_populates="user", uselist=False)

class Wallet(Base):
    __tablename__ = "wallets"

    id = Column(String(36), primary_key=True)
    user_id = Column(String(36), ForeignKey("vault_users.id"), unique=True, nullable=False)
    balance_alfa_coins = Column(Numeric(precision=18, scale=4), default=Decimal('0.0000'), nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", back_populates="wallet")

class Transaction(Base):
    __tablename__ = "transactions"

    id = Column(String(36), primary_key=True)
    sender_id = Column(String(36), ForeignKey("vault_users.id"), nullable=False)
    receiver_id = Column(String(36), ForeignKey("vault_users.id"), nullable=True)
    alfa_coins = Column(Numeric(precision=18, scale=4), nullable=False)
    gateway = Column(String(50), nullable=False)
    tx_id = Column(String(255), unique=True, nullable=False)
    status = Column(String(50), default="Pending")
    timestamp = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint('tx_id', name='uq_transaction_tx_id'),
    )