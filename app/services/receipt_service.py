import os
from datetime import datetime
from typing import Optional
from jinja2 import Template
from app.models.appointment import Appointment
from app.models.therapist_profile import TherapistProfile
from app.models.patient_profile import PatientProfile
from app.models.user import User


class ReceiptService:
    """Serviço para geração de recibos de sessão"""
    
    def __init__(self):
        self.template_html = """
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Recibo de Sessão - Meu Divã</title>
            <style>
                body {
                    font-family: Arial, sans-serif;
                    margin: 40px;
                    color: #333;
                }
                .header {
                    text-align: center;
                    margin-bottom: 40px;
                }
                .logo {
                    font-size: 24px;
                    font-weight: bold;
                    color: #E03673;
                    margin-bottom: 10px;
                }
                .title {
                    font-size: 20px;
                    font-weight: bold;
                    margin-bottom: 20px;
                }
                .content {
                    margin: 30px 0;
                }
                .row {
                    margin: 15px 0;
                    padding: 10px 0;
                    border-bottom: 1px solid #eee;
                }
                .label {
                    font-weight: bold;
                    width: 200px;
                    display: inline-block;
                }
                .signature {
                    margin-top: 50px;
                    padding-top: 20px;
                    border-top: 1px solid #ccc;
                    text-align: center;
                }
                .signature-img {
                    max-width: 200px;
                    max-height: 80px;
                    margin-bottom: 10px;
                }
                .footer {
                    margin-top: 40px;
                    font-size: 10px;
                    color: #999;
                    text-align: center;
                }
            </style>
        </head>
        <body>
            <div class="header">
                <div class="logo">Meu Divã</div>
                <div class="title">Declaração de Atendimento</div>
            </div>
            
            <div class="content">
                <div class="row">
                    <span class="label">Terapeuta:</span>
                    <span>{{ therapist_name }}</span>
                </div>
                <div class="row">
                    <span class="label">CRP:</span>
                    <span>{{ therapist_crp }}</span>
                </div>
                {% if signature_url %}
                <div class="row">
                    <span class="label">Assinatura:</span>
                    <img src="{{ signature_url }}" class="signature-img" />
                </div>
                {% endif %}
                <div class="row">
                    <span class="label">Paciente:</span>
                    <span>{{ patient_name }}</span>
                </div>
                <div class="row">
                    <span class="label">CPF:</span>
                    <span>{{ patient_cpf_masked }}</span>
                </div>
                <div class="row">
                    <span class="label">ID da sessão:</span>
                    <span>{{ session_id }}</span>
                </div>
                <div class="row">
                    <span class="label">Data da sessão:</span>
                    <span>{{ session_date }}</span>
                </div>
                <div class="row">
                    <span class="label">Duração:</span>
                    <span>{{ duration }} minutos</span>
                </div>
            </div>
            
            <div class="signature">
                {% if signature_url %}
                <img src="{{ signature_url }}" class="signature-img" />
                {% endif %}
                <br/>
                {{ therapist_name }}<br/>
                Terapeuta Responsável
            </div>
            
            <div class="footer">
                Este documento foi produzido com o fim exclusivo de atender às solicitações de reembolso.<br/>
                Para dedução no Imposto de Renda, utilize os dados da nota fiscal emitida pelo prestador dos serviços.
            </div>
        </body>
        </html>
        """
    
    def generate_receipt_html(
        self,
        appointment: Appointment,
        therapist_profile: TherapistProfile,
        patient_profile: PatientProfile,
        patient_user: User
    ) -> str:
        """Gera o HTML do recibo"""
        
        # Formatar CPF com máscara (ex: ***.***.123-45)
        cpf = patient_profile.cpf or ""
        if len(cpf) >= 11:
            cpf_masked = f"***.***.{cpf[-6:-2]}-{cpf[-2:]}"
        else:
            cpf_masked = "***.***.***-**"
        
        session_date = appointment.starts_at.strftime("%d/%m/%Y")
        
        template = Template(self.template_html)
        
        therapist_name = therapist_profile.full_name
        if not therapist_name and therapist_profile.user:
            therapist_name = therapist_profile.user.full_name
        
        patient_name = patient_profile.full_name
        if not patient_name and patient_user:
            patient_name = patient_user.full_name
        
        return template.render(
            therapist_name=therapist_name or "Terapeuta",
            therapist_crp=therapist_profile.professional_registration or "A definir",
            signature_url=therapist_profile.signature_url,
            patient_name=patient_name or "Paciente",
            patient_cpf_masked=cpf_masked,
            session_id=str(appointment.id),
            session_date=session_date,
            duration=appointment.duration_minutes or 50
        )
    
    def generate_receipt_pdf(self, html_content: str) -> bytes:
        """Retorna o HTML como bytes (PDF será gerado no frontend)"""
        return html_content.encode('utf-8')


# Instância global
receipt_service = ReceiptService()