import os
import uuid
from typing import Optional

UPLOADS_ROOT = "/var/www/meudiva/uploads"
PUBLIC_BASE_URL = os.getenv("BACKEND_URL", "https://api.meudivaonline.com")


class StorageService:
    """
    Servico de armazenamento de arquivos. Salva localmente no VPS, em
    /var/www/meudiva/uploads/<folder>/<filename>, servido pelo Nginx em
    /uploads/<folder>/<filename> (ver location /uploads/ no nginx config).

    Substitui a versao anterior baseada em Google Cloud Storage, que ficou
    inoperante apos a migracao para o VPS (recursos GCP foram deletados).
    """

    def __init__(self):
        os.makedirs(UPLOADS_ROOT, exist_ok=True)

    def upload_file(self, file_content: bytes, folder: str, filename: Optional[str] = None, content_type: str = "image/jpeg") -> str:
        if filename is None:
            ext = content_type.split("/")[-1] if "/" in content_type else "jpg"
            if ext == "jpeg":
                ext = "jpg"
            filename = f"{uuid.uuid4().hex}.{ext}"
        folder_path = os.path.join(UPLOADS_ROOT, folder)
        os.makedirs(folder_path, exist_ok=True)
        file_path = os.path.join(folder_path, filename)
        with open(file_path, "wb") as f:
            f.write(file_content)
        return f"{PUBLIC_BASE_URL}/uploads/{folder}/{filename}"

    def get_url(self, blob_path: str) -> str:
        return f"{PUBLIC_BASE_URL}/uploads/{blob_path}"

    def delete_file(self, blob_path: str) -> bool:
        try:
            full_path = os.path.join(UPLOADS_ROOT, blob_path)
            if os.path.exists(full_path):
                os.remove(full_path)
                return True
            return False
        except Exception:
            return False

    def file_exists(self, blob_path: str) -> bool:
        full_path = os.path.join(UPLOADS_ROOT, blob_path)
        return os.path.exists(full_path)
