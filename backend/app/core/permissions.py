from fastapi import Depends, HTTPException, Request, status

from app.api.v1.dependencies import get_current_user
from app.models import User

SECTIONS = {
    "dashboard": "Resumen",
    "comanda": "Ventas",
    "productos": "Productos",
    "clientes": "Clientes",
    "creditos": "Créditos",
    "movimientos": "Movimientos",
    "egresos": "Egresos",
    "ingresos": "Ingresar",
    "donaciones": "Donaciones",
    "qr_pago": "QR de pago",
    "metricas": "Métricas",
    "arqueo": "Arqueo de Caja",
    "balance": "Balance General",
    "temas": "Temas",
    "configuracion": "Configuración",
}


def user_sections(user: User) -> list[str]:
    if user.role == "ADMIN":
        return list(SECTIONS)
    if user.role == "VIEWER":
        return list(SECTIONS)
    sections = {permission.section for permission in user.permissions if permission.section in SECTIONS}
    if user.role == "SELLER":
        sections.update({"productos", "egresos"})
    return sorted(sections)


def require_section(section: str):
    return require_any_section(section)


def require_any_section(*sections: str):
    def dependency(request: Request, current_user: User = Depends(get_current_user)) -> User:
        if current_user.role == "VIEWER" and request.method not in {"GET", "HEAD", "OPTIONS"}:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Este usuario solo tiene permisos de consulta")
        if current_user.role != "ADMIN" and not set(sections).intersection(user_sections(current_user)):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No tienes permiso para ver este apartado")
        return current_user

    return dependency


def require_admin_or_viewer(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role not in {"ADMIN", "VIEWER"}:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Administrator or read-only role required")
    return current_user