import base64
import re
import urllib.request
from fastapi import APIRouter, HTTPException, Query

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


def fetch_logo(domain: str, sources=SOURCES, timeout=6.0):
    """The first usable icon for the domain as a data URL, or None."""
    for template in sources:
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
