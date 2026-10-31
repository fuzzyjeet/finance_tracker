from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from database import engine
import models
import os
from routers import accounts, transactions, categories, budgets, recurring, tags, projects, stats
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
app.include_router(projects.router, prefix="/api/projects", tags=["projects"])
app.include_router(stats.router, prefix="/api/stats", tags=["stats"])


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
        if "opening_balance" not in account_cols:
            conn.execute(text("ALTER TABLE accounts ADD COLUMN opening_balance FLOAT NOT NULL DEFAULT 0"))
            conn.commit()
        if "parent_id" not in account_cols:
            conn.execute(text("ALTER TABLE accounts ADD COLUMN parent_id VARCHAR REFERENCES accounts(id) ON DELETE SET NULL"))
            conn.commit()
        if "is_active" not in account_cols:
            conn.execute(text("ALTER TABLE accounts ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT 1"))
            conn.commit()
        txn_cols = [c["name"] for c in inspector.get_columns("transactions")]
        if "time" not in txn_cols:
            conn.execute(text("ALTER TABLE transactions ADD COLUMN time VARCHAR"))
            conn.commit()
        if "for_others" not in txn_cols:
            conn.execute(text("ALTER TABLE transactions ADD COLUMN for_others FLOAT NOT NULL DEFAULT 0"))
            conn.commit()
        if "paid_back" not in txn_cols:
            conn.execute(text("ALTER TABLE transactions ADD COLUMN paid_back BOOLEAN NOT NULL DEFAULT 0"))
            conn.commit()
        # Legacy single-link refunds (refund_of_id) → refund_links table
        if "refund_of_id" in txn_cols:
            conn.execute(text("""
                INSERT INTO refund_links (id, refund_id, original_id, amount)
                SELECT lower(hex(randomblob(16))), t.id, t.refund_of_id, t.amount
                FROM transactions t
                WHERE t.refund_of_id IS NOT NULL
                  AND NOT EXISTS (SELECT 1 FROM refund_links l WHERE l.refund_id = t.id)
            """))
            conn.execute(text("UPDATE transactions SET refund_of_id = NULL WHERE refund_of_id IS NOT NULL"))
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
            {"name": "Social",           "icon": "🥂", "color": "#f472b6", "type": "expense"},
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


# Serve React frontend (production build)
_static_dir = os.path.join(os.path.dirname(__file__), "../dist")
if os.path.isdir(_static_dir):
    app.mount("/assets", StaticFiles(directory=os.path.join(_static_dir, "assets")), name="assets")

    _static_root = os.path.realpath(_static_dir)

    @app.get("/{full_path:path}", include_in_schema=False)
    def serve_spa(full_path: str):
        # Real files in dist/ (manifest, icons, favicon) are served as-is; every other path is the SPA
        candidate = os.path.realpath(os.path.join(_static_root, full_path))
        if full_path and candidate.startswith(_static_root + os.sep) and os.path.isfile(candidate):
            return FileResponse(candidate)
        return FileResponse(os.path.join(_static_dir, "index.html"))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
