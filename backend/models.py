import uuid
from datetime import datetime
from sqlalchemy import (
    Column, String, Float, Integer, Boolean, DateTime, ForeignKey, Table, Enum as SAEnum
)
from sqlalchemy.orm import relationship
from database import Base

# ── Junction tables ───────────────────────────────────────────────────────────

transaction_tags = Table(
    "transaction_tags",
    Base.metadata,
    Column("transaction_id", String, ForeignKey("transactions.id", ondelete="CASCADE"), primary_key=True),
    Column("tag_id", String, ForeignKey("tags.id", ondelete="CASCADE"), primary_key=True),
)

recurring_tags = Table(
    "recurring_tags",
    Base.metadata,
    Column("recurring_id", String, ForeignKey("recurring_transactions.id", ondelete="CASCADE"), primary_key=True),
    Column("tag_id", String, ForeignKey("tags.id", ondelete="CASCADE"), primary_key=True),
)

transaction_projects = Table(
    "transaction_projects",
    Base.metadata,
    Column("transaction_id", String, ForeignKey("transactions.id", ondelete="CASCADE"), primary_key=True),
    Column("project_id", String, ForeignKey("projects.id", ondelete="CASCADE"), primary_key=True),
)

split_projects = Table(
    "split_projects",
    Base.metadata,
    Column("split_id", String, ForeignKey("transaction_splits.id", ondelete="CASCADE"), primary_key=True),
    Column("project_id", String, ForeignKey("projects.id", ondelete="CASCADE"), primary_key=True),
)

# ── Models ────────────────────────────────────────────────────────────────────

class Account(Base):
    __tablename__ = "accounts"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String, nullable=False)
    type = Column(SAEnum("checking", "savings", "credit_card", "cash", "investment", name="account_type"), nullable=False)
    balance = Column(Float, default=0.0, nullable=False)
    color = Column(String, nullable=False, default="#3b82f6")
    billing_cycle_day = Column(Integer, nullable=True)
    currency = Column(String, nullable=False, default="EUR", server_default="EUR")
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    transactions = relationship("Transaction", foreign_keys="Transaction.account_id", back_populates="account")
    to_transactions = relationship("Transaction", foreign_keys="Transaction.to_account_id", back_populates="to_account")


class Category(Base):
    __tablename__ = "categories"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String, nullable=False)
    icon = Column(String, nullable=False, default="💰")
    color = Column(String, nullable=False, default="#6b7280")
    type = Column(SAEnum("income", "expense", "both", name="category_type"), nullable=False, default="both")

    transactions = relationship("Transaction", back_populates="category")
    budgets = relationship("Budget", back_populates="category")


class Tag(Base):
    __tablename__ = "tags"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String, nullable=False, unique=True)
    color = Column(String, nullable=False, default="#6b7280")

    transactions = relationship("Transaction", secondary=transaction_tags, back_populates="tags")


class Project(Base):
    __tablename__ = "projects"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String, nullable=False)
    description = Column(String, nullable=True)
    icon = Column(String, nullable=False, default="📁")
    color = Column(String, nullable=False, default="#6366f1")
    status = Column(
        SAEnum("planned", "active", "completed", "on_hold", name="project_status"),
        nullable=False, default="planned"
    )
    start_date = Column(String, nullable=True)   # YYYY-MM-DD
    end_date = Column(String, nullable=True)     # YYYY-MM-DD
    budget = Column(Float, nullable=True)        # optional planned budget
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    transactions = relationship("Transaction", secondary=transaction_projects, back_populates="projects")
    splits = relationship("TransactionSplit", secondary=split_projects, back_populates="projects")


class Transaction(Base):
    __tablename__ = "transactions"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    date = Column(String, nullable=False)
    billing_date = Column(String, nullable=True)
    amount = Column(Float, nullable=False)
    type = Column(SAEnum("income", "expense", "transfer", name="transaction_type"), nullable=False)
    category_id = Column(String, ForeignKey("categories.id", ondelete="SET NULL"), nullable=True)
    account_id = Column(String, ForeignKey("accounts.id", ondelete="CASCADE"), nullable=False)
    to_account_id = Column(String, ForeignKey("accounts.id", ondelete="SET NULL"), nullable=True)
    payee = Column(String, nullable=False, default="")
    notes = Column(String, nullable=True)
    recurring_id = Column(String, ForeignKey("recurring_transactions.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    account = relationship("Account", foreign_keys=[account_id], back_populates="transactions")
    to_account = relationship("Account", foreign_keys=[to_account_id], back_populates="to_transactions")
    category = relationship("Category", back_populates="transactions")
    tags = relationship("Tag", secondary=transaction_tags, back_populates="transactions")
    recurring = relationship("RecurringTransaction", back_populates="transactions")
    splits = relationship("TransactionSplit", back_populates="transaction", cascade="all, delete-orphan")
    projects = relationship("Project", secondary=transaction_projects, back_populates="transactions")


class TransactionSplit(Base):
    __tablename__ = "transaction_splits"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    transaction_id = Column(String, ForeignKey("transactions.id", ondelete="CASCADE"), nullable=False)
    amount = Column(Float, nullable=False)
    category_id = Column(String, ForeignKey("categories.id", ondelete="SET NULL"), nullable=True)
    notes = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    transaction = relationship("Transaction", back_populates="splits")
    category = relationship("Category")
    projects = relationship("Project", secondary=split_projects, back_populates="splits")


class RecurringTransaction(Base):
    __tablename__ = "recurring_transactions"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String, nullable=False)
    amount = Column(Float, nullable=False)
    type = Column(SAEnum("income", "expense", "transfer", name="recurring_type"), nullable=False)
    category_id = Column(String, ForeignKey("categories.id", ondelete="SET NULL"), nullable=True)
    account_id = Column(String, ForeignKey("accounts.id", ondelete="CASCADE"), nullable=False)
    to_account_id = Column(String, ForeignKey("accounts.id", ondelete="SET NULL"), nullable=True)
    payee = Column(String, nullable=False, default="")
    notes = Column(String, nullable=True)
    frequency = Column(
        SAEnum("daily", "weekly", "monthly", "yearly", "custom", name="recurrence_frequency"),
        nullable=False, default="monthly"
    )
    custom_interval_days = Column(Integer, nullable=True)
    start_date = Column(String, nullable=False)
    end_date = Column(String, nullable=True)
    next_due_date = Column(String, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    auto_post = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    category = relationship("Category")
    account = relationship("Account", foreign_keys=[account_id])
    to_account = relationship("Account", foreign_keys=[to_account_id])
    transactions = relationship("Transaction", back_populates="recurring")
    tags = relationship("Tag", secondary=recurring_tags)


class Budget(Base):
    __tablename__ = "budgets"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    category_id = Column(String, ForeignKey("categories.id", ondelete="CASCADE"), nullable=False)
    amount = Column(Float, nullable=False)
    month = Column(String, nullable=False)  # YYYY-MM
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    category = relationship("Category", back_populates="budgets")
