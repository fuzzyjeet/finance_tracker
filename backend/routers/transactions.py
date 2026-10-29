from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
import uuid
from database import get_db
from models import Transaction, TransactionSplit, Tag, Account, Project, RefundLink
from schemas import TransactionCreate, TransactionUpdate, TransactionRead, TransactionSummary, TransactionSplitRead
from routers.accounts import recalculate_balance

router = APIRouter()


def _link_read(link: RefundLink, counterpart: Transaction) -> dict:
    return {
        "id": link.id,
        "transaction_id": counterpart.id,
        "amount": link.amount,
        "payee": counterpart.payee,
        "date": counterpart.date,
        "transaction_amount": counterpart.amount,
        "account_name": counterpart.account.name if counterpart.account else None,
    }


def refund_surplus(txn: Transaction) -> float:
    if txn.type != "refund":
        return 0.0
    return max(0.0, txn.amount - sum(l.amount for l in txn.refund_allocations))


def build_transaction_read(txn: Transaction) -> dict:
    refunded_amount = sum(l.amount for l in txn.refunded_by)
    return {
        "id": txn.id,
        "date": txn.date,
        "billing_date": txn.billing_date,
        "amount": txn.amount,
        "type": txn.type,
        "category_id": txn.category_id,
        "account_id": txn.account_id,
        "to_account_id": txn.to_account_id,
        "payee": txn.payee,
        "notes": txn.notes,
        "recurring_id": txn.recurring_id,
        "created_at": txn.created_at,
        "category": txn.category,
        "tags": txn.tags,
        "splits": txn.splits,
        "projects": txn.projects,
        "account_name": txn.account.name if txn.account else None,
        "to_account_name": txn.to_account.name if txn.to_account else None,
        "refund_for": [_link_read(l, l.original) for l in txn.refund_allocations],
        "refunds": [_link_read(l, l.refund) for l in txn.refunded_by],
        "refunded_amount": refunded_amount,
        "refund_surplus": refund_surplus(txn),
        "is_fully_refunded": bool(txn.refunded_by) and refunded_amount >= txn.amount - 0.005,
    }


def apply_refund_links(db: Session, txn: Transaction, links) -> None:
    """Replace the originals this refund covers. Validates before mutating."""
    links = links or []
    if links and txn.type != "refund":
        raise HTTPException(400, "Only refund transactions can be linked to originals")

    seen = set()
    total = 0.0
    originals = {}
    for l in links:
        original_id = l["original_id"] if isinstance(l, dict) else l.original_id
        amount = l["amount"] if isinstance(l, dict) else l.amount
        if original_id == txn.id:
            raise HTTPException(400, "A refund cannot be linked to itself")
        if original_id in seen:
            raise HTTPException(400, "Each original transaction can only be linked once per refund")
        if amount <= 0:
            raise HTTPException(400, "Linked amounts must be greater than zero")
        original = db.query(Transaction).filter(Transaction.id == original_id).first()
        if not original:
            raise HTTPException(404, f"Original transaction {original_id} not found")
        if original.type != "expense":
            raise HTTPException(400, "Refunds can only be linked to expense transactions")
        seen.add(original_id)
        total += amount
        originals[original_id] = amount

    if total > txn.amount + 0.005:
        raise HTTPException(400, "Linked amounts exceed the refund amount")

    txn.refund_allocations = [
        RefundLink(id=str(uuid.uuid4()), refund_id=txn.id, original_id=oid, amount=amt)
        for oid, amt in originals.items()
    ]


def apply_splits(db: Session, txn: Transaction, splits_data):
    """Replace all splits on a transaction with new ones."""
    # Delete existing splits
    db.query(TransactionSplit).filter(TransactionSplit.transaction_id == txn.id).delete()
    if splits_data:
        for s in splits_data:
            split = TransactionSplit(
                id=str(uuid.uuid4()),
                transaction_id=txn.id,
                amount=s.amount,
                category_id=s.category_id,
                notes=s.notes,
            )
            db.add(split)
        # When split, category_id on the transaction itself is null
        txn.category_id = None


@router.get("/summary", response_model=TransactionSummary)
def get_summary(
    month: str = Query(..., description="YYYY-MM"),
    account_id: Optional[str] = None,
    db: Session = Depends(get_db),
):
    start = f"{month}-01"
    year, mon = int(month.split("-")[0]), int(month.split("-")[1])
    end = f"{year + 1}-01-01" if mon == 12 else f"{year}-{mon + 1:02d}-01"

    q = db.query(Transaction).filter(
        Transaction.date >= start,
        Transaction.date < end,
        Transaction.type.in_(["income", "expense", "refund"]),
    )
    if account_id:
        q = q.filter(Transaction.account_id == account_id)

    transactions = q.all()
    # A refund's linked portion offsets expenses; any unallocated remainder is income.
    refund_txns = [t for t in transactions if t.type == "refund"]
    surplus = sum(refund_surplus(t) for t in refund_txns)
    total_income = sum(t.amount for t in transactions if t.type == "income") + surplus
    total_expenses = sum(t.amount for t in transactions if t.type == "expense")
    total_refunds = sum(t.amount for t in refund_txns) - surplus
    return {
        "total_income": total_income,
        "total_expenses": total_expenses,
        "total_refunds": total_refunds,
        "net": total_income - total_expenses + total_refunds,
    }


