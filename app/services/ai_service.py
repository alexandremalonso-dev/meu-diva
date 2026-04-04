import requests
import os
from dotenv import load_dotenv

load_dotenv()

API_KEY = os.getenv("DEEPSEEK_API_KEY")

def corrigir_codigo(codigo: str):
    url = "https://api.deepseek.com/chat/completions"

    headers = {
        "Authorization": f"Bearer {API_KEY}",
        "Content-Type": "application/json"
    }

    data = {
        "model": "deepseek-chat",
        "messages": [
            {
                "role": "user",
                "content": f"""
Corrija o código abaixo.

REGRAS:
- Retorne APENAS o código corrigido
- Não explique nada

Código:
{codigo}
"""
            }
        ]
    }

    response = requests.post(url, headers=headers, json=data)

    return response.json()