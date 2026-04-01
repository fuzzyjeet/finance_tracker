import uuid
from datetime import date, timedelta
from database import SessionLocal
from models import Account, Category, Transaction, Budget, Tag


CATEGORIES = [
    {"name": "Food & Dining",    "icon": "🍔", "color": "#f97316", "type": "expense"},
    {"name": "Transport",        "icon": "🚆", "color": "#3b82f6", "type": "expense"},
    {"name": "Shopping",         "icon": "🛍️", "color": "#8b5cf6", "type": "expense"},
    {"name": "Entertainment",    "icon": "🎬", "color": "#ec4899", "type": "expense"},
    {"name": "Housing",          "icon": "🏠", "color": "#14b8a6", "type": "expense"},
    {"name": "Utilities",        "icon": "💡", "color": "#f59e0b", "type": "expense"},
    {"name": "Healthcare",       "icon": "🏥", "color": "#ef4444", "type": "expense"},
    {"name": "Education",        "icon": "📚", "color": "#06b6d4", "type": "expense"},
    {"name": "Travel",           "icon": "✈️", "color": "#84cc16", "type": "expense"},
    {"name": "Personal Care",    "icon": "💅", "color": "#f472b6", "type": "expense"},
    {"name": "Salary",           "icon": "💼", "color": "#22c55e", "type": "income"},
    {"name": "Freelance",        "icon": "💻", "color": "#10b981", "type": "income"},
    {"name": "Investment Returns","icon": "📈","color": "#6366f1", "type": "income"},
    {"name": "Other Income",     "icon": "💰", "color": "#a3e635", "type": "income"},
]

TAGS = [
    {"name": "Essential",    "color": "#22c55e"},
    {"name": "Subscription", "color": "#3b82f6"},
    {"name": "Work",         "color": "#8b5cf6"},
    {"name": "Personal",     "color": "#f97316"},
    {"name": "Holiday",      "color": "#ec4899"},
]