@router.get("", response_model=List[TransactionRead])
def list_transactions(
    account_id: Optional[str] = None,
    category_id: Optional[str] = None,
    type: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    search: Optional[str] = None,
    tag_ids: Optional[str] = None,
    limit: int = Query(20, ge=1, le=5000),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    q = db.query(Transaction)
    if account_id:
        q = q.filter(
            (Transaction.account_id == account_id) | (Transaction.to_account_id == account_id)
        )
    if category_id:
        # Match direct category OR any split with that category
        q = q.filter(
            (Transaction.category_id == category_id) |
            (Transaction.splits.any(TransactionSplit.category_id == category_id))
        )
    if type:
        q = q.filter(Transaction.type == type)
    if date_from:
        q = q.filter(Transaction.date >= date_from)
    if date_to:
        q = q.filter(Transaction.date <= date_to)
    if search:
        q = q.filter(Transaction.payee.ilike(f"%{search}%"))
    if tag_ids:
        ids = tag_ids.split(",")
        q = q.filter(Transaction.tags.any(Tag.id.in_(ids)))

    transactions = q.order_by(Transaction.date.desc(), Transaction.created_at.desc()).offset(offset).limit(limit).all()
    return [TransactionRead.model_validate(build_transaction_read(t)) for t in transactions]


@router.post("", response_model=TransactionRead)
def create_transaction(data: TransactionCreate, db: Session = Depends(get_db)):
    tag_ids = data.tag_ids or []
    project_ids = data.project_ids or []
    has_splits = bool(data.splits)
    txn = Transaction(
        id=str(uuid.uuid4()),
        date=data.date,
        billing_date=data.billing_date,
        amount=data.amount,
        type=data.type,
        category_id=None if has_splits else data.category_id,
        account_id=data.account_id,
        to_account_id=data.to_account_id,
        payee=data.payee,
        notes=data.notes,
    )
    if data.refund_links:
        apply_refund_links(db, txn, data.refund_links)
    if tag_ids:
        txn.tags = db.query(Tag).filter(Tag.id.in_(tag_ids)).all()
    if project_ids and not has_splits:
        txn.projects = db.query(Project).filter(Project.id.in_(project_ids)).all()
    db.add(txn)
    db.flush()

    if has_splits:
        for s in data.splits:
            split = TransactionSplit(
                id=str(uuid.uuid4()),
                transaction_id=txn.id,
                amount=s.amount,
                category_id=s.category_id,
                notes=s.notes,
            )
            if s.project_ids:
                split.projects = db.query(Project).filter(Project.id.in_(s.project_ids)).all()
            db.add(split)

    db.commit()
    db.refresh(txn)

    recalculate_balance(db, data.account_id)
    if data.to_account_id:
        recalculate_balance(db, data.to_account_id)
    db.commit()
    db.refresh(txn)
    return TransactionRead.model_validate(build_transaction_read(txn))


@router.get("/{transaction_id}", response_model=TransactionRead)
def get_transaction(transaction_id: str, db: Session = Depends(get_db)):
    txn = db.query(Transaction).filter(Transaction.id == transaction_id).first()
    if not txn:
        raise HTTPException(status_code=404, detail="Transaction not found")
    return TransactionRead.model_validate(build_transaction_read(txn))


@router.put("/{transaction_id}", response_model=TransactionRead)
def update_transaction(transaction_id: str, data: TransactionUpdate, db: Session = Depends(get_db)):
    txn = db.query(Transaction).filter(Transaction.id == transaction_id).first()
    if not txn:
        raise HTTPException(status_code=404, detail="Transaction not found")

    old_account_id = txn.account_id
    old_to_account_id = txn.to_account_id

    update_data = data.model_dump(exclude_unset=True)
    tag_ids = update_data.pop("tag_ids", None)
    project_ids = update_data.pop("project_ids", None)
    splits_data = update_data.pop("splits", None)
    refund_links = update_data.pop("refund_links", None)

    for field, value in update_data.items():
        setattr(txn, field, value)

    if refund_links is not None:
        apply_refund_links(db, txn, refund_links)
    elif txn.type != "refund" and txn.refund_allocations:
        txn.refund_allocations = []
    if txn.type != "expense" and txn.refunded_by:
        raise HTTPException(400, "This transaction has refunds linked to it; unlink them before changing its type")

    if tag_ids is not None:
        txn.tags = db.query(Tag).filter(Tag.id.in_(tag_ids)).all()

    if project_ids is not None:
        txn.projects = db.query(Project).filter(Project.id.in_(project_ids)).all()

    if splits_data is not None:
        db.query(TransactionSplit).filter(TransactionSplit.transaction_id == txn.id).delete()
        if splits_data:
            txn.category_id = None
            for s in splits_data:
                split = TransactionSplit(
                    id=str(uuid.uuid4()),
                    transaction_id=txn.id,
                    amount=s["amount"],
                    category_id=s.get("category_id"),
                    notes=s.get("notes"),
                )
                if s.get("project_ids"):
                    split.projects = db.query(Project).filter(Project.id.in_(s["project_ids"])).all()
                db.add(split)

    db.commit()
    db.refresh(txn)

    affected_accounts = {old_account_id, txn.account_id}
    if old_to_account_id:
        affected_accounts.add(old_to_account_id)
    if txn.to_account_id:
        affected_accounts.add(txn.to_account_id)
    for aid in affected_accounts:
        if aid:
            recalculate_balance(db, aid)
    db.commit()
    db.refresh(txn)
    return TransactionRead.model_validate(build_transaction_read(txn))


@router.delete("/{transaction_id}")
def delete_transaction(transaction_id: str, db: Session = Depends(get_db)):
    txn = db.query(Transaction).filter(Transaction.id == transaction_id).first()
    if not txn:
        raise HTTPException(status_code=404, detail="Transaction not found")

    account_id = txn.account_id
    to_account_id = txn.to_account_id

    db.delete(txn)
    db.commit()

    recalculate_balance(db, account_id)
    if to_account_id:
        recalculate_balance(db, to_account_id)
    db.commit()
    return {"ok": True}
