from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from database import engine
import models
from routers import accounts, transactions, categories, budgets, recurring, tags
from services.scheduler import start_scheduler
from seed import seed_data

models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="Finance Tracker API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(accounts.router, prefix="/api/accounts", tags=["accounts"])
app.include_router(transactions.router, prefix="/api/transactions", tags=["transactions"])
app.include_router(categories.router, prefix="/api/categories", tags=["categories"])
app.include_router(budgets.router, prefix="/api/budgets", tags=["budgets"])
app.include_router(recurring.router, prefix="/api/recurring", tags=["recurring"])
app.include_router(tags.router, prefix="/api/tags", tags=["tags"])


@app.on_event("startup")
async def startup():
    # Runtime migration: add new columns if missing
    from sqlalchemy import text, inspect as sa_inspect
    with engine.connect() as conn:
        inspector = sa_inspect(engine)
        account_cols = [c["name"] for c in inspector.get_columns("accounts")]
        if "currency" not in account_cols:
            conn.execute(text("ALTER TABLE accounts ADD COLUMN currency VARCHAR NOT NULL DEFAULT 'EUR'"))
            conn.commit()
    seed_data()
    _ensure_default_categories()
    start_scheduler()


def _ensure_default_categories():
    """Add categories that may be missing from older installs."""
    from database import SessionLocal
    from models import Category
    import uuid
    db = SessionLocal()
    try:
        missing = [
            {"name": "Lent to Friends", "icon": "🤝", "color": "#a78bfa", "type": "expense"},
            {"name": "Household",        "icon": "🏡", "color": "#2dd4bf", "type": "expense"},
        ]
        for cat in missing:
            exists = db.query(Category).filter(Category.name == cat["name"]).first()
            if not exists:
                db.add(Category(id=str(uuid.uuid4()), **cat))
        db.commit()
    finally:
        db.close()


@app.get("/api/health")
def health():
    return {"status": "ok"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
