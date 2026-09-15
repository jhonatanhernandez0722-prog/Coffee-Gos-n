from fastapi import APIRouter

from app.api.v1.auth import router as auth_router
from app.api.v1.catalog import router as catalog_router
from app.api.v1.dashboard import router as dashboard_router
from app.api.v1.sales import router as sales_router
from app.api.v1.customers import router as customers_router
from app.api.v1.movements import router as movements_router
from app.api.v1.inventory import router as inventory_router
from app.api.v1.users import router as users_router

api_router = APIRouter()
api_router.include_router(auth_router)
api_router.include_router(catalog_router)
api_router.include_router(dashboard_router)
api_router.include_router(sales_router)
api_router.include_router(customers_router)
api_router.include_router(movements_router)
api_router.include_router(inventory_router)
api_router.include_router(users_router)


@api_router.get("/health", tags=["health"])
def health_check() -> dict[str, str]:
    return {"status": "ok", "service": "coffee-gosen-api"}


@api_router.get("/meta", tags=["meta"])
def metadata() -> dict[str, list[str]]:
    return {
        "payment_methods": ["CASH", "NEQUI", "CREDIT"],
        "inventory_movement_types": ["PURCHASE", "SALE", "ADJUSTMENT", "INTERNAL_USE"],
        "roles": ["ADMIN", "SELLER"],
    }