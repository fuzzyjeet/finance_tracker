from apscheduler.schedulers.background import BackgroundScheduler
from database import SessionLocal
from datetime import date, timedelta
from dateutil.relativedelta import relativedelta


def advance_next_due_date(recurring, current_due: date) -> date:
    if recurring.frequency == 'daily':
        return current_due + timedelta(days=1)
    elif recurring.frequency == 'weekly':
        return current_due + timedelta(weeks=1)
    elif recurring.frequency == 'monthly':
        return current_due + relativedelta(months=1)
    elif recurring.frequency == 'yearly':
        return current_due + relativedelta(years=1)
    elif recurring.frequency == 'custom':
        days = recurring.custom_interval_days or 1
        return current_due + timedelta(days=days)
    return current_due + relativedelta(months=1)


def post_due_recurring():
    db = SessionLocal()
    try:
        from models import RecurringTransaction, Transaction
        import uuid
        today = date.today().isoformat()
        due = db.query(RecurringTransaction).filter(
            RecurringTransaction.is_active == True,
            RecurringTransaction.auto_post == True,
            RecurringTransaction.next_due_date <= today,
        ).all()
        for r in due:
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

        from routers.accounts import recalculate_balance
        for r in due:
            recalculate_balance(db, r.account_id)
            if r.to_account_id:
                recalculate_balance(db, r.to_account_id)
        db.commit()
    except Exception as e:
        db.rollback()
        print(f"Scheduler error: {e}")
    finally:
        db.close()


def start_scheduler():
    scheduler = BackgroundScheduler()
    scheduler.add_job(post_due_recurring, 'interval', hours=1)
    scheduler.start()
