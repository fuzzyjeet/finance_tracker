import uuid
from datetime import date, timedelta
from database import SessionLocal
from models import Account, Category, Transaction, Budget, Tag


CATEGORIES = [
    # Expense categories
    {"name": "Food & Dining", "icon": "🍔", "color": "#f97316", "type": "expense"},
    {"name": "Transport", "icon": "🚗", "color": "#3b82f6", "type": "expense"},
    {"name": "Shopping", "icon": "🛍️", "color": "#8b5cf6", "type": "expense"},
    {"name": "Entertainment", "icon": "🎬", "color": "#ec4899", "type": "expense"},
    {"name": "Housing", "icon": "🏠", "color": "#14b8a6", "type": "expense"},
    {"name": "Utilities", "icon": "💡", "color": "#f59e0b", "type": "expense"},
    {"name": "Healthcare", "icon": "🏥", "color": "#ef4444", "type": "expense"},
    {"name": "Education", "icon": "📚", "color": "#06b6d4", "type": "expense"},
    {"name": "Travel", "icon": "✈️", "color": "#84cc16", "type": "expense"},
    {"name": "Personal Care", "icon": "💅", "color": "#f472b6", "type": "expense"},
    # Income categories
    {"name": "Salary", "icon": "💼", "color": "#22c55e", "type": "income"},
    {"name": "Freelance", "icon": "💻", "color": "#10b981", "type": "income"},
    {"name": "Investment Returns", "icon": "📈", "color": "#6366f1", "type": "income"},
    {"name": "Other Income", "icon": "💰", "color": "#a3e635", "type": "income"},
]


def seed_data():
    db = SessionLocal()
    try:
        # Only seed if no categories exist
        if db.query(Category).count() > 0:
            return

        # Create categories
        cats = {}
        for c in CATEGORIES:
            cat = Category(id=str(uuid.uuid4()), **c)
            db.add(cat)
            cats[c["name"]] = cat

        db.flush()

        # Create accounts
        checking = Account(
            id=str(uuid.uuid4()),
            name="Chase Checking",
            type="checking",
            balance=0.0,
            color="#3b82f6",
        )
        savings = Account(
            id=str(uuid.uuid4()),
            name="Wells Fargo Savings",
            type="savings",
            balance=0.0,
            color="#22c55e",
        )
        credit = Account(
            id=str(uuid.uuid4()),
            name="Visa Credit Card",
            type="credit_card",
            balance=0.0,
            color="#ef4444",
            billing_cycle_day=25,
        )
        db.add_all([checking, savings, credit])
        db.flush()

        today = date.today()

        def days_ago(n):
            return (today - timedelta(days=n)).isoformat()

        # 20 sample transactions over last 60 days
        transactions_data = [
            # Income
            {"date": days_ago(55), "amount": 4500.00, "type": "income", "payee": "Acme Corp", "category": "Salary", "account": checking},
            {"date": days_ago(25), "amount": 4500.00, "type": "income", "payee": "Acme Corp", "category": "Salary", "account": checking},
            {"date": days_ago(40), "amount": 800.00, "type": "income", "payee": "Side Project Client", "category": "Freelance", "account": checking},
            {"date": days_ago(10), "amount": 150.00, "type": "income", "payee": "Dividend Payment", "category": "Investment Returns", "account": savings},
            # Expenses - Checking
            {"date": days_ago(52), "amount": 1200.00, "type": "expense", "payee": "Landlord", "category": "Housing", "account": checking},
            {"date": days_ago(22), "amount": 1200.00, "type": "expense", "payee": "Landlord", "category": "Housing", "account": checking},
            {"date": days_ago(48), "amount": 85.00, "type": "expense", "payee": "Electric Company", "category": "Utilities", "account": checking},
            {"date": days_ago(18), "amount": 90.00, "type": "expense", "payee": "Electric Company", "category": "Utilities", "account": checking},
            {"date": days_ago(50), "amount": 45.00, "type": "expense", "payee": "Internet Provider", "category": "Utilities", "account": checking},
            # Expenses - Credit Card
            {"date": days_ago(45), "amount": 127.50, "type": "expense", "payee": "Whole Foods", "category": "Food & Dining", "account": credit},
            {"date": days_ago(38), "amount": 62.00, "type": "expense", "payee": "Shell Gas Station", "category": "Transport", "account": credit},
            {"date": days_ago(30), "amount": 89.99, "type": "expense", "payee": "Amazon", "category": "Shopping", "account": credit},
            {"date": days_ago(28), "amount": 35.00, "type": "expense", "payee": "Spotify + Netflix", "category": "Entertainment", "account": credit},
            {"date": days_ago(20), "amount": 210.00, "type": "expense", "payee": "Trader Joe's", "category": "Food & Dining", "account": credit},
            {"date": days_ago(15), "amount": 55.00, "type": "expense", "payee": "CVS Pharmacy", "category": "Healthcare", "account": credit},
            {"date": days_ago(12), "amount": 145.00, "type": "expense", "payee": "Uber + Lyft", "category": "Transport", "account": credit},
            {"date": days_ago(8), "amount": 320.00, "type": "expense", "payee": "Delta Airlines", "category": "Travel", "account": credit},
            {"date": days_ago(5), "amount": 78.00, "type": "expense", "payee": "Target", "category": "Shopping", "account": credit},
            # Savings transfer
            {"date": days_ago(35), "amount": 500.00, "type": "transfer", "payee": "Transfer to Savings", "category": None, "account": checking, "to_account": savings},
            # Credit card payment (transfer)
            {"date": days_ago(20), "amount": 400.00, "type": "transfer", "payee": "Credit Card Payment", "category": None, "account": checking, "to_account": credit},
        ]

        for t_data in transactions_data:
            t = Transaction(
                id=str(uuid.uuid4()),
                date=t_data["date"],
                amount=t_data["amount"],
                type=t_data["type"],
                payee=t_data["payee"],
                account_id=t_data["account"].id,
                to_account_id=t_data.get("to_account", {}).id if t_data.get("to_account") else None,
                category_id=cats[t_data["category"]].id if t_data.get("category") else None,
            )
            db.add(t)

        db.flush()

        # Recalculate balances
        from routers.accounts import recalculate_balance
        for acct in [checking, savings, credit]:
            recalculate_balance(db, acct.id)

        # Create 3 budgets for current month
        current_month = today.strftime("%Y-%m")
        budget_data = [
            {"category": "Food & Dining", "amount": 500.00},
            {"category": "Transport", "amount": 200.00},
            {"category": "Shopping", "amount": 300.00},
        ]
        for b_data in budget_data:
            b = Budget(
                id=str(uuid.uuid4()),
                category_id=cats[b_data["category"]].id,
                amount=b_data["amount"],
                month=current_month,
            )
            db.add(b)

        db.commit()
        print("Database seeded successfully.")
    except Exception as e:
        db.rollback()
        print(f"Seeding error: {e}")
    finally:
        db.close()
