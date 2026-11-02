"""
Serviço de envio de e-mails
"""

import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.utils import formatdate, make_msgid
from typing import Optional
from datetime import datetime

# 🔥 CONFIGURAÇÕES DE E-MAIL (use variáveis de ambiente)
SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", 587))
SMTP_USER = os.getenv("SMTP_USER", "")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")
FROM_EMAIL = os.getenv("FROM_EMAIL", "contato@meudiva.com.br")
FROM_NAME = os.getenv("FROM_NAME", "Meu Divã")

# 🔥 Logo transparente usada em TODOS os templates de e-mail (mesma
# proporção em todos, header maior/mais visível que antes)
LOGO_URL = "https://app.meudivaonline.com/jitsi-watermark.png"

# 🔥 Hostinger Mail API — usado no lugar do SMTP puro. O SMTP estava
# sendo bloqueado pelo MailChannels (relay da Hostinger) antes mesmo de
# sair ("550 5.7.1 [CS] Message blocked"), mesmo com SPF/DKIM corretos.
# A API oficial passa pela infraestrutura autenticada deles e entrega
# normalmente.
HOSTINGER_API_TOKEN = os.getenv("HOSTINGER_API_TOKEN", "")
HOSTINGER_MAILBOX_ID = os.getenv("HOSTINGER_MAILBOX_ID", "")


class EmailService:
    """Serviço para envio de e-mails"""
    
    def __init__(self):
        self.host = SMTP_HOST
        self.port = SMTP_PORT
        self.user = SMTP_USER
        self.password = SMTP_PASSWORD
        self.from_email = FROM_EMAIL
        self.from_name = FROM_NAME
    
    def _send_email(self, to_email: str, subject: str, html_content: str) -> bool:
        """
        Envia um e-mail via API oficial da Hostinger (preferencial) ou,
        se as credenciais da API não estiverem configuradas, cai pro
        SMTP puro como fallback (mas o SMTP puro está sendo bloqueado
        pelo MailChannels da Hostinger — ver comentário acima).
        """
        if HOSTINGER_API_TOKEN and HOSTINGER_MAILBOX_ID:
            try:
                import hostinger_mail_api
                from hostinger_mail_api.models.v1_send_request import V1SendRequest
                from hostinger_mail_api.rest import ApiException

                configuration = hostinger_mail_api.Configuration(access_token=HOSTINGER_API_TOKEN)
                with hostinger_mail_api.ApiClient(configuration) as api_client:
                    send_api = hostinger_mail_api.SendApi(api_client)
                    req = V1SendRequest(
                        to=[to_email],
                        display_name=self.from_name,
                        subject=subject,
                        html=html_content,
                    )
                    send_api.send_email(HOSTINGER_MAILBOX_ID, req)

                print(f"✅ E-mail enviado para {to_email} (via API Hostinger)")
                return True

            except Exception as e:
                print(f"❌ Erro ao enviar e-mail via API Hostinger: {e}")
                return False

        # 🔥 Fallback SMTP (só roda se a API não estiver configurada)
        try:
            msg = MIMEMultipart('alternative')
            msg['Subject'] = subject
            msg['From'] = f"{self.from_name} <{self.from_email}>"
            msg['To'] = to_email
            msg['Date'] = formatdate(localtime=True)
            msg['Message-ID'] = make_msgid(domain=self.from_email.split('@')[-1])
            msg['Reply-To'] = self.from_email

            msg.attach(MIMEText(html_content, 'html', 'utf-8'))

            if self.port == 465:
                with smtplib.SMTP_SSL(self.host, self.port) as server:
                    if self.user and self.password:
                        server.login(self.user, self.password)
                    server.send_message(msg)
            else:
                with smtplib.SMTP(self.host, self.port) as server:
                    server.starttls()
                    if self.user and self.password:
                        server.login(self.user, self.password)
                    server.send_message(msg)

            print(f"✅ E-mail enviado para {to_email} (via SMTP)")
            return True

        except Exception as e:
            print(f"❌ Erro ao enviar e-mail via SMTP: {e}")
            return False
    
    def send_appointment_confirmation(self, appointment, patient_email: str, therapist_email: str, meet_url: Optional[str] = None) -> tuple:
        """
        Envia e-mail de confirmação para paciente e terapeuta
        
        Args:
            appointment: Objeto Appointment
            patient_email: E-mail do paciente
            therapist_email: E-mail do terapeuta
            meet_url: URL do Google Meet (opcional)
        """
        # Formatação da data
        from app.core.datas_br import data_extenso, hora_local  # asaas-fuso
        start_time = appointment.starts_at
        date_str = data_extenso(start_time)
        time_str = hora_local(start_time)
        
        therapist_name = appointment.therapist.full_name if appointment.therapist else "Terapeuta"
        patient_name = appointment.patient.full_name if appointment.patient else "Paciente"
        
        duration = int((appointment.ends_at - appointment.starts_at).total_seconds() / 60)
        
        # HTML para o paciente
        patient_html = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <style>
                body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
                .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
                .header {{ background: #ffffff; color: #E03673; padding: 24px 20px; text-align: center; border-radius: 10px 10px 0 0; border-bottom: 3px solid #E03673; }}
                .content {{ background: #f9f5ff; padding: 30px; border-radius: 0 0 10px 10px; }}
                .button {{ background: #E03673; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; display: inline-block; margin-top: 20px; }}
                .info {{ background: #fff; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #E03673; }}
                .tips {{ background: #FEF3C7; padding: 15px; border-radius: 8px; margin: 20px 0; }}
                .footer {{ text-align: center; padding: 20px; font-size: 12px; color: #666; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <img src="{LOGO_URL}" alt="Meu Divã" width="100" height="100" style="display:block;margin:0 auto 8px;width:100px;height:100px;object-fit:contain;">
                    <h1>✅ Sessão Confirmada!</h1>
                </div>
                <div class="content">
                    <p>Olá, <strong>{patient_name}</strong>!</p>
                    <p>Parabéns! Sua sessão já está agendada para a data e horário abaixo. Confira também algumas dicas para aproveitar melhor esse momento.</p>
                    
                    <div class="info">
                        <h3><img src="https://app.meudivaonline.com/email/calendario-rosa.png" alt="" width="20" height="20" style="vertical-align:-4px;margin-right:6px;border:0;">Detalhes da sessão:</h3>
                        <p><strong>Data:</strong> {date_str}</p>
                        <p><strong>Horário:</strong> {time_str}</p>
                        <p><strong>Especialista:</strong> {therapist_name}</p>
                        <p><strong>Duração:</strong> {duration} min</p>
                        {f'<p><strong>Link da sessão:</strong> <a href="{meet_url}">{meet_url}</a></p>' if meet_url else ''}
                    </div>
                    
                    <div class="tips">
                        <h3>🎯 Dicas para sua sessão:</h3>
                        <ul>
                            <li>Reserve um espaço tranquilo, com privacidade e boa conexão</li>
                            <li>Utilize um navegador atualizado — recomendamos Google Chrome ou Mozilla Firefox</li>
                            <li>Certifique-se de que sua conexão está estável (mínimo de 1 Mbps)</li>
                            <li>No horário agendado, basta clicar no link acima e iniciar sua sessão</li>
                        </ul>
                    </div>
                    
                    <p>Este é o seu espaço de escuta e cuidado.</p>
                    <p>Até breve,<br><strong>Equipe Meu Divã</strong></p>
                </div>
                <div class="footer">
                    <p>Meu Divã - Seu espaço de cuidado emocional</p>
                    <p><a href="https://meudiva.com.br">meudiva.com.br</a></p>
                </div>
            </div>
        </body>
        </html>
        """
        
        # HTML para o terapeuta
        therapist_html = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <style>
                body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; }}
                .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
                .header {{ background: #ffffff; color: #2F80D3; padding: 24px 20px; text-align: center; border-radius: 10px 10px 0 0; border-bottom: 3px solid #2F80D3; }}
                .content {{ background: #f9f5ff; padding: 30px; border-radius: 0 0 10px 10px; }}
                .info {{ background: #fff; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #2F80D3; }}
                .footer {{ text-align: center; padding: 20px; font-size: 12px; color: #666; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <img src="{LOGO_URL}" alt="Meu Divã" width="100" height="100" style="display:block;margin:0 auto 8px;width:100px;height:100px;object-fit:contain;">
                    <h1>✅ Nova Sessão Confirmada</h1>
                </div>
                <div class="content">
                    <p>Olá, <strong>{therapist_name}</strong>!</p>
                    <p>Uma nova sessão foi confirmada:</p>
                    
                    <div class="info">
                        <h3><img src="https://app.meudivaonline.com/email/calendario-azul.png" alt="" width="20" height="20" style="vertical-align:-4px;margin-right:6px;border:0;">Detalhes da sessão:</h3>
                        <p><strong>Paciente:</strong> {patient_name}</p>
                        <p><strong>Data:</strong> {date_str}</p>
                        <p><strong>Horário:</strong> {time_str}</p>
                        <p><strong>Duração:</strong> {duration} min</p>
                        {f'<p><strong>Link da sessão:</strong> <a href="{meet_url}">{meet_url}</a></p>' if meet_url else ''}
                    </div>
                    
                    <p>Acesse o link no horário agendado para iniciar a sessão.</p>
                    <p>Até breve,<br><strong>Equipe Meu Divã</strong></p>
                </div>
                <div class="footer">
                    <p>Meu Divã - Seu espaço de cuidado emocional</p>
                </div>
            </div>
        </body>
        </html>
        """
        
        # Envia e-mails
        patient_sent = self._send_email(patient_email, f"✅ Sessão Confirmada - {date_str} às {time_str}", patient_html)
        therapist_sent = self._send_email(therapist_email, f"✅ Nova Sessão - {patient_name} em {date_str}", therapist_html)
        
        return patient_sent, therapist_sent
    
    def send_appointment_cancelled(self, appointment, patient_email: str, therapist_email: str) -> tuple:
        """Envia e-mail de cancelamento"""
        from app.core.datas_br import data_local, hora_local  # asaas-fuso
        start_time = appointment.starts_at
        date_str = data_local(start_time)
        time_str = hora_local(start_time)
        
        patient_html = f"""
        <!DOCTYPE html>
        <html>
        <head><meta charset="UTF-8"></head>
        <body style="font-family: Arial, sans-serif; padding: 20px;">
            <h2 style="color: #E03673;">❌ Sessão Cancelada</h2>
            <p>Sua sessão agendada para <strong>{date_str} às {time_str}</strong> foi cancelada.</p>
            <p>O crédito da sessão foi estornado para sua carteira e está disponível para novo agendamento.</p>
            <p>Em caso de dúvidas, entre em contato conosco.</p>
            <hr>
            <p style="font-size: 12px; color: #666;">Meu Divã - Seu espaço de cuidado emocional</p>
        </body>
        </html>
        """
        
        therapist_html = f"""
        <!DOCTYPE html>
        <html>
        <head><meta charset="UTF-8"></head>
        <body style="font-family: Arial, sans-serif; padding: 20px;">
            <h2 style="color: #2F80D3;">❌ Sessão Cancelada</h2>
            <p>A sessão agendada para <strong>{date_str} às {time_str}</strong> foi cancelada.</p>
            <p>O valor foi estornado para a carteira do paciente.</p>
            <hr>
            <p style="font-size: 12px; color: #666;">Meu Divã - Seu espaço de cuidado emocional</p>
        </body>
        </html>
        """
        
        patient_sent = self._send_email(patient_email, f"❌ Sessão Cancelada - {date_str}", patient_html)
        therapist_sent = self._send_email(therapist_email, f"❌ Sessão Cancelada - {date_str}", therapist_html)
        
        return patient_sent, therapist_sent
    
    def send_receipt_email(
        self,
        to_email: str,
        patient_name: str,
        therapist_name: str,
        session_date: str,
        session_id: str,
        receipt_html: str
    ) -> bool:
        """
        Envia recibo da sessão por e-mail
        """
        subject = f"Meu Divã - Recibo da Sessão {session_date}"
        
        body_html = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Recibo de Sessão</title>
            <style>
                body {{ font-family: Arial, sans-serif; margin: 0; padding: 20px; background-color: #f5f5f5; }}
                .container {{ max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }}
                .header {{ background: #ffffff; color: #E03673; padding: 24px 20px; text-align: center; border-bottom: 3px solid #E03673; }}
                .content {{ padding: 30px; }}
                .receipt-box {{ background: #f9f5ff; border: 1px solid #E03673; border-radius: 8px; padding: 20px; margin: 20px 0; }}
                .footer {{ text-align: center; padding: 20px; font-size: 12px; color: #666; border-top: 1px solid #eee; }}
                .button {{ background: #E03673; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px; display: inline-block; }}
                h1 {{ margin: 0; font-size: 24px; }}
                h2 {{ color: #E03673; margin-top: 0; }}
                hr {{ margin: 20px 0; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <img src="{LOGO_URL}" alt="Meu Divã" width="100" height="100" style="display:block;margin:0 auto 8px;width:100px;height:100px;object-fit:contain;">
                    <h1>Meu Divã</h1>
                    <p>Recibo de Sessão</p>
                </div>
                
                <div class="content">
                    <p>Olá, <strong>{patient_name}</strong>!</p>
                    
                    <p>Segue o recibo da sua sessão com <strong>{therapist_name}</strong> realizada em <strong>{session_date}</strong>.</p>
                    
                    <div class="receipt-box">
                        {receipt_html}
                    </div>
                    
                    <p>Você também pode baixar o recibo em PDF acessando seu histórico de sessões no aplicativo.</p>
                    
                    <hr />
                    
                    <p style="font-size: 12px; color: #666;">
                        Este é um e-mail automático. Por favor, não responda.<br/>
                        Em caso de dúvidas, entre em contato pelo suporte do Meu Divã.
                    </p>
                </div>
                
                <div class="footer">
                    <p>Meu Divã - Seu espaço de cuidado emocional</p>
                    <p><a href="https://meudiva.com.br">meudiva.com.br</a></p>
                </div>
            </div>
        </body>
        </html>
        """
        
        return self._send_email(to_email, subject, body_html)

# ==========================
# ADICIONAR em email_service.py — método send_chat_notification
# Adicionar dentro da classe EmailService, antes da linha "# Instância global"
# ==========================

    def send_chat_notification(
        self,
        to_email: str,
        to_name: str,
        sender_name: str,
        messages: list,  # lista de strings com as mensagens recentes
        thread_id: int,
        app_url: str = "https://app.meudivaonline.com"
    ) -> bool:
        """
        Envia notificação de nova mensagem no chat por e-mail.
        Similar ao ZenKlub — mostra as mensagens recentes e link para responder.
        """
        logo_url = "https://app.meudivaonline.com/jitsi-watermark.png"
        chat_url = f"{app_url}/chat?thread={thread_id}"

        # Monta as bolhas de mensagem
        mensagens_html = ""
        for msg in messages[-3:]:  # mostra no máximo as últimas 3
            if msg.startswith('[IMAGE]'):
                mensagens_html += """
                <div style="background:#2F80D3;color:white;padding:10px 16px;border-radius:20px;margin-bottom:8px;display:inline-block;max-width:80%;">
                    📷 Imagem
                </div><br>"""
            elif msg.startswith('[DOC:'):
                doc_filename = msg[5:msg.index(']')] if ']' in msg else 'Documento'
                mensagens_html += f"""
                <div style="background:#2F80D3;color:white;padding:10px 16px;border-radius:20px;margin-bottom:8px;display:inline-block;max-width:80%;">
                    📎 {doc_filename}
                </div><br>"""
            else:
                mensagens_html += f"""
                <div style="background:#2F80D3;color:white;padding:10px 16px;border-radius:20px;margin-bottom:8px;display:inline-block;max-width:80%;">
                    {msg}
                </div><br>"""

        html = f"""
        <!DOCTYPE html>
        <html>
        <head><meta charset="UTF-8"></head>
        <body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,sans-serif;">
            <div style="max-width:600px;margin:32px auto;background:white;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">

                <!-- Header com logo -->
                <table role="presentation" width="100%" style="background:#ffffff;padding:22px 24px;border-collapse:collapse;border-bottom:3px solid #E03673;">
                    <tr>
                        <td style="width:130px;padding-right:16px;vertical-align:middle;">
                            <img src="{logo_url}" alt="Meu Divã" width="120" height="120" style="display:block;width:120px;height:120px;object-fit:contain;">
                        </td>
                        <td style="vertical-align:middle;">
                            <span style="color:#E03673;font-size:1.25rem;font-weight:700;white-space:nowrap;">Meu Divã</span>
                        </td>
                    </tr>
                </table>

                <!-- Corpo -->
                <div style="padding:28px 24px;">
                    <p style="font-size:1rem;color:#333;margin:0 0 8px;">
                        <strong>{sender_name}</strong> quer conversar com você via Meu Divã
                    </p>
                    <p style="font-size:0.85rem;color:#888;margin:0 0 24px;">
                        --- Acesse o app para responder ---
                    </p>

                    <p style="color:#555;margin:0 0 16px;">Olá, <strong>{to_name}</strong></p>
                    <p style="color:#555;margin:0 0 20px;">
                        Você recebeu novas mensagens de <strong>{sender_name}</strong>,
                        visualize em "Chat" no app Meu Divã.
                    </p>

                    <!-- Mensagens -->
                    <div style="margin-bottom:24px;">
                        {mensagens_html}
                    </div>

                    <!-- Botão responder -->
                    <a href="{chat_url}"
                       style="display:inline-block;background:#E03673;color:white;padding:12px 28px;border-radius:50px;text-decoration:none;font-weight:600;font-size:0.95rem;">
                        Responder agora
                    </a>

                    <p style="margin-top:28px;color:#888;font-size:0.85rem;">
                        Em nome de {sender_name},<br>
                        <strong>Time Meu Divã</strong>
                    </p>
                </div>

                <!-- Footer -->
                <div style="border-top:1px solid #eee;padding:16px 24px;text-align:center;">
                    <img src="{logo_url}" alt="Meu Divã" width="48" height="48" style="width:48px;height:48px;object-fit:contain;vertical-align:middle;margin-right:8px;">
                    <span style="color:#aaa;font-size:0.78rem;">Meu Divã · contato@meudivaonline.com</span>
                    <br>
                    <a href="{app_url}/chat/unsubscribe?thread={thread_id}"
                       style="color:#bbb;font-size:0.75rem;margin-top:8px;display:inline-block;">
                        Cancelar notificações deste chat
                    </a>
                </div>
            </div>
        </body>
        </html>
        """

        # 🔥 [ref:ID] no assunto — sobrevive a "Re:" nas respostas e
        # permite ao webhook de e-mail recebido identificar a qual
        # thread de chat a resposta pertence.
        subject = f"{sender_name} enviou uma mensagem para você - Meu Divã [ref:{thread_id}]"
        return self._send_email(to_email, subject, html)


# ==========================
# ADICIONAR em app/routes/chat.py — no endpoint send_message
# Após db.commit() e db.refresh(new_message), adicionar:
# ==========================

# 🔥 NOTIFICAÇÃO DE CHAT POR E-MAIL
# Cole este bloco após o db.refresh(new_message) no endpoint send_message:

"""
    # Notificar o destinatário por e-mail (em background, não bloqueia a resposta)
    try:
        from app.services.email_service import email_service

        # Descobrir quem é o destinatário
        recipient_user_id = (
            thread.patient_user_id
            if current_user.id == thread.therapist_user_id
            else thread.therapist_user_id
        )
        recipient = db.query(User).filter(User.id == recipient_user_id).first()

        if recipient and recipient.email:
            # Buscar as últimas 3 mensagens da thread para mostrar no e-mail
            recent_msgs = db.query(ChatMessage).filter(
                ChatMessage.thread_id == thread.id
            ).order_by(ChatMessage.created_at.desc()).limit(3).all()

            recent_msgs_text = [m.message for m in reversed(recent_msgs)]

            email_service.send_chat_notification(
                to_email=recipient.email,
                to_name=recipient.full_name or recipient.email,
                sender_name=current_user.full_name or current_user.email,
                messages=recent_msgs_text,
                thread_id=thread.id,
            )
    except Exception as e:
        print(f"⚠️ Erro ao enviar notificação de chat por e-mail: {e}")
        # Não interrompe o fluxo — e-mail é best-effort
"""

# Instância global do serviço
email_service = EmailService()