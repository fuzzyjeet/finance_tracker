from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
import uuid
from datetime import date
from database import get_db
from models import RecurringTransaction, Transaction, Tag
from schemas import RecurringTransactionCreate, RecurringTransactionUpdate, RecurringTransactionRead
from routers.accounts import recalculate_balance

router = APIRouter()


def build_recurring_read(r: RecurringTransaction) -> dict:
    return {
        "id": r.id,
        "name": r.name,
        "amount": r.amount,
        "type": r.type,
        "category_id": r.category_id,
        "account_id": r.account_id,
        "to_account_id": r.to_account_id,
        "payee": r.payee,
        "notes": r.notes,
        "frequency": r.frequency,
        "custom_interval_days": r.custom_interval_days,
        "start_date": r.start_date,
        "end_date": r.end_date,
        "next_due_date": r.next_due_date,
        "is_active": r.is_active,
        "auto_post": r.auto_post,
        "created_at": r.created_at,
        "category": r.category,
        "tags": r.tags,
        "account_name": r.account.name if r.account else None,
        "to_account_name": r.to_account.name if r.to_account else None,
    }


@router.get("/pending", response_model=List[RecurringTransactionRead])
def get_pending(db: Session = Depends(get_db)):
    today = date.today().isoformat()
    items = db.query(RecurringTransaction).filter(
        RecurringTransaction.is_active == True,
        RecurringTransaction.auto_post == False,
        RecurringTransaction.next_due_date <= today,
    ).all()
    return [RecurringTransactionRead.model_validate(build_recurring_read(r)) for r in items]


@router.get("", response_model=List[RecurringTransactionRead])
def list_recurring(db: Session = Depends(get_db)):
    items = db.query(RecurringTransaction).order_by(RecurringTransaction.next_due_date).all()
    return [RecurringTransactionRead.model_validate(build_recurring_read(r)) for r in items]


@router.post("", response_model=RecurringTransactionRead)
def create_recurring(data: RecurringTransactionCreate, db: Session = Depends(get_db)):
    tag_ids = data.tag_ids or []
    r = RecurringTransaction(
        id=str(uuid.uuid4()),
        name=data.name,
        amount=data.amount,
        type=data.type,
        category_id=data.category_id,
        account_id=data.account_id,
        to_account_id=data.to_account_id,
        payee=data.payee,
        notes=data.notes,
        frequency=data.frequency,
        custom_interval_days=data.custom_interval_days,
        start_date=data.start_date,
        end_date=data.end_date,
        next_due_date=data.next_due_date,
        is_active=data.is_active,
        auto_post=data.auto_post,
    )
    if tag_ids:
        tags = db.query(Tag).filter(Tag.id.in_(tag_ids)).all()
        r.tags = tags
    db.add(r)
    db.commit()
    db.refresh(r)
    return RecurringTransactionRead.model_validate(build_recurring_read(r))


@router.get("/{recurring_id}", response_model=RecurringTransactionRead)
def get_recurring(recurring_id: str, db: Session = Depends(get_db)):
    r = db.query(RecurringTransaction).filter(RecurringTransaction.id == recurring_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Recurring transaction not found")
    return RecurringTransactionRead.model_validate(build_recurring_read(r))


@router.put("/{recurring_id}", response_model=RecurringTransactionRead)
def update_recurring(recurring_id: str, data: RecurringTransactionUpdate, db: Session = Depends(get_db)):
    r = db.query(RecurringTransaction).filter(RecurringTransaction.id == recurring_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Recurring transaction not found")

    update_data = data.model_dump(exclude_none=True)
    tag_ids = update_data.pop("tag_ids", None)

    for field, value in update_data.items():
        setattr(r, field, value)

    if tag_ids is not None:
        tags = db.query(Tag).filter(Tag.id.in_(tag_ids)).all()
        r.tags = tags

    db.commit()
    db.refresh(r)
    return RecurringTransactionRead.model_validate(build_recurring_read(r))


@router.delete("/{recurring_id}")
def delete_recurring(recurring_id: str, db: Session = Depends(get_db)):
    r = db.query(RecurringTransaction).filter(RecurringTransaction.id == recurring_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Recurring transaction not found")
    db.delete(r)
    db.commit()
    return {"ok": True}


@router.post("/{recurring_id}/post-now", response_model=RecurringTransactionRead)
def post_now(recurring_id: str, db: Session = Depends(get_db)):
    from services.scheduler import advance_next_due_date
    r = db.query(RecurringTransaction).filter(RecurringTransaction.id == recurring_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Recurring transaction not found")

    txn = Transaction(
        id=str(uuid.uuid4()),
        date=r.next_due_date,
        amount=r.amount,
        type=r.type,
        category_id=r.category_id,
        account_id=r.account_id,
        to_account_id=r.to_account_id,
        payee=r.payee,
        notes=r.notes,
        recurring_id=r.id,
    )
    db.add(txn)

    next_due = advance_next_due_date(r, date.fromisoformat(r.next_due_date))
    if r.end_date and next_due.isoformat() > r.end_date:
        r.is_active = False
    else:
        r.next_due_date = next_due.isoformat()

    db.commit()
    db.refresh(r)

    recalculate_balance(db, r.account_id)
    if r.to_account_id:
        recalculate_balance(db, r.to_account_id)
    db.commit()
    db.refresh(r)

    return RecurringTransactionRead.model_validate(build_recurring_read(r))
