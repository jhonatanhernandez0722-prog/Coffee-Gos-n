from fastapi import Depends, HTTPException, status

from app.api.v1.dependencies import get_current_user
from app.models import User

SECTIONS = {
    "dashboard": "Resumen",
    "comanda": "Comanda",
    "productos": "Productos",
    "clientes": "Clientes",
    "creditos": "Créditos",
    "movimientos": "Movimientos",
    "egresos": "Egresos",
    "metricas": "Métricas",
}


def user_sections(user: User) -> list[str]:
    if user.role == "ADMIN":
        return list(SECTIONS)
    return sorted({permission.section for permission in user.permissions if permission.section in SECTIONS})


def require_section(section: str):
    return require_any_section(section)


def require_any_section(*sections: str):
    def dependency(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role != "ADMIN" and not set(sections).intersection(user_sections(current_user)):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No tienes permiso para ver este apartado")
        return current_user

    return dependency