"""
Script para testar envio de e-mail
"""
import os
import sys
from pathlib import Path

# Adicionar o diretório pai ao path
sys.path.insert(0, str(Path(__file__).parent.parent))

# Carregar variáveis do .env manualmente
env_file = Path(__file__).parent.parent / ".env"
if env_file.exists():
    with open(env_file, 'r') as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                key, value = line.split('=', 1)
                os.environ[key] = value
                print(f"Carregado: {key}={value[:20]}...")

# Importar após carregar as variáveis
from app.services.email_service import email_service

def test_email():
    print("=" * 50)
    print("📧 TESTANDO SERVIÇO DE E-MAIL")
    print("=" * 50)
    
    print(f"Host: {email_service.host}")
    print(f"Port: {email_service.port}")
    print(f"User: {email_service.user}")
    print(f"From: {email_service.from_email}")
    print(f"From Name: {email_service.from_name}")
    print("-" * 50)
    
    # Testar envio para seu próprio e-mail
    try:
        print("Enviando e-mail de teste...")
        email_service._send_email(
            to_email='psicanalistaalexandrealonso@gmail.com',
            subject='✅ Teste Meu Divã',
            html_content="""
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <title>Teste Meu Divã</title>
            </head>
            <body style="font-family: Arial, sans-serif;">
                <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                    <h1 style="color: #E03673;">Meu Divã</h1>
                    <p>Seu e-mail está funcionando corretamente!</p>
                    <p>Esta é uma mensagem de teste.</p>
                    <hr>
                    <p style="font-size: 12px; color: #666;">Enviado pelo sistema Meu Divã</p>
                </div>
            </body>
            </html>
            """
        )
        print("✅ E-mail enviado com sucesso! Verifique sua caixa de entrada.")
        print("   (Verifique também a pasta de spam se não encontrar)")
    except Exception as e:
        print(f"❌ Erro ao enviar e-mail: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    test_email()