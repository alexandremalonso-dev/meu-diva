"""
Carregador de arquivos .env baseado no ambiente
Uso: chamar load_environment() no início do main.py
"""

import os
from dotenv import load_dotenv

def load_environment():
    """
    Carrega o arquivo .env correto baseado na variável ENV
    
    Prioridade:
    1. Variável de ambiente ENV (se definida)
    2. Arquivo .env.{env}
    3. Fallback para .env
    """
    env = os.getenv("ENV", "local")
    
    # Mapear ambiente para arquivo
    if env == "prod":
        env_file = ".env.prod"
    elif env == "non-prod":
        env_file = ".env.non-prod"
    else:
        env_file = ".env.local"
    
    # Verificar se o arquivo existe
    if os.path.exists(env_file):
        load_dotenv(env_file, override=True)
        print(f"✅ [ENV] Carregado arquivo: {env_file} (ambiente: {env})")
    else:
        # Fallback para .env
        if os.path.exists(".env"):
            load_dotenv(".env", override=True)
            print(f"⚠️ [ENV] {env_file} não encontrado, usando .env (ambiente: {env})")
        else:
            print(f"❌ [ENV] Nenhum arquivo .env encontrado para ambiente: {env}")
    
    # Exibir ambiente atual (sem expor dados sensíveis)
    db_url = os.getenv("DATABASE_URL", "")
    db_preview = db_url[:50] + "..." if len(db_url) > 50 else db_url
    print(f"📌 [ENV] DATABASE_URL: {db_preview}")
    print(f"📌 [ENV] ENV: {os.getenv('ENV', 'local')}")


# Para teste independente
if __name__ == "__main__":
    load_environment()
    print("\nVariáveis carregadas:")
    print(f"  ENV: {os.getenv('ENV')}")
    print(f"  DATABASE_URL: {os.getenv('DATABASE_URL', 'N/A')[:50]}...")
    print(f"  JWT_SECRET: {'✓' if os.getenv('JWT_SECRET') else '✗'}")
    print(f"  STRIPE_SECRET_KEY: {'✓' if os.getenv('STRIPE_SECRET_KEY') else '✗'}")