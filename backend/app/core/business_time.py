from datetime import date, datetime, time, timedelta, timezone

# Colombia no usa horario de verano: UTC-5 todo el año.
BUSINESS_TZ = timezone(timedelta(hours=-5), "America/Bogota")


def business_today() -> date:
    return datetime.now(BUSINESS_TZ).date()


def business_day_bounds(day: date) -> tuple[datetime, datetime]:
    start = datetime.combine(day, time.min, tzinfo=BUSINESS_TZ)
    return start, start + timedelta(days=1)


def business_midday(day: date) -> datetime:
    """Momento representativo de una fecha sin hora, para que no cambie de día al convertir a UTC."""
    return datetime.combine(day, time(12), tzinfo=BUSINESS_TZ)
