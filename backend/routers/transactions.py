from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import or_, and_
from sqlalchemy.orm import Session
from typing import Dict, List, Optional
from datetime import date as date_cls, timedelta
from statistics import median
import re
import uuid
from database import get_db
from models import Transaction, TransactionSplit, Tag, Account, Project, Category, RefundLink
from schemas import (
    TransactionCreate, TransactionUpdate, TransactionRead, TransactionSummary, TransactionSplitRead,
    TransactionTotals, BulkAction,
)
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


def build_transaction_read(txn: Transaction, typical: Optional[float] = None) -> dict:
    refunded_amount = sum(l.amount for l in txn.refunded_by)
    return {
        "id": txn.id,
        "date": txn.date,
        "time": txn.time,
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
        "typical_amount": typical,
    }


# ── Unusual spends ────────────────────────────────────────────────────────────
UNUSUAL_LOOKBACK_DAYS = 90
UNUSUAL_MIN_SAMPLES = 5
UNUSUAL_FACTOR = 2.0


def typical_amounts(db: Session, txns: List[Transaction]) -> Dict[str, float]:
    """For expenses more than UNUSUAL_FACTOR x their category's median over the
    previous 90 days, map transaction id -> that median. Split expenses are skipped."""
    candidates = [t for t in txns if t.type == "expense" and t.category_id and not t.splits]
    if not candidates:
        return {}
    cat_ids = {t.category_id for t in candidates}
    earliest = min(t.date for t in candidates)
    start = (date_cls.fromisoformat(earliest) - timedelta(days=UNUSUAL_LOOKBACK_DAYS)).isoformat()
    latest = max(t.date for t in candidates)
    history: Dict[str, List[tuple]] = {}
    rows = (
        db.query(Transaction.category_id, Transaction.date, Transaction.amount)
        .filter(
            Transaction.type == "expense",
            Transaction.category_id.in_(cat_ids),
            Transaction.date >= start,
            Transaction.date < latest,
        )
        .all()
    )
    for cat_id, d, amount in rows:
        history.setdefault(cat_id, []).append((d, amount))

    result = {}
    for t in candidates:
        window_start = (date_cls.fromisoformat(t.date) - timedelta(days=UNUSUAL_LOOKBACK_DAYS)).isoformat()
        amounts = [a for d, a in history.get(t.category_id, []) if window_start <= d < t.date]
        if len(amounts) < UNUSUAL_MIN_SAMPLES:
            continue
        typical = median(amounts)
        if typical > 0 and t.amount > UNUSUAL_FACTOR * typical:
            result[t.id] = round(typical, 2)
    return result


# ── Filters shared by the list and its totals ─────────────────────────────────
def parse_search_amount(term: str) -> Optional[float]:
    """'12,50', '€12.50' or '1.234,50' -> a number, otherwise None."""
    cleaned = term.replace("€", "").replace(" ", "")
    if not re.fullmatch(r"[0-9.,]+", cleaned) or not re.search(r"\d", cleaned):
        return None
    if "," in cleaned:
        cleaned = cleaned.replace(".", "").replace(",", ".")
    try:
        return float(cleaned)
    except ValueError:
        return None


