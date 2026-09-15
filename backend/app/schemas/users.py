from pydantic import BaseModel, ConfigDict, EmailStr, Field


class SellerCreate(BaseModel):
    full_name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    pin: str = Field(pattern=r"^\d{4,8}$")
    permissions: list[str] = Field(default_factory=list)


class SellerUpdate(BaseModel):
    full_name: str | None = Field(default=None, min_length=2, max_length=120)
    email: EmailStr | None = None
    pin: str | None = Field(default=None, pattern=r"^\d{4,8}$")
    permissions: list[str] | None = None
    is_active: bool | None = None


class SellerResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    full_name: str
    email: EmailStr
    role: str
    is_active: bool
    permissions: list[str]