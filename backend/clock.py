"""What "today" means for the app. The server runs on UTC, which in Europe is still
yesterday for the first hour or two after midnight, so dates use the owner's time zone."""
import os
from datetime import date, datetime, timedelta
from typing import Optional
from zoneinfo import ZoneInfo

APP_TIMEZONE = ZoneInfo(os.environ.get("APP_TIMEZONE", "Europe/Berlin"))


def local_today(client_today: Optional[str] = None) -> date:
    """Today in the app's time zone. A date sent by the phone wins (it knows where you
    are when travelling), as long as it's within a day of that."""
    today = datetime.now(APP_TIMEZONE).date()
    if client_today:
        try:
            sent = date.fromisoformat(client_today)
        except ValueError:
            return today
        if abs((sent - today).days) <= 1:
            return sent
    return today
