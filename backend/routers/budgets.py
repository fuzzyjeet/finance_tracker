from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from calendar import monthrange
from collections import defaultdict
import math
import uuid
from database import get_db
from clock import local_today
from models import Budget, BudgetMonth, Project, ProjectProvision, Transaction
from schemas import (
    BudgetCreate, BudgetUpdate, BudgetRead, BudgetOverview, BudgetSuggestion,
    CategorySpend, ProvisionCreate, ProvisionUpdate, ProvisionRead,
)

router = APIRouter()


def month_bounds(month: str):
    year, mon = int(month[:4]), int(month[5:7])
    end = f"{year + 1}-01-01" if mon == 12 else f"{year}-{mon + 1:02d}-01"
    return f"{month}-01", end


def shift_month(month: str, delta: int) -> str:
    year, mon = int(month[:4]), int(month[5:7])
    idx = year * 12 + (mon - 1) + delta
    return f"{idx // 12:04d}-{idx % 12 + 1:02d}"


def my_cost_factor(txn: Transaction) -> float:
    """Share of an expense's amount that was really mine: refunds and the part
    for others don't count."""
    if txn.amount <= 0:
        return 0.0
    refunded = sum(l.amount for l in txn.refunded_by)
    return max(0.0, txn.amount - refunded) / txn.amount * txn.own_ratio


def spending_parts(db: Session, month: str, exclude_project_ids: Optional[list] = None):
    """Each expense in the month, broken into (category, project ids, my cost) parts:
    one per split line, or the whole transaction."""
    start, end = month_bounds(month)
    txns = db.query(Transaction).filter(
        Transaction.type == "expense", Transaction.date >= start, Transaction.date < end,
    ).all()
    excl = set(exclude_project_ids or [])
    parts = []
    for t in txns:
        factor = my_cost_factor(t)
        txn_projects = {p.id for p in t.projects}
        # Same rule as project spending: projects on split lines win over the transaction's
        split_level = any(s.projects for s in t.splits)
        if t.splits:
            for s in t.splits:
                pids = {p.id for p in s.projects} if split_level else txn_projects
                parts.append((s.category, pids, s.amount * factor))
        else:
            parts.append((t.category, txn_projects, t.amount * factor))
    return [p for p in parts if not (p[1] & excl)]


def month_figures(db: Session, month: str, exclude_project_ids: Optional[list] = None):
    """Spent per budget category and per provision. Spending on a project with a
    provision that month counts against the provision, not its category."""
    provisions = db.query(ProjectProvision).filter(ProjectProvision.month == month).all()
    provisioned = {p.project_id for p in provisions}
    by_category = defaultdict(float)   # budget view: provisioned spending left out
    by_project = defaultdict(float)
    real_category = {}                 # by-category view: every expense
    real_spent = defaultdict(float)
    for category, pids, cost in spending_parts(db, month, exclude_project_ids):
        key = category.id if category else None
        real_category[key] = category
        real_spent[key] += cost
        covered = sorted(pids & provisioned)
        if covered:
            by_project[covered[0]] += cost
        else:
            by_category[key] += cost
    return provisions, by_category, by_project, real_category, real_spent


def carry_over(db: Session, month: str):
    """Copy the latest earlier month's budgets into a month that hasn't been set up.
    Returns the month copied from, if any."""
    if db.get(BudgetMonth, month):
        return None
    if db.query(Budget).filter(Budget.month == month).count():
        db.add(BudgetMonth(month=month))
        db.commit()
        return None
    prev = previous_budget_month(db, month)
    if not prev:
        return None
    for b in db.query(Budget).filter(Budget.month == prev).all():
        db.add(Budget(id=str(uuid.uuid4()), category_id=b.category_id, amount=b.amount, month=month))
    db.add(BudgetMonth(month=month))
    db.commit()
    return prev


def previous_budget_month(db: Session, month: str) -> Optional[str]:
    row = db.query(Budget.month).filter(Budget.month < month).order_by(Budget.month.desc()).first()
    return row[0] if row else None


