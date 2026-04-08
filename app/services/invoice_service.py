import os
import shutil
from datetime import datetime
from pathlib import Path
from typing import Optional
from fastapi import UploadFile, HTTPException

UPLOAD_DIR = Path("uploads/invoices")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

async def save_invoice_file(file: UploadFile, therapist_id: int, invoice_number: str) -> str:
    """Salva o arquivo PDF da nota fiscal e retorna o caminho"""
    
    # Validar tipo de arquivo
    if not file.filename.endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Apenas arquivos PDF são permitidos")
    
    # Criar nome único para o arquivo
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"therapist_{therapist_id}_{invoice_number}_{timestamp}.pdf"
    
    # Remover caracteres especiais do nome
    filename = "".join(c for c in filename if c.isalnum() or c in '._-')
    
    filepath = UPLOAD_DIR / filename
    
    # Salvar arquivo
    try:
        with open(filepath, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao salvar arquivo: {str(e)}")
    
    # Retornar caminho relativo
    return f"/uploads/invoices/{filename}"

def delete_invoice_file(file_url: str):
    """Remove o arquivo físico da nota fiscal"""
    if file_url and file_url.startswith('/uploads/'):
        filepath = Path(".") / file_url.lstrip('/')
        if filepath.exists():
            filepath.unlink()