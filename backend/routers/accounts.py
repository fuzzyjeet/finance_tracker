from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from database import get_db
from models import Account, Transaction
from schemas import AccountCreate, AccountUpdate, AccountRead

router = APIRouter()


def recalculate_balance(db: Session, account_id: str) -> float:
    """Recompute account balance from all transactions."""
    account = db.query(Account).filter(Account.id == account_id).first()
    if not account:
        return 0.0

    balance = 0.0
    transactions = db.query(Transaction).filter(
        (Transaction.account_id == account_id) | (Transaction.to_account_id == account_id)
    ).all()

    for txn in transactions:
        if txn.type == "income" and txn.account_id == account_id:
            balance += txn.amount
        elif txn.type == "expense" and txn.account_id == account_id:
            balance -= txn.amount
        elif txn.type == "transfer":
            if txn.account_id == account_id:
                balance -= txn.amount
            elif txn.to_account_id == account_id:
                balance += txn.amount

    account.balance = balance
    return balance


@router.get("", response_model=List[AccountRead])
def list_accounts(db: Session = Depends(get_db)):
    return db.query(Account).order_by(Account.created_at).all()


@router.post("", response_model=AccountRead)
def create_account(data: AccountCreate, db: Session = Depends(get_db)):
    import uuid
    account = Account(
        id=str(uuid.uuid4()),
        name=data.name,
        type=data.type,
        balance=0.0,
        color=data.color,
        billing_cycle_day=data.billing_cycle_day,
        currency=data.currency,
    )
    db.add(account)
    db.commit()
    db.refresh(account)
    return account


@router.get("/{account_id}", response_model=AccountRead)
def get_account(account_id: str, db: Session = Depends(get_db)):
    account = db.query(Account).filter(Account.id == account_id).first()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    return account


@router.put("/{account_id}", response_model=AccountRead)
def update_account(account_id: str, data: AccountUpdate, db: Session = Depends(get_db)):
    account = db.query(Account).filter(Account.id == account_id).first()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(account, field, value)
    db.commit()
    db.refresh(account)
    return account


@router.delete("/{account_id}")
def delete_account(account_id: str, db: Session = Depends(get_db)):
    account = db.query(Account).filter(Account.id == account_id).first()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    db.delete(account)
    db.commit()
    return {"ok": True}
