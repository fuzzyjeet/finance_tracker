import base64
import re
import urllib.request
import uuid
from concurrent.futures import ThreadPoolExecutor
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Response
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session
from database import get_db
from merchants import guess_domain, payee_key
from models import Logo, PayeeLogo, Transaction

router = APIRouter()

DOMAIN = re.compile(r"^(?=.{3,253}$)([a-z0-9-]+\.)+[a-z]{2,}$")
MAX_BYTES = 300_000
MIN_SIZE = 48  # smaller icons look blurry in the app; try the next source
# Where to look, best first. The server fetches them, so the phone never talks to these sites.
SOURCES = [
    "https://www.google.com/s2/favicons?domain={domain}&sz=128",
    "https://{domain}/apple-touch-icon.png",
    "https://icons.duckduckgo.com/ip3/{domain}.ico",
]
TYPES = {b"\x89PNG": "image/png", b"\xff\xd8\xff": "image/jpeg", b"GIF8": "image/gif", b"\x00\x00\x01\x00": "image/x-icon", b"RIFF": "image/webp"}


def clean_domain(value: str) -> str:
    d = value.strip().lower()
    d = re.sub(r"^[a-z]+://", "", d).split("/")[0].removeprefix("www.")
    if not DOMAIN.match(d):
        raise HTTPException(status_code=400, detail="That doesn't look like a website, e.g. paypal.com")
    return d


def image_type(data: bytes):
    return next((t for sig, t in TYPES.items() if data.startswith(sig)), None)


def png_size(data: bytes):
    if data.startswith(b"\x89PNG") and len(data) >= 24:
        return int.from_bytes(data[16:20], "big"), int.from_bytes(data[20:24], "big")
    return None


def fetch_logo(domain: str, sources=None, timeout=6.0):
    """The first usable icon for the domain as a data URL, or None."""
    for template in sources or SOURCES:
        url = template.format(domain=domain)
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 JeetMoney logo fetcher"})
            with urllib.request.urlopen(req, timeout=timeout) as res:
                data = res.read(MAX_BYTES + 1)
        except Exception:
            continue
        kind = image_type(data)
        if not kind or len(data) > MAX_BYTES:
            continue
        size = png_size(data)
        if size and min(size) < MIN_SIZE:
            continue
        return f"data:{kind};base64,{base64.b64encode(data).decode()}"
    return None


@router.get("")
def find_logo(domain: str = Query(..., description="The bank or service's website, e.g. paypal.com")):
    d = clean_domain(domain)
    logo = fetch_logo(d)
    if not logo:
        raise HTTPException(status_code=404, detail=f"No logo found for {d}. You can upload one instead.")
    return {"domain": d, "logo": logo}


# ── Payee logos ──────────────────────────────────────────────────────────────

def logo_bytes(data_url: str):
    """Splits a data URL into (content type, bytes)."""
    head, _, body = data_url.partition(",")
    return head[5:].split(";")[0], base64.b64decode(body)


def store_logo(db: Session, key: str, data_url: str) -> Logo:
    kind, data = logo_bytes(data_url)
    logo = db.get(Logo, key)
    if logo:
        logo.content_type, logo.data = kind, data
    else:
        logo = Logo(key=key, content_type=kind, data=data)
        db.add(logo)
    return logo


def payee_rows(db: Session):
    """Every payee with how often it's used, its chosen or guessed website, and its logo."""
    counts: dict = {}
    for payee, n, last in (
        db.query(Transaction.payee, func.count(Transaction.id), func.max(Transaction.date))
        .filter(Transaction.type != "transfer", Transaction.payee != "")
        .group_by(Transaction.payee).all()
    ):
        key = payee_key(payee)
        if not key:
            continue
        row = counts.setdefault(key, {"payee": key, "name": payee, "count": 0, "last": last, "names": {}})
        row["count"] += n
        row["names"][payee] = row["names"].get(payee, 0) + n
        row["last"] = max(row["last"], last)
    overrides = {p.payee: p for p in db.query(PayeeLogo).all()}
    stored = {k for (k,) in db.query(Logo.key).all()}
    rows = []
    for key, row in counts.items():
        o = overrides.get(key)
        guess = guess_domain(key)
        if o:
            domain, logo_key, chosen = o.domain, o.logo_key, True
        else:
            domain, logo_key, chosen = guess, guess if guess in stored else None, False
        rows.append({
            "payee": key,
            "name": max(row["names"], key=row["names"].get),
            "count": row["count"],
            "last": row["last"],
            "domain": domain,
            "guess": guess,
            "logo_key": logo_key if logo_key in stored else None,
            "chosen": chosen,
        })
    rows.sort(key=lambda r: (-r["count"], r["name"].lower()))
    return rows


