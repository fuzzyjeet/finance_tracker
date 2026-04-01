from pydantic import BaseModel, ConfigDict
from typing import Optional, List
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


class AccountCreate(AccountBase):
    pass


class AccountUpdate(BaseModel):
    name: Optional[str] = None
    type: Optional[str] = None
    color: Optional[str] = None
    billing_cycle_day: Optional[int] = None


class AccountRead(AccountBase):
    model_config = ConfigDict(from_attributes=True)
    id: str
    balance: float
    created_at: datetime


# ── Transaction ───────────────────────────────────────────────────────────────

class TransactionBase(BaseModel):
    date: str  # YYYY-MM-DD
    billing_date: Optional[str] = None
    amount: float
    type: str  # income | expense | transfer
    category_id: Optional[str] = None
    account_id: str
    to_account_id: Optional[str] = None
    payee: str = ""
    notes: Optional[str] = None
    tag_ids: Optional[List[str]] = []


class TransactionCreate(TransactionBase):
    pass


class TransactionUpdate(BaseModel):
    date: Optional[str] = None
    billing_date: Optional[str] = None
    amount: Optional[float] = None
    type: Optional[str] = None
    category_id: Optional[str] = None
    account_id: Optional[str] = None
    to_account_id: Optional[str] = None
    payee: Optional[str] = None
    notes: Optional[str] = None
    tag_ids: Optional[List[str]] = None


class TransactionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    date: str
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
    account_name: Optional[str] = None
    to_account_name: Optional[str] = None


class TransactionSummary(BaseModel):
    total_income: float
    total_expenses: float
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
