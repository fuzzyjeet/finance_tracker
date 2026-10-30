from pydantic import BaseModel, ConfigDict, StringConstraints
from typing import Annotated, Optional, List
from datetime import datetime


# ── Tag ──────────────────────────────────────────────────────────────────────

class TagBase(BaseModel):
    name: str
    color: str = "#6b7280"


class TagCreate(TagBase):
    pass


class TagUpdate(BaseModel):
    name: Optional[str] = None
    color: Optional[str] = None


class TagRead(TagBase):
    model_config = ConfigDict(from_attributes=True)
    id: str


# ── Category ──────────────────────────────────────────────────────────────────

class CategoryBase(BaseModel):
    name: str
    icon: str = "💰"
    color: str = "#6b7280"
    type: str = "both"  # income | expense | both


class CategoryCreate(CategoryBase):
    pass


class CategoryUpdate(BaseModel):
    name: Optional[str] = None
    icon: Optional[str] = None
    color: Optional[str] = None
    type: Optional[str] = None


class CategoryRead(CategoryBase):
    model_config = ConfigDict(from_attributes=True)
    id: str


# ── Account ───────────────────────────────────────────────────────────────────

class AccountBase(BaseModel):
    name: str
    type: str  # checking | savings | credit_card | cash | investment
    color: str = "#3b82f6"
    billing_cycle_day: Optional[int] = None
    currency: str = "EUR"
    opening_balance: float = 0.0


class AccountCreate(AccountBase):
    pass


class AccountUpdate(BaseModel):
    name: Optional[str] = None
    type: Optional[str] = None
    color: Optional[str] = None
    billing_cycle_day: Optional[int] = None
    currency: Optional[str] = None
    opening_balance: Optional[float] = None


class AccountRead(AccountBase):
    model_config = ConfigDict(from_attributes=True)
    id: str
    balance: float
    created_at: datetime


# ── Project ───────────────────────────────────────────────────────────────────

class ProjectBase(BaseModel):
    name: str
    description: Optional[str] = None
    icon: str = "📁"
    color: str = "#6366f1"
    status: str = "planned"  # planned | active | completed | on_hold
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    budget: Optional[float] = None


class ProjectCreate(ProjectBase):
    pass


class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    icon: Optional[str] = None
    color: Optional[str] = None
    status: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    budget: Optional[float] = None


class ProjectRead(ProjectBase):
    model_config = ConfigDict(from_attributes=True)
    id: str
    created_at: datetime


class ProjectSummary(BaseModel):
    """Lightweight project ref embedded in transaction responses."""
    model_config = ConfigDict(from_attributes=True)
    id: str
    name: str
    icon: str
    color: str


# ── Refund links ──────────────────────────────────────────────────────────────

class RefundLinkCreate(BaseModel):
    original_id: str
    amount: float


class RefundLinkRead(BaseModel):
    """One refund↔original allocation, seen from either side."""
    id: str
    transaction_id: str  # the counterpart transaction
    amount: float        # portion of the refund allocated to this pair
    payee: str
    date: str
    transaction_amount: float
    account_name: Optional[str] = None


# ── Transaction Split ─────────────────────────────────────────────────────────

class TransactionSplitCreate(BaseModel):
    amount: float
    category_id: Optional[str] = None
    notes: Optional[str] = None
    project_ids: Optional[List[str]] = []


class TransactionSplitRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    amount: float
    category_id: Optional[str] = None
    notes: Optional[str] = None
    category: Optional[CategoryRead] = None
    projects: List[ProjectSummary] = []


# ── Transaction ───────────────────────────────────────────────────────────────

TimeStr = Annotated[str, StringConstraints(pattern=r"^([01]\d|2[0-3]):[0-5]\d$")]


class TransactionBase(BaseModel):
    date: str  # YYYY-MM-DD
    time: Optional[TimeStr] = None  # HH:MM, 24h
    billing_date: Optional[str] = None
    amount: float
    type: str  # income | expense | transfer | refund
    category_id: Optional[str] = None
    account_id: str
    to_account_id: Optional[str] = None
    payee: str = ""
    notes: Optional[str] = None
    tag_ids: Optional[List[str]] = []
    project_ids: Optional[List[str]] = []
    splits: Optional[List[TransactionSplitCreate]] = None  # None = no splits
    refund_links: Optional[List[RefundLinkCreate]] = None


