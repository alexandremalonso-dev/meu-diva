from fastapi import APIRouter, HTTPException
import httpx

router = APIRouter(prefix="/utils", tags=["utils"])

@router.get("/cep/{cep}")
async def buscar_cep(cep: str):
    """Busca endereço pelo CEP usando ViaCEP"""
    
    # Limpar CEP
    cep_limpo = ''.join(filter(str.isdigit, cep))
    
    if len(cep_limpo) != 8:
        raise HTTPException(status_code=400, detail="CEP inválido")
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(f"https://viacep.com.br/ws/{cep_limpo}/json/")
            data = response.json()
            
            if data.get("erro"):
                raise HTTPException(status_code=404, detail="CEP não encontrado")
            
            return {
                "cep": data.get("cep"),
                "logradouro": data.get("logradouro", ""),
                "bairro": data.get("bairro", ""),
                "cidade": data.get("localidade", ""),
                "estado": data.get("uf", ""),
                "ibge": data.get("ibge", ""),
                "ddd": data.get("ddd", "")
            }
    except httpx.RequestError:
        raise HTTPException(status_code=500, detail="Erro ao consultar CEP")