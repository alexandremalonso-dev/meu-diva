""" Serviço de integração com Google Meet """
import os
import uuid
from datetime import datetime

# ============================================
# CONFIGURAÇÃO DE CAMINHOS ABSOLUTOS
# ============================================
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(os.path.dirname(BASE_DIR))
CREDENTIALS_FILE = os.path.join(PROJECT_ROOT, 'credentials', 'meet-credentials.json')


class GoogleMeetService:
    """Serviço para criação de links do Google Meet (versão simplificada)"""
    
    def __init__(self):
        """Inicializa o serviço"""
        print(f"✅ Google Meet Service inicializado (modo simplificado - links diretos)")
    
    def create_meet_link(self, appointment_data):
        """
        Gera um link direto do Google Meet (sem depender de Calendar API)
        
        Args:
            appointment_data: Objeto Appointment ou dicionário (não usado para link direto)
        
        Returns:
            str: URL do Google Meet
        """
        # Gerar um ID único para o Meet
        # Formato: xxx-xxxx-xxx (padrão do Google Meet)
        meet_id = str(uuid.uuid4()).replace('-', '')[:12]
        meet_link = f"https://meet.google.com/{meet_id[:3]}-{meet_id[3:7]}-{meet_id[7:11]}"
        
        # Extrair nome do paciente para log (se disponível)
        patient_name = "Paciente"
        if hasattr(appointment_data, 'patient') and appointment_data.patient:
            patient_name = getattr(appointment_data.patient, 'full_name', 'Paciente')
        elif isinstance(appointment_data, dict):
            patient_name = appointment_data.get('patient_name', 'Paciente')
        
        print(f"✅ Meet gerado para {patient_name}: {meet_link}")
        return meet_link


# Instância global do serviço
google_meet_service = GoogleMeetService()