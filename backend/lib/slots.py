"""Slot generation from weekly availability. All schedules are in IST (Asia/Kolkata)."""

from datetime import date, datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo

IST = ZoneInfo("Asia/Kolkata")
DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]
STEP_MIN = 30
HORIZON_DAYS = 14
LEAD = timedelta(hours=2)


def _t(s: str) -> time:
    h, m = s.split(":")
    return time(int(h), int(m))


def generate_slots(
    availability: dict, duration: int, booked: list[tuple[datetime, datetime]], now: datetime | None = None
) -> list[dict]:
    now = now or datetime.now(timezone.utc)
    earliest = now + LEAD
    today: date = now.astimezone(IST).date()
    out: list[dict] = []
    for i in range(HORIZON_DAYS):
        d = today + timedelta(days=i)
        found: set[datetime] = set()
        for w in availability.get(DAYS[d.weekday()], []) or []:
            cur = datetime.combine(d, _t(w["start"]), IST)
            end = datetime.combine(d, _t(w["end"]), IST)
            while cur + timedelta(minutes=duration) <= end:
                s, e = cur, cur + timedelta(minutes=duration)
                if s >= earliest and not any(s < be and bs < e for bs, be in booked):
                    found.add(s.astimezone(timezone.utc))
                cur += timedelta(minutes=STEP_MIN)
        if found:
            out.append({"date": d.isoformat(), "slots": sorted(found)})
    return out


def is_open_slot(availability: dict, duration: int, start: datetime, booked: list[tuple[datetime, datetime]]) -> bool:
    start = start.astimezone(timezone.utc)
    return any(start in day["slots"] for day in generate_slots(availability, duration, booked))