def seed_data():
    db = SessionLocal()
    try:
        if db.query(Category).count() > 0:
            return

        # Categories
        cats = {}
        for c in CATEGORIES:
            cat = Category(id=str(uuid.uuid4()), **c)
            db.add(cat)
            cats[c["name"]] = cat
        db.flush()

        # Tags
        tags = {}
        for t in TAGS:
            tag = Tag(id=str(uuid.uuid4()), **t)
            db.add(tag)
            tags[t["name"]] = tag
        db.flush()

        # Accounts (all EUR, German banks)
        girokonto = Account(
            id=str(uuid.uuid4()),
            name="Deutsche Bank Girokonto",
            type="checking",
            balance=0.0,
            color="#0018a8",
            currency="EUR",
        )
        sparkasse = Account(
            id=str(uuid.uuid4()),
            name="Sparkasse Tagesgeld",
            type="savings",
            balance=0.0,
            color="#ff0000",
            currency="EUR",
        )
        kreditkarte = Account(
            id=str(uuid.uuid4()),
            name="Barclays Kreditkarte",
            type="credit_card",
            balance=0.0,
            color="#1a1a2e",
            currency="EUR",
            billing_cycle_day=28,
        )
        db.add_all([girokonto, sparkasse, kreditkarte])
        db.flush()

        today = date.today()

        def d(n):
            return (today - timedelta(days=n)).isoformat()

        # 20 transactions representing life in Germany (EUR)
        txns_data = [
            # Income
            {"date": d(58), "amount": 4200.00, "type": "income",   "payee": "SAP SE – Gehalt",             "cat": "Salary",           "acct": girokonto},
            {"date": d(28), "amount": 4200.00, "type": "income",   "payee": "SAP SE – Gehalt",             "cat": "Salary",           "acct": girokonto},
            {"date": d(42), "amount": 650.00,  "type": "income",   "payee": "Freelance Rechnung #2024-03", "cat": "Freelance",        "acct": girokonto},
            {"date": d(14), "amount": 87.50,   "type": "income",   "payee": "Trade Republic Dividende",    "cat": "Investment Returns","acct": sparkasse},
            # Housing
            {"date": d(55), "amount": 1100.00, "type": "expense",  "payee": "Vermieter – Kaltmiete",       "cat": "Housing",          "acct": girokonto},
            {"date": d(25), "amount": 1100.00, "type": "expense",  "payee": "Vermieter – Kaltmiete",       "cat": "Housing",          "acct": girokonto},
            # Utilities
            {"date": d(50), "amount": 94.00,   "type": "expense",  "payee": "Vattenfall Strom",            "cat": "Utilities",        "acct": girokonto},
            {"date": d(20), "amount": 94.00,   "type": "expense",  "payee": "Vattenfall Strom",            "cat": "Utilities",        "acct": girokonto},
            {"date": d(48), "amount": 39.99,   "type": "expense",  "payee": "Telekom Internet & Festnetz", "cat": "Utilities",        "acct": girokonto},
            # Food & Dining (credit card)
            {"date": d(45), "amount": 73.40,   "type": "expense",  "payee": "REWE Mitte",                  "cat": "Food & Dining",    "acct": kreditkarte},
            {"date": d(32), "amount": 54.80,   "type": "expense",  "payee": "Aldi Süd",                    "cat": "Food & Dining",    "acct": kreditkarte},
            {"date": d(18), "amount": 68.20,   "type": "expense",  "payee": "Lidl Prenzlauer Berg",        "cat": "Food & Dining",    "acct": kreditkarte},
            {"date": d(8),  "amount": 42.50,   "type": "expense",  "payee": "Markthalle Neun",             "cat": "Food & Dining",    "acct": kreditkarte},
            # Transport
            {"date": d(55), "amount": 86.00,   "type": "expense",  "payee": "BVG Monatskarte",             "cat": "Transport",        "acct": kreditkarte},
            {"date": d(25), "amount": 86.00,   "type": "expense",  "payee": "BVG Monatskarte",             "cat": "Transport",        "acct": kreditkarte},
            # Entertainment
            {"date": d(40), "amount": 17.99,   "type": "expense",  "payee": "Netflix",                     "cat": "Entertainment",    "acct": kreditkarte},
            {"date": d(40), "amount": 10.99,   "type": "expense",  "payee": "Spotify",                     "cat": "Entertainment",    "acct": kreditkarte},
            # Shopping
            {"date": d(22), "amount": 89.95,   "type": "expense",  "payee": "Zalando",                     "cat": "Shopping",         "acct": kreditkarte},
            # Savings transfer
            {"date": d(35), "amount": 400.00,  "type": "transfer", "payee": "Überweisung Tagesgeld",       "cat": None,               "acct": girokonto, "to": sparkasse},
            # Credit card payment
            {"date": d(15), "amount": 350.00,  "type": "transfer", "payee": "Kreditkarte Abbuchung",       "cat": None,               "acct": girokonto, "to": kreditkarte},
        ]

        for td in txns_data:
            t = Transaction(
                id=str(uuid.uuid4()),
                date=td["date"],
                amount=td["amount"],
                type=td["type"],
                payee=td["payee"],
                account_id=td["acct"].id,
                to_account_id=td.get("to", None) and td["to"].id,
                category_id=cats[td["cat"]].id if td.get("cat") else None,
            )
            db.add(t)
        db.flush()

        # Recalculate balances
        from routers.accounts import recalculate_balance
        for acct in [girokonto, sparkasse, kreditkarte]:
            recalculate_balance(db, acct.id)

        # Budgets for current month
        current_month = today.strftime("%Y-%m")
        for cat_name, amount in [
            ("Food & Dining", 350.00),
            ("Transport",     150.00),
            ("Shopping",      200.00),
            ("Entertainment",  80.00),
        ]:
            db.add(Budget(
                id=str(uuid.uuid4()),
                category_id=cats[cat_name].id,
                amount=amount,
                month=current_month,
            ))

        db.commit()
        print("Database seeded successfully.")
    except Exception as e:
        db.rollback()
        print(f"Seeding error: {e}")
        raise
    finally:
        db.close()