def filtered_query(
    db: Session,
    account_id: Optional[str] = None,
    category_id: Optional[str] = None,
    type: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    search: Optional[str] = None,
    tag_ids: Optional[str] = None,
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
    if search and search.strip():
        # Every word must match somewhere: payee, notes, category, tag, account, project or amount
        for word in search.split():
            like = f"%{word}%"
            matches = [
                Transaction.payee.ilike(like),
                Transaction.notes.ilike(like),
                Transaction.category.has(Category.name.ilike(like)),
                Transaction.splits.any(or_(
                    TransactionSplit.notes.ilike(like),
                    TransactionSplit.category.has(Category.name.ilike(like)),
                    TransactionSplit.projects.any(Project.name.ilike(like)),
                )),
                Transaction.tags.any(Tag.name.ilike(like)),
                Transaction.account.has(Account.name.ilike(like)),
                Transaction.to_account.has(Account.name.ilike(like)),
                Transaction.projects.any(Project.name.ilike(like)),
            ]
            amount = parse_search_amount(word)
            if amount is not None:
                matches.append(and_(Transaction.amount > amount - 0.005, Transaction.amount < amount + 0.005))
                matches.append(Transaction.splits.any(and_(
                    TransactionSplit.amount > amount - 0.005, TransactionSplit.amount < amount + 0.005,
                )))
            q = q.filter(or_(*matches))
    if tag_ids:
        ids = tag_ids.split(",")
        q = q.filter(Transaction.tags.any(Tag.id.in_(ids)))
    return q


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


@router.get("/totals", response_model=TransactionTotals)
def get_totals(
    account_id: Optional[str] = None,
    category_id: Optional[str] = None,
    type: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    search: Optional[str] = None,
    tag_ids: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """Totals for everything matching the list filters (not just the loaded page)."""
    txns = filtered_query(db, account_id, category_id, type, date_from, date_to, search, tag_ids).all()

    def counted(t: Transaction) -> float:
        # Filtering by category: a split transaction only counts its parts in that category
        if category_id and t.splits and t.category_id != category_id:
            return sum(s.amount for s in t.splits if s.category_id == category_id)
        return t.amount

    refund_txns = [t for t in txns if t.type == "refund"]
    surplus = sum(refund_surplus(t) for t in refund_txns)
    income = sum(counted(t) for t in txns if t.type == "income") + surplus
    expenses = sum(counted(t) for t in txns if t.type == "expense")
    refunds = sum(t.amount for t in refund_txns) - surplus
    return {
        "count": len(txns),
        "income": round(income, 2),
        "expenses": round(expenses, 2),
        "refunds": round(refunds, 2),
        "net": round(income - expenses + refunds, 2),
        "transfers": sum(1 for t in txns if t.type == "transfer"),
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
    q = filtered_query(db, account_id, category_id, type, date_from, date_to, search, tag_ids)
    transactions = q.order_by(Transaction.date.desc(), Transaction.time.desc(), Transaction.created_at.desc()).offset(offset).limit(limit).all()
    typical = typical_amounts(db, transactions)
    return [TransactionRead.model_validate(build_transaction_read(t, typical.get(t.id))) for t in transactions]


@router.post("/bulk")
def bulk_action(data: BulkAction, db: Session = Depends(get_db)):
    """Apply one change to several transactions: delete, set category, add tags, add a project."""
    txns = db.query(Transaction).filter(Transaction.id.in_(data.ids)).all()
    if not txns:
        raise HTTPException(404, "No matching transactions")
    affected_accounts = set()
    updated, skipped = 0, 0

    if data.action == "delete":
        for t in txns:
            affected_accounts.update({t.account_id, t.to_account_id})
            db.delete(t)
        updated = len(txns)
    elif data.action == "update":
        tags = db.query(Tag).filter(Tag.id.in_(data.add_tag_ids)).all() if data.add_tag_ids else []
        project = db.query(Project).filter(Project.id == data.project_id).first() if data.project_id else None
        if data.project_id and not project:
            raise HTTPException(404, "Project not found")
        if data.category_id:
            if not db.query(Category).filter(Category.id == data.category_id).first():
                raise HTTPException(404, "Category not found")
        for t in txns:
            changed = False
            # Split and transfer entries keep their own categories
            if data.category_id and t.type != "transfer" and not t.splits:
                t.category_id = data.category_id
                changed = True
            for tag in tags:
                if tag not in t.tags:
                    t.tags.append(tag)
                changed = changed or bool(tags)
            if project and not t.splits:
                if project not in t.projects:
                    t.projects.append(project)
                changed = True
            if changed:
                updated += 1
            else:
                skipped += 1
    else:
        raise HTTPException(400, "Unknown action")

    db.commit()
    for aid in affected_accounts:
        if aid:
            recalculate_balance(db, aid)
    db.commit()
    return {"updated": updated, "skipped": skipped}


@router.post("", response_model=TransactionRead)
def create_transaction(data: TransactionCreate, db: Session = Depends(get_db)):
    if data.id:
        existing = db.query(Transaction).filter(Transaction.id == data.id).first()
        if existing:  # a retried offline save that already reached the server
            return TransactionRead.model_validate(build_transaction_read(existing))
    tag_ids = data.tag_ids or []
    project_ids = data.project_ids or []
    has_splits = bool(data.splits)
    txn = Transaction(
        id=data.id or str(uuid.uuid4()),
        date=data.date,
        time=data.time,
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
