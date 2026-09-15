from uuid import uuid4

import httpx

from app.core.config import settings


async def upload_to_imagekit(content: bytes, filename: str, content_type: str, folder: str) -> str | None:
    if not settings.imagekit_private_key or not settings.imagekit_url_endpoint:
        return None

    extension = filename.rsplit(".", 1)[-1] if "." in filename else "bin"
    remote_filename = f"{uuid4().hex}.{extension}"
    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.post(
            "https://upload.imagekit.io/api/v1/files/upload",
            auth=(settings.imagekit_private_key, ""),
            files={"file": (remote_filename, content, content_type)},
            data={"fileName": remote_filename, "folder": folder, "useUniqueFileName": "false"},
        )
    response.raise_for_status()
    result = response.json()
    return result["url"]