def mark_month(db: Session, month: str):
    if not db.get(BudgetMonth, month):
        db.add(BudgetMonth(month=month))


def budget_read(budget: Budget, spent: float) -> BudgetRead:
    result = BudgetRead.model_validate(budget)
    result.spent = round(spent, 2)
    return result


def provision_read(p: ProjectProvision, spent: float) -> ProvisionRead:
    result = ProvisionRead.model_validate(p)
    result.spent = round(spent, 2)
    return result


@router.get("", response_model=List[BudgetRead])
def list_budgets(
    month: Optional[str] = Query(None, description="YYYY-MM"),
    exclude_project_ids: Optional[str] = Query(None, description="Comma-separated project IDs to exclude"),
    db: Session = Depends(get_db),
):
    excl = [x for x in (exclude_project_ids or "").split(",") if x]
    q = db.query(Budget)
    if month:
        q = q.filter(Budget.month == month)
    budgets = q.order_by(Budget.created_at).all()
    cache = {}
    out = []
    for b in budgets:
        if b.month not in cache:
            cache[b.month] = month_figures(db, b.month, excl)[1]
        out.append(budget_read(b, cache[b.month].get(b.category_id, 0.0)))
    return out


@router.get("/overview", response_model=BudgetOverview)
def overview(
    month: str = Query(..., description="YYYY-MM"),
    today: Optional[str] = Query(None, description="The phone's date, YYYY-MM-DD"),
    db: Session = Depends(get_db),
):
    today = local_today(today)
    this_month = today.strftime("%Y-%m")
    # Budgets carry over on their own into the current month; other months offer a copy
    carried = carry_over(db, month) if month == this_month else None

    days = monthrange(int(month[:4]), int(month[5:7]))[1]
    if month < this_month:
        pace = 1.0
    elif month > this_month:
        pace = 0.0
    else:
        pace = today.day / days

    provisions, by_category, by_project, real_category, real_spent = month_figures(db, month)
    budgets = db.query(Budget).filter(Budget.month == month).order_by(Budget.created_at).all()
    budgeted = {b.category_id for b in budgets}

    categories = [
        CategorySpend(
            category_id=key,
            name=cat.name if cat else "Uncategorised",
            icon=cat.icon if cat else "❓",
            color=cat.color if cat else "#9ca3af",
            spent=round(spent, 2),
        )
        for key, spent in real_spent.items() if spent > 0.005
        for cat in [real_category[key]]
    ]
    categories.sort(key=lambda c: -c.spent)

    return BudgetOverview(
        month=month,
        days_in_month=days,
        pace=round(pace, 4),
        budgets=[budget_read(b, by_category.get(b.category_id, 0.0)) for b in budgets],
        provisions=[provision_read(p, by_project.get(p.project_id, 0.0)) for p in provisions],
        categories=categories,
        total_spent=round(sum(real_spent.values()), 2),
        unbudgeted_spent=round(sum(v for k, v in by_category.items() if k not in budgeted), 2),
        carried_from=carried,
        previous_month=None if budgets else previous_budget_month(db, month),
    )


@router.get("/suggestions", response_model=List[BudgetSuggestion])
def suggestions(month: str = Query(..., description="YYYY-MM"), db: Session = Depends(get_db)):
    """A starting budget per expense category: the average of the 3 months before,
    rounded up a little so a normal month fits."""
    totals = defaultdict(float)
    months_with_data = 0
    for i in range(1, 4):
        parts = spending_parts(db, shift_month(month, -i))
        if parts:
            months_with_data += 1
        for category, _, cost in parts:
            if category:
                totals[category.id] += cost
    if not months_with_data:
        return []
    out = []
    for cat_id, total in totals.items():
        avg = total / months_with_data
        if avg < 5:
            continue
        step = 5 if avg < 100 else 10 if avg < 500 else 25
        out.append(BudgetSuggestion(category_id=cat_id, amount=math.ceil(avg / step) * step, average=round(avg, 2)))
    out.sort(key=lambda s: -s.amount)
    return out


