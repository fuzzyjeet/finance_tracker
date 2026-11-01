from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from database import get_db
from models import Account, Transaction
from schemas import AccountCreate, AccountUpdate, AccountRead
from routers.logos import fetch_for_new_account

router = APIRouter()


def recalculate_balance(db: Session, account_id: str) -> float:
    """Recompute account balance from all transactions."""
    account = db.query(Account).filter(Account.id == account_id).first()
    if not account:
        return 0.0

    balance = account.opening_balance or 0.0
    transactions = db.query(Transaction).filter(
        (Transaction.account_id == account_id) | (Transaction.to_account_id == account_id)
    ).all()

    for txn in transactions:
        if txn.type == "income" and txn.account_id == account_id:
            balance += txn.amount
        elif txn.type == "expense" and txn.account_id == account_id:
            balance -= txn.amount
        elif txn.type == "refund" and txn.account_id == account_id:
            balance += txn.amount
        elif txn.type == "transfer":
            if txn.account_id == account_id:
                balance -= txn.amount
            elif txn.to_account_id == account_id:
                balance += txn.amount

    account.balance = round(balance, 2) + 0.0  # + 0.0 turns -0.0 into 0.0
    return account.balance


MAX_LOGO_CHARS = 400_000


def check_logo(logo: Optional[str]):
    if logo and (not logo.startswith("data:image/") or len(logo) > MAX_LOGO_CHARS):
        raise HTTPException(status_code=400, detail="The logo must be a small image")


def check_parent(db: Session, parent_id: Optional[str], account: Optional[Account], currency: str):
    """A sub-account sits under a main account in the same currency, one level deep."""
    if not parent_id:
        return
    parent = db.get(Account, parent_id)
    if not parent:
        raise HTTPException(status_code=404, detail="Parent account not found")
    if account and parent.id == account.id:
        raise HTTPException(status_code=400, detail="An account can't be its own sub-account")
    if parent.parent_id:
        raise HTTPException(status_code=400, detail="Sub-accounts can't have sub-accounts")
    if account and db.query(Account).filter(Account.parent_id == account.id).count():
        raise HTTPException(status_code=400, detail="This account has sub-accounts, so it can't be one")
    if parent.currency != currency:
        raise HTTPException(status_code=400, detail="A sub-account needs the same currency as its main account")


@router.get("", response_model=List[AccountRead])
def list_accounts(db: Session = Depends(get_db)):
    return db.query(Account).order_by(Account.created_at).all()


@router.post("", response_model=AccountRead)
def create_account(data: AccountCreate, background: BackgroundTasks, db: Session = Depends(get_db)):
    import uuid
    check_parent(db, data.parent_id, None, data.currency)
    check_logo(data.logo)
    account = Account(
        id=str(uuid.uuid4()),
        name=data.name,
        type=data.type,
        balance=data.opening_balance,
        opening_balance=data.opening_balance,
        color=data.color,
        billing_cycle_day=data.billing_cycle_day,
        currency=data.currency,
        parent_id=data.parent_id,
        is_active=data.is_active,
        logo=data.logo,
    )
    db.add(account)
    db.commit()
    db.refresh(account)
    if not account.logo:
        background.add_task(fetch_for_new_account, account.id)  # its bank's logo, if the name says
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
    changes = data.model_dump(exclude_none=True)
    if "parent_id" in data.model_fields_set:
        changes["parent_id"] = data.parent_id or None
        check_parent(db, changes["parent_id"], account, changes.get("currency", account.currency))
    if "logo" in data.model_fields_set:
        changes["logo"] = data.logo or None
        check_logo(changes["logo"])
    if "parent_id" not in data.model_fields_set and "currency" in changes and account.parent_id:
        check_parent(db, account.parent_id, account, changes["currency"])
    for field, value in changes.items():
        setattr(account, field, value)
    if data.opening_balance is not None:
        recalculate_balance(db, account_id)
    db.commit()
    db.refresh(account)
    return account


@router.delete("/{account_id}")
def delete_account(account_id: str, db: Session = Depends(get_db)):
    account = db.query(Account).filter(Account.id == account_id).first()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    # Its sub-accounts become main accounts
    db.query(Account).filter(Account.parent_id == account_id).update({Account.parent_id: None})
    db.delete(account)
    db.commit()
    return {"ok": True}