def fetch_for_new_payee(payee: str):
    """Run after saving an entry: gets the logo of a known shop the first time it shows up."""
    from database import SessionLocal
    domain = guess_domain(payee)
    if not domain:
        return
    db = SessionLocal()
    try:
        if db.get(Logo, domain) or db.get(PayeeLogo, payee_key(payee)):
            return
        found = fetch_logo(domain)
        if found:
            store_logo(db, domain, found)
            db.commit()
    finally:
        db.close()


@router.get("/payees")
def list_payees(db: Session = Depends(get_db)):
    return payee_rows(db)


@router.get("/payee-map")
def payee_map(db: Session = Depends(get_db)):
    """payee (lower-cased) -> logo key, for every payee that has a logo. Small enough to load once."""
    return {r["payee"]: r["logo_key"] for r in payee_rows(db) if r["logo_key"]}


@router.post("/payees/fetch")
def fetch_payee_logos(db: Session = Depends(get_db)):
    """Fetches the logo of every payee whose website is known but has no logo yet."""
    stored = {k for (k,) in db.query(Logo.key).all()}
    domains = sorted({r["domain"] for r in payee_rows(db) if r["domain"] and r["domain"] not in stored})
    with ThreadPoolExecutor(max_workers=8) as pool:
        found = dict(zip(domains, pool.map(fetch_logo, domains)))
    for domain, data_url in found.items():
        if data_url:
            store_logo(db, domain, data_url)
    db.commit()
    return {
        "found": sorted(d for d, v in found.items() if v),
        "missing": sorted(d for d, v in found.items() if not v),
    }


class PayeeLogoChoice(BaseModel):
    domain: Optional[str] = None  # look up this website's logo
    logo: Optional[str] = None    # or use this uploaded image (data URL)
    none: bool = False            # or show no logo for this payee


@router.put("/payees")
def choose_payee_logo(payee: str, data: PayeeLogoChoice, db: Session = Depends(get_db)):
    key = payee_key(payee)
    if not key:
        raise HTTPException(status_code=400, detail="Payee is empty")
    choice = db.get(PayeeLogo, key) or PayeeLogo(payee=key)
    if data.none:
        choice.logo_key, choice.domain = None, None
    elif data.logo:
        if not data.logo.startswith("data:image/") or len(data.logo) > 400_000:
            raise HTTPException(status_code=400, detail="The logo must be a small image")
        logo = store_logo(db, f"upload-{uuid.uuid4().hex[:12]}", data.logo)
        choice.logo_key, choice.domain = logo.key, None
    elif data.domain:
        d = clean_domain(data.domain)
        if not db.get(Logo, d):
            found = fetch_logo(d)
            if not found:
                raise HTTPException(status_code=404, detail=f"No logo found for {d}. You can upload one instead.")
            store_logo(db, d, found)
        choice.logo_key, choice.domain = d, d
    else:
        raise HTTPException(status_code=400, detail="Choose a website, an image or no logo")
    db.merge(choice)
    db.commit()
    return next((r for r in payee_rows(db) if r["payee"] == key), {"payee": key})


@router.delete("/payees")
def reset_payee_logo(payee: str, db: Session = Depends(get_db)):
    """Back to the logo guessed from the name."""
    choice = db.get(PayeeLogo, payee_key(payee))
    if choice:
        db.delete(choice)
        db.commit()
    return {"ok": True}


@router.get("/img/{key}")
def logo_image(key: str, db: Session = Depends(get_db)):
    logo = db.get(Logo, key)
    if not logo:
        raise HTTPException(status_code=404, detail="No such logo")
    return Response(content=logo.data, media_type=logo.content_type,
                    headers={"Cache-Control": "public, max-age=604800"})