@router.post("", response_model=BudgetRead)
def create_budget(data: BudgetCreate, db: Session = Depends(get_db)):
    if data.amount < 0:
        raise HTTPException(status_code=400, detail="Budget can't be negative")
    existing = db.query(Budget).filter(Budget.month == data.month, Budget.category_id == data.category_id).first()
    if existing:
        existing.amount = data.amount
        budget = existing
    else:
        budget = Budget(id=str(uuid.uuid4()), category_id=data.category_id, amount=data.amount, month=data.month)
        db.add(budget)
    mark_month(db, data.month)
    db.commit()
    db.refresh(budget)
    return budget_read(budget, month_figures(db, budget.month)[1].get(budget.category_id, 0.0))


@router.post("/copy", response_model=List[BudgetRead])
def copy_budgets(
    month: str = Query(..., description="YYYY-MM to fill"),
    source: str = Query(..., description="YYYY-MM to copy from"),
    db: Session = Depends(get_db),
):
    have = {b.category_id for b in db.query(Budget).filter(Budget.month == month).all()}
    for b in db.query(Budget).filter(Budget.month == source).all():
        if b.category_id not in have:
            db.add(Budget(id=str(uuid.uuid4()), category_id=b.category_id, amount=b.amount, month=month))
    mark_month(db, month)
    db.commit()
    return list_budgets(month=month, exclude_project_ids=None, db=db)


@router.put("/{budget_id}", response_model=BudgetRead)
def update_budget(budget_id: str, data: BudgetUpdate, db: Session = Depends(get_db)):
    budget = db.query(Budget).filter(Budget.id == budget_id).first()
    if not budget:
        raise HTTPException(status_code=404, detail="Budget not found")
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(budget, field, value)
    db.commit()
    db.refresh(budget)
    return budget_read(budget, month_figures(db, budget.month)[1].get(budget.category_id, 0.0))


@router.delete("/{budget_id}")
def delete_budget(budget_id: str, db: Session = Depends(get_db)):
    budget = db.query(Budget).filter(Budget.id == budget_id).first()
    if not budget:
        raise HTTPException(status_code=404, detail="Budget not found")
    mark_month(db, budget.month)
    db.delete(budget)
    db.commit()
    return {"ok": True}


# ── Project provisions ───────────────────────────────────────────────────────

@router.post("/provisions", response_model=ProvisionRead)
def create_provision(data: ProvisionCreate, db: Session = Depends(get_db)):
    if data.amount < 0:
        raise HTTPException(status_code=400, detail="Amount can't be negative")
    if not db.get(Project, data.project_id):
        raise HTTPException(status_code=404, detail="Project not found")
    p = db.query(ProjectProvision).filter(
        ProjectProvision.month == data.month, ProjectProvision.project_id == data.project_id,
    ).first()
    if p:
        p.amount = data.amount
    else:
        p = ProjectProvision(id=str(uuid.uuid4()), project_id=data.project_id, amount=data.amount, month=data.month)
        db.add(p)
    mark_month(db, data.month)
    db.commit()
    db.refresh(p)
    return provision_read(p, month_figures(db, p.month)[2].get(p.project_id, 0.0))


@router.put("/provisions/{provision_id}", response_model=ProvisionRead)
def update_provision(provision_id: str, data: ProvisionUpdate, db: Session = Depends(get_db)):
    p = db.get(ProjectProvision, provision_id)
    if not p:
        raise HTTPException(status_code=404, detail="Provision not found")
    if data.amount is not None:
        p.amount = data.amount
    db.commit()
    db.refresh(p)
    return provision_read(p, month_figures(db, p.month)[2].get(p.project_id, 0.0))


@router.delete("/provisions/{provision_id}")
def delete_provision(provision_id: str, db: Session = Depends(get_db)):
    p = db.get(ProjectProvision, provision_id)
    if not p:
        raise HTTPException(status_code=404, detail="Provision not found")
    db.delete(p)
    db.commit()
    return {"ok": True}
