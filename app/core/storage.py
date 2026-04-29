import os
from google.cloud import storage
from typing import Optional
import uuid

class StorageService:
    def __init__(self):
        self.bucket_name = os.getenv("GCS_BUCKET_NAME", "meudiva-non-prod-fotos")
        self.client = storage.Client()
        self.bucket = self.client.bucket(self.bucket_name)
    
    def upload_file(
        self, 
        file_content: bytes, 
        folder: str, 
        filename: Optional[str] = None,
        content_type: str = "image/jpeg"
    ) -> str:
        """
        Upload um arquivo para o Cloud Storage
        
        Args:
            file_content: Conteúdo do arquivo em bytes
            folder: Pasta destino (ex: 'patients', 'therapists', 'admins')
            filename: Nome do arquivo (opcional - gera UUID se não fornecido)
            content_type: Tipo MIME do arquivo
        
        Returns:
            URL pública do arquivo
        """
        if filename is None:
            ext = content_type.split('/')[-1] if '/' in content_type else 'jpg'
            filename = f"{uuid.uuid4().hex}.{ext}"
        
        blob_path = f"{folder}/{filename}"
        blob = self.bucket.blob(blob_path)
        blob.upload_from_string(file_content, content_type=content_type)
        
        # Retorna a URL pública
        return f"https://storage.googleapis.com/{self.bucket_name}/{blob_path}"
    
    def get_url(self, blob_path: str) -> str:
        """Retorna a URL pública de um arquivo no bucket"""
        return f"https://storage.googleapis.com/{self.bucket_name}/{blob_path}"
    
    def delete_file(self, blob_path: str) -> bool:
        """Remove um arquivo do bucket"""
        try:
            blob = self.bucket.blob(blob_path)
            blob.delete()
            return True
        except Exception:
            return False
    
    def file_exists(self, blob_path: str) -> bool:
        """Verifica se um arquivo existe no bucket"""
        blob = self.bucket.blob(blob_path)
        return blob.exists()