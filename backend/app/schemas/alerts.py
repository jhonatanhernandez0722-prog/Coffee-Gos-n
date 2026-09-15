from datetime import datetime

from pydantic import BaseModel


class AlertItem(BaseModel):
    id: str
    kind: str
    title: str
    detail: str
    created_at: datetime | None = None
    href: str | None = None


class AlertsResponse(BaseModel):
    alerts: list[AlertItem]
    unread_count: int


class AlertReadRequest(BaseModel):
    alert_ids: list[str]