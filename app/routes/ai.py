from fastapi import APIRouter
from pydantic import BaseModel
from app.services.ai_service import corrigir_codigo

router = APIRouter()

class CodigoInput(BaseModel):
    codigo: str

@router.post("/ai/corrigir")
def corrigir(input: CodigoInput):
    resposta = corrigir_codigo(input.codigo)

    texto = resposta["choices"][0]["message"]["content"]

    return {"codigo_corrigido": texto}