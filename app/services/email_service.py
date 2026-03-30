"""
Serviço de envio de e-mails
"""

import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Optional
from datetime import datetime

# 🔥 CONFIGURAÇÕES DE E-MAIL (use variáveis de ambiente)
SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", 587))
SMTP_USER = os.getenv("SMTP_USER", "")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")
FROM_EMAIL = os.getenv("FROM_EMAIL", "contato@meudiva.com.br")
FROM_NAME = os.getenv("FROM_NAME", "Meu Divã")


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
        """Envia um e-mail"""
        try:
            msg = MIMEMultipart('alternative')
            msg['Subject'] = subject
            msg['From'] = f"{self.from_name} <{self.from_email}>"
            msg['To'] = to_email
            
            # Anexa o conteúdo HTML
            msg.attach(MIMEText(html_content, 'html', 'utf-8'))
            
            # Conecta ao servidor SMTP
            with smtplib.SMTP(self.host, self.port) as server:
                server.starttls()
                if self.user and self.password:
                    server.login(self.user, self.password)
                server.send_message(msg)
            
            print(f"✅ E-mail enviado para {to_email}")
            return True
            
        except Exception as e:
            print(f"❌ Erro ao enviar e-mail: {e}")
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
        start_time = appointment.starts_at
        date_str = start_time.strftime("%d de %B de %Y")
        time_str = start_time.strftime("%H:%M")
        
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
                .header {{ background: #E03673; color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0; }}
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
                    <h1>✅ Sessão Confirmada!</h1>
                </div>
                <div class="content">
                    <p>Olá, <strong>{patient_name}</strong>!</p>
                    <p>Parabéns! Sua sessão já está agendada para a data e horário abaixo. Confira também algumas dicas para aproveitar melhor esse momento.</p>
                    
                    <div class="info">
                        <h3>📅 Detalhes da sessão:</h3>
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
                .header {{ background: #2F80D3; color: white; padding: 20px; text-align: center; border-radius: 10px 10px 0 0; }}
                .content {{ background: #f9f5ff; padding: 30px; border-radius: 0 0 10px 10px; }}
                .info {{ background: #fff; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #2F80D3; }}
                .footer {{ text-align: center; padding: 20px; font-size: 12px; color: #666; }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>✅ Nova Sessão Confirmada</h1>
                </div>
                <div class="content">
                    <p>Olá, <strong>{therapist_name}</strong>!</p>
                    <p>Uma nova sessão foi confirmada:</p>
                    
                    <div class="info">
                        <h3>📅 Detalhes da sessão:</h3>
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
        therapist_sent = self._send_email(therapist_email, f"📅 Nova Sessão - {patient_name} em {date_str}", therapist_html)
        
        return patient_sent, therapist_sent
    
    def send_appointment_cancelled(self, appointment, patient_email: str, therapist_email: str) -> tuple:
        """Envia e-mail de cancelamento"""
        start_time = appointment.starts_at
        date_str = start_time.strftime("%d/%m/%Y")
        time_str = start_time.strftime("%H:%M")
        
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
                .header {{ background: #E03673; color: white; padding: 20px; text-align: center; }}
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


# Instância global do serviço
email_service = EmailService()