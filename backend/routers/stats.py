from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import Optional
from collections import defaultdict
from database import get_db
from clock import local_today
from models import Account, RecurringTransaction, Transaction
from routers.budgets import month_bounds, my_cost_factor, shift_month
from routers.transactions import refund_surplus

router = APIRouter()

NO_CATEGORY = "none"


@router.get("/trends")
def trends(
    months: int = Query(12, ge=1, le=60),
    end: Optional[str] = Query(None, description="Last month, YYYY-MM (default: this month)"),
    category_id: Optional[str] = Query(None, description=f"Only this category ('{NO_CATEGORY}' = uncategorised)"),
    payee: Optional[str] = Query(None, description="Only this payee (case-insensitive)"),
    today: Optional[str] = Query(None, description="The phone's date, YYYY-MM-DD"),
    db: Session = Depends(get_db),
):
    """Monthly figures for the dashboard. Spending is my share after refunds, counted in
    the month of the original expense; split entries count each part in its category."""
    today = local_today(today)
    this_month = today.strftime("%Y-%m")
    end = end or this_month
    month_list = [shift_month(end, i - months + 1) for i in range(months)]
    index = {m: i for i, m in enumerate(month_list)}
    start, _ = month_bounds(month_list[0])
    _, stop = month_bounds(end)
    # Include the month before so "by this day last month" works for the first month too
    prev_start, _ = month_bounds(shift_month(month_list[0], -1))

    txns = db.query(Transaction).filter(
        Transaction.date >= prev_start, Transaction.date < stop,
        Transaction.type.in_(["expense", "income", "refund"]),
    ).all()

    spending = [0.0] * months
    income = [0.0] * months
    expenses = [0.0] * months
    for_others = [0.0] * months
    paid_back = [0.0] * months
    categories = {}
    payees = {}
    so_far_last_month = 0.0
    prev_of_end = shift_month(end, -1)
    payee_key = payee.strip().lower() if payee else None

    def wanted_category(cat) -> bool:
        if not category_id:
            return True
        return (cat.id if cat else NO_CATEGORY) == category_id

    for t in txns:
        m = t.date[:7]
        i = index.get(m)
        if t.type == "income":
            if i is not None:
                if t.paid_back:
                    paid_back[i] += t.amount
                else:
                    income[i] += t.amount
            continue
        if t.type == "refund":
            # The part of a refund not linked to an expense counts as income
            if i is not None:
                income[i] += refund_surplus(t)
            continue

        factor = my_cost_factor(t)
        if i is not None:
            for_others[i] += t.for_others or 0
        parts = [(s.category, s.amount * factor) for s in t.splits] if t.splits else [(t.category, t.amount * factor)]
        name = (t.payee or "").strip()
        for cat, cost in parts:
            if i is not None:
                expenses[i] += cost
                key = cat.id if cat else NO_CATEGORY
                if key not in categories:
                    categories[key] = {
                        "id": key,
                        "name": cat.name if cat else "Uncategorised",
                        "icon": cat.icon if cat else "❓",
                        "color": cat.color if cat else "#9ca3af",
                        "amounts": [0.0] * months,
                    }
                categories[key]["amounts"][i] += cost
            if not wanted_category(cat):
                continue
            if category_id and i is not None:
                pk = name.lower()
                if pk not in payees:
                    payees[pk] = {"payee": name or "No payee", "amounts": [0.0] * months}
                payees[pk]["amounts"][i] += cost
            if payee_key is not None and name.lower() != payee_key:
                continue
            if i is not None:
                spending[i] += cost
            if end == this_month and m == prev_of_end and int(t.date[8:10]) <= today.day:
                so_far_last_month += cost

    r = lambda xs: [round(x, 2) for x in xs]
    for c in categories.values():
        c["amounts"] = r(c["amounts"])
    for p in payees.values():
        p["amounts"] = r(p["amounts"])
    return {
        "months": month_list,
        "spending": r(spending),
        "income": r(income),
        "expenses": r(expenses),
        "net": r([a - b for a, b in zip(income, expenses)]),
        # Spent on others (part of expenses) and money paid back to me (not income)
        "for_others": r(for_others),
        "paid_back": r(paid_back),
        "categories": sorted(categories.values(), key=lambda c: -sum(c["amounts"])),
        "payees": sorted(payees.values(), key=lambda p: -sum(p["amounts"])),
        # Spending by today's day of the month, last month: to compare "so far"
        "so_far_last_month": round(so_far_last_month, 2) if end == this_month else None,
        "day_of_month": today.day if end == this_month else None,
    }


BASE_CURRENCY = "EUR"
SAVINGS_TYPES = {"savings", "investment"}
# Average days per period, to turn recurring entries into a monthly figure
MONTHLY_FACTOR = {"daily": 30.44, "weekly": 30.44 / 7, "monthly": 1.0, "yearly": 1 / 12}


def balance_effect(t: Transaction, included: set) -> float:
    """How a transaction changed the total across the included accounts."""
    if t.type == "transfer":
        return (t.amount if t.to_account_id in included else 0.0) - (t.amount if t.account_id in included else 0.0)
    if t.account_id not in included:
        return 0.0
    return -t.amount if t.type == "expense" else t.amount


@router.get("/health")
def health(
    months: int = Query(24, ge=2, le=60),
    today: Optional[str] = Query(None, description="The phone's date, YYYY-MM-DD"),
    db: Session = Depends(get_db),
):
    """What I have across accounts and how it changed, for the financial health page.
    Only accounts in the base currency count until amounts can be converted."""
    today = local_today(today)
    this_month = today.strftime("%Y-%m")
    month_list = [shift_month(this_month, i - months + 1) for i in range(months)]

    accounts = db.query(Account).all()
    included = [a for a in accounts if (a.currency or BASE_CURRENCY) == BASE_CURRENCY]
    ids = {a.id for a in included}
    savings_ids = {a.id for a in included if a.type in SAVINGS_TYPES}
    total = sum(a.balance for a in included)

    # Total at each month end: today's total, minus everything dated after that month
    first_end = month_bounds(month_list[0])[1]
    txns = db.query(Transaction).filter(Transaction.date >= first_end).all()
    after = defaultdict(float)  # month -> net change in that month
    moved = defaultdict(float)  # month -> net transfers into savings and investments
    for t in txns:
        m = t.date[:7]
        after[m] += balance_effect(t, ids)
        if t.type == "transfer":
            into = t.to_account_id in savings_ids
            out_of = t.account_id in savings_ids
            if into and not out_of:
                moved[m] += t.amount
            elif out_of and not into:
                moved[m] -= t.amount
    later = sorted(after)
    worth = []
    for m in month_list:
        worth.append(round(total - sum(after[x] for x in later if x > m), 2))

    # Moved to savings for every month, also before the history window (for long averages)
    for t in db.query(Transaction).filter(Transaction.type == "transfer", Transaction.date < first_end).all():
        into, out_of = t.to_account_id in savings_ids, t.account_id in savings_ids
        if into != out_of:
            moved[t.date[:7]] += t.amount if into else -t.amount

    fixed = 0.0
    for r in db.query(RecurringTransaction).filter(
        RecurringTransaction.is_active == True, RecurringTransaction.type == "expense",  # noqa: E712
    ).all():
        if r.end_date and r.end_date < today.isoformat():
            continue
        factor = MONTHLY_FACTOR.get(r.frequency)
        if factor is None:
            factor = 30.44 / r.custom_interval_days if r.custom_interval_days else 0.0
        fixed += r.amount * factor

    return {
        "currency": BASE_CURRENCY,
        "accounts": [
            {"id": a.id, "name": a.name, "type": a.type, "color": a.color, "balance": round(a.balance, 2),
             "parent_id": a.parent_id, "is_active": a.is_active, "logo": a.logo}
            for a in sorted(included, key=lambda a: -abs(a.balance))
        ],
        "left_out": sorted({a.currency for a in accounts if a.id not in ids}),
        "months": month_list,
        "worth": worth,
        "moved_to_savings": {m: round(v, 2) for m, v in sorted(moved.items())},
        "fixed_monthly": round(fixed, 2),
    }
