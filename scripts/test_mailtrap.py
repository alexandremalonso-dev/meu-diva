"""
Script para testar envio de e-mail com Mailtrap
"""
import mailtrap as mt

# Seu token
TOKEN = "99fd179a6088462dc0fc5a4f89d018cf"

try:
    mail = mt.Mail(
        sender=mt.Address(email="hello@demomailtrap.co", name="Meu Divã"),
        to=[mt.Address(email="psicanalistaalexandrealonso@gmail.com")],
        subject="✅ Teste Meu Divã",
        text="Seu e-mail está funcionando corretamente!",
        html="""
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
        """,
        category="Teste"
    )

    client = mt.MailtrapClient(token=TOKEN)
    response = client.send(mail)
    
    print("=" * 50)
    print("✅ E-MAIL ENVIADO COM SUCESSO!")
    print("=" * 50)
    print(f"Resposta: {response}")
    print("\nVerifique no Mailtrap: https://mailtrap.io/inboxes")
    
except Exception as e:
    print(f"❌ Erro ao enviar e-mail: {e}")
    import traceback
    traceback.print_exc()