from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
import uuid
from database import get_db
from models import Budget, Transaction, TransactionSplit
from schemas import BudgetCreate, BudgetUpdate, BudgetRead

router = APIRouter()


def compute_spent(db: Session, category_id: str, month: str) -> float:
    start = f"{month}-01"
    year, mon = int(month.split("-")[0]), int(month.split("-")[1])
    end = f"{year + 1}-01-01" if mon == 12 else f"{year}-{mon + 1:02d}-01"

    # Direct (non-split) transactions
    direct = db.query(Transaction).filter(
        Transaction.category_id == category_id,
        Transaction.type == "expense",
        Transaction.date >= start,
        Transaction.date < end,
    ).all()

    # Split line items
    split_amounts = (
        db.query(TransactionSplit)
        .join(Transaction, TransactionSplit.transaction_id == Transaction.id)
        .filter(
            TransactionSplit.category_id == category_id,
            Transaction.type == "expense",
            Transaction.date >= start,
            Transaction.date < end,
        )
        .all()
    )

    return sum(t.amount for t in direct) + sum(s.amount for s in split_amounts)


def build_budget_read(budget: Budget, db: Session) -> BudgetRead:
    spent = compute_spent(db, budget.category_id, budget.month)
    result = BudgetRead.model_validate(budget)
    result.spent = spent
    return result


@router.get("", response_model=List[BudgetRead])
def list_budgets(
    month: Optional[str] = Query(None, description="YYYY-MM"),
    db: Session = Depends(get_db),
):
    q = db.query(Budget)
    if month:
        q = q.filter(Budget.month == month)
    budgets = q.order_by(Budget.created_at).all()
    return [build_budget_read(b, db) for b in budgets]


@router.post("", response_model=BudgetRead)
def create_budget(data: BudgetCreate, db: Session = Depends(get_db)):
    budget = Budget(
        id=str(uuid.uuid4()),
        category_id=data.category_id,
        amount=data.amount,
        month=data.month,
    )
    db.add(budget)
    db.commit()
    db.refresh(budget)
    return build_budget_read(budget, db)


@router.put("/{budget_id}", response_model=BudgetRead)
def update_budget(budget_id: str, data: BudgetUpdate, db: Session = Depends(get_db)):
    budget = db.query(Budget).filter(Budget.id == budget_id).first()
    if not budget:
        raise HTTPException(status_code=404, detail="Budget not found")
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(budget, field, value)
    db.commit()
    db.refresh(budget)
    return build_budget_read(budget, db)


@router.delete("/{budget_id}")
def delete_budget(budget_id: str, db: Session = Depends(get_db)):
    budget = db.query(Budget).filter(Budget.id == budget_id).first()
    if not budget:
        raise HTTPException(status_code=404, detail="Budget not found")
    db.delete(budget)
    db.commit()
    return {"ok": True}
