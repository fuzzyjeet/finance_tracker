from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
import uuid
from database import get_db
from models import Project, Transaction, TransactionSplit
from schemas import ProjectCreate, ProjectUpdate, ProjectRead

router = APIRouter()

STATUS_ORDER = {"active": 0, "planned": 1, "on_hold": 2, "completed": 3}


@router.get("", response_model=List[ProjectRead])
def list_projects(db: Session = Depends(get_db)):
    projects = db.query(Project).order_by(Project.created_at.desc()).all()
    return sorted(projects, key=lambda p: STATUS_ORDER.get(p.status, 9))


@router.post("", response_model=ProjectRead)
def create_project(data: ProjectCreate, db: Session = Depends(get_db)):
    project = Project(id=str(uuid.uuid4()), **data.model_dump())
    db.add(project)
    db.commit()
    db.refresh(project)
    return project


@router.get("/{project_id}", response_model=ProjectRead)
def get_project(project_id: str, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


@router.put("/{project_id}", response_model=ProjectRead)
def update_project(project_id: str, data: ProjectUpdate, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(project, field, value)
    db.commit()
    db.refresh(project)
    return project


@router.delete("/{project_id}")
def delete_project(project_id: str, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    db.delete(project)
    db.commit()
    return {"ok": True}


@router.get("/{project_id}/spending")
def get_project_spending(project_id: str, db: Session = Depends(get_db)):
    """Returns total spent, category breakdown, and full transaction list for a project."""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Transactions directly in this project (no splits with project assignments)
    direct_txns = (
        db.query(Transaction)
        .filter(Transaction.projects.any(Project.id == project_id))
        .all()
    )

    # Splits in this project
    project_splits = (
        db.query(TransactionSplit)
        .filter(TransactionSplit.projects.any(Project.id == project_id))
        .all()
    )

    # Build category breakdown
    cat_map: dict = {}

    def _add_to_cat(category, amount):
        if not category:
            key = "__none__"
            if key not in cat_map:
                cat_map[key] = {"category_id": None, "name": "Uncategorised", "icon": "❓", "color": "#9ca3af", "amount": 0}
            cat_map[key]["amount"] += amount
        else:
            if category.id not in cat_map:
                cat_map[category.id] = {"category_id": category.id, "name": category.name, "icon": category.icon, "color": category.color, "amount": 0}
            cat_map[category.id]["amount"] += amount

    total_spent = 0.0

    for txn in direct_txns:
        if txn.type in ("expense",):
            # Only count this transaction directly if it has no split-level project assignments
            has_split_projects = any(p for s in txn.splits for p in s.projects)
            if not has_split_projects:
                total_spent += txn.amount
                if txn.splits:
                    for s in txn.splits:
                        _add_to_cat(s.category, s.amount)
                else:
                    _add_to_cat(txn.category, txn.amount)

    for split in project_splits:
        if split.transaction.type in ("expense",):
            total_spent += split.amount
            _add_to_cat(split.category, split.amount)

    # Build transaction entries for the list
    # Collect unique transactions that touch this project
    txn_ids_seen: set = set()
    txn_entries = []

    def _add_txn_entry(txn: Transaction, highlight_split_id: Optional[str] = None):
        if txn.id in txn_ids_seen:
            return
        txn_ids_seen.add(txn.id)
        entry = {
            "id": txn.id,
            "date": txn.date,
            "payee": txn.payee,
            "amount": txn.amount,
            "type": txn.type,
            "account_name": txn.account.name if txn.account else None,
            "category": {"name": txn.category.name, "icon": txn.category.icon, "color": txn.category.color} if txn.category else None,
            "notes": txn.notes,
            "tags": [{"id": t.id, "name": t.name, "color": t.color} for t in txn.tags],
            "splits": [
                {
                    "id": s.id,
                    "amount": s.amount,
                    "notes": s.notes,
                    "category": {"name": s.category.name, "icon": s.category.icon, "color": s.category.color} if s.category else None,
                    "in_project": any(p.id == project_id for p in s.projects),
                }
                for s in txn.splits
            ],
        }
        txn_entries.append(entry)

    for txn in direct_txns:
        _add_txn_entry(txn)

    for split in project_splits:
        _add_txn_entry(split.transaction, highlight_split_id=split.id)

    txn_entries.sort(key=lambda e: e["date"], reverse=True)

    return {
        "project": {
            "id": project.id,
            "name": project.name,
            "icon": project.icon,
            "color": project.color,
            "status": project.status,
            "start_date": project.start_date,
            "end_date": project.end_date,
            "budget": project.budget,
            "description": project.description,
        },
        "total_spent": total_spent,
        "by_category": sorted(cat_map.values(), key=lambda x: x["amount"], reverse=True),
        "transactions": txn_entries,
    }