class TransactionCreate(TransactionBase):
    pass


class TransactionUpdate(BaseModel):
    date: Optional[str] = None
    time: Optional[TimeStr] = None
    billing_date: Optional[str] = None
    amount: Optional[float] = None
    type: Optional[str] = None
    category_id: Optional[str] = None
    account_id: Optional[str] = None
    to_account_id: Optional[str] = None
    payee: Optional[str] = None
    notes: Optional[str] = None
    tag_ids: Optional[List[str]] = None
    project_ids: Optional[List[str]] = None
    splits: Optional[List[TransactionSplitCreate]] = None  # None = don't touch, [] = clear
    refund_links: Optional[List[RefundLinkCreate]] = None  # None = don't touch, [] = clear


class TransactionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    date: str
    time: Optional[str] = None
    billing_date: Optional[str] = None
    amount: float
    type: str
    category_id: Optional[str] = None
    account_id: str
    to_account_id: Optional[str] = None
    payee: str
    notes: Optional[str] = None
    recurring_id: Optional[str] = None
    created_at: datetime
    category: Optional[CategoryRead] = None
    tags: List[TagRead] = []
    splits: List[TransactionSplitRead] = []
    projects: List[ProjectSummary] = []
    account_name: Optional[str] = None
    to_account_name: Optional[str] = None
    refund_for: List[RefundLinkRead] = []  # originals this refund covers
    refunds: List[RefundLinkRead] = []     # refunds this transaction received
    refunded_amount: float = 0.0
    refund_surplus: float = 0.0  # unallocated part of a refund, booked as income
    is_fully_refunded: bool = False


class TransactionSummary(BaseModel):
    total_income: float
    total_expenses: float
    total_refunds: float = 0.0
    net: float


# ── Recurring Transaction ─────────────────────────────────────────────────────

class RecurringTransactionBase(BaseModel):
    name: str
    amount: float
    type: str  # income | expense | transfer
    category_id: Optional[str] = None
    account_id: str
    to_account_id: Optional[str] = None
    payee: str = ""
    notes: Optional[str] = None
    frequency: str = "monthly"  # daily | weekly | monthly | yearly | custom
    custom_interval_days: Optional[int] = None
    start_date: str
    end_date: Optional[str] = None
    next_due_date: str
    is_active: bool = True
    auto_post: bool = True
    tag_ids: Optional[List[str]] = []


class RecurringTransactionCreate(RecurringTransactionBase):
    pass


class RecurringTransactionUpdate(BaseModel):
    name: Optional[str] = None
    amount: Optional[float] = None
    type: Optional[str] = None
    category_id: Optional[str] = None
    account_id: Optional[str] = None
    to_account_id: Optional[str] = None
    payee: Optional[str] = None
    notes: Optional[str] = None
    frequency: Optional[str] = None
    custom_interval_days: Optional[int] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    next_due_date: Optional[str] = None
    is_active: Optional[bool] = None
    auto_post: Optional[bool] = None
    tag_ids: Optional[List[str]] = None


class RecurringTransactionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    name: str
    amount: float
    type: str
    category_id: Optional[str] = None
    account_id: str
    to_account_id: Optional[str] = None
    payee: str
    notes: Optional[str] = None
    frequency: str
    custom_interval_days: Optional[int] = None
    start_date: str
    end_date: Optional[str] = None
    next_due_date: str
    is_active: bool
    auto_post: bool
    created_at: datetime
    category: Optional[CategoryRead] = None
    tags: List[TagRead] = []
    account_name: Optional[str] = None
    to_account_name: Optional[str] = None


# ── Budget ────────────────────────────────────────────────────────────────────

class BudgetBase(BaseModel):
    category_id: str
    amount: float
    month: str  # YYYY-MM


class BudgetCreate(BudgetBase):
    pass


class BudgetUpdate(BaseModel):
    amount: Optional[float] = None
    month: Optional[str] = None


class BudgetRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    category_id: str
    amount: float
    month: str
    created_at: datetime
    spent: float = 0.0
    category: Optional[CategoryRead] = None
