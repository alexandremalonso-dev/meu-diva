""" Serviço de integração com Google Meet """
import os
from datetime import datetime
from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build

# ============================================
# CONFIGURAÇÃO DE CAMINHOS ABSOLUTOS
# ============================================
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
TOKEN_FILE = os.path.join(BASE_DIR, 'token.json')
CREDENTIALS_FILE = os.path.join(BASE_DIR, 'credentials.json')

# 🔥 ESCOPOS CORRETOS - Apenas Calendar, que já cria Meet automaticamente
SCOPES = [
    'https://www.googleapis.com/auth/calendar.events',
    'https://www.googleapis.com/auth/calendar'
]


class GoogleMeetService:
    """Serviço para criação de links do Google Meet"""
    
    def __init__(self):
        """Inicializa o serviço com autenticação"""
        self.service = None
        self._authenticate()
    
    def _authenticate(self):
        """Autentica com o Google usando credenciais"""
        try:
            creds = None
            
            # Verificar se existe token salvo
            if os.path.exists(TOKEN_FILE):
                print(f"📁 Token encontrado em: {TOKEN_FILE}")
                creds = Credentials.from_authorized_user_file(TOKEN_FILE, SCOPES)
            
            # Se não há credenciais válidas, fazer login
            if not creds or not creds.valid:
                if creds and creds.expired and creds.refresh_token:
                    print("🔄 Atualizando token expirado...")
                    creds.refresh(Request())
                else:
                    print("🔑 Solicitando nova autenticação...")
                    if not os.path.exists(CREDENTIALS_FILE):
                        raise FileNotFoundError(
                            f"Arquivo de credenciais não encontrado em: {CREDENTIALS_FILE}\n"
                            f"Por favor, coloque o arquivo credentials.json na pasta: {BASE_DIR}"
                        )
                    flow = InstalledAppFlow.from_client_secrets_file(CREDENTIALS_FILE, SCOPES)
                    creds = flow.run_local_server(port=0)
                
                # Salvar token para próxima execução
                with open(TOKEN_FILE, 'w') as token:
                    token.write(creds.to_json())
                print(f"✅ Token salvo em: {TOKEN_FILE}")
            
            # Construir o serviço de calendar
            self.service = build('calendar', 'v3', credentials=creds)
            print("✅ Google Meet Service inicializado com sucesso!")
            
        except Exception as e:
            print(f"❌ Erro ao autenticar Google Meet: {str(e)}")
            print(f"   - Credentials procurado em: {CREDENTIALS_FILE}")
            print(f"   - Token procurado em: {TOKEN_FILE}")
            self.service = None
    
    def create_meet_link(self, appointment_data):
        """
        Cria um link do Google Meet para uma sessão
        
        Args:
            appointment_data: Objeto Appointment ou dicionário com starts_at, ends_at
        
        Returns:
            str: URL do Google Meet ou None se falhar
        """
        if not self.service:
            print("⚠️ Serviço Google Meet não disponível")
            return None
        
        try:
            # Extrair dados
            if hasattr(appointment_data, 'starts_at'):
                start = appointment_data.starts_at
                end = appointment_data.ends_at
                title = f"Sessão de Terapia"
                if hasattr(appointment_data, 'patient') and appointment_data.patient:
                    patient_name = getattr(appointment_data.patient, 'full_name', 'Paciente')
                    title = f"Sessão com {patient_name}"
            else:
                start = appointment_data.get('starts_at')
                end = appointment_data.get('ends_at')
                title = appointment_data.get('title', 'Sessão de Terapia')
            
            # Converter para datetime se for string
            if isinstance(start, str):
                start = datetime.fromisoformat(start.replace('Z', '+00:00'))
            if isinstance(end, str):
                end = datetime.fromisoformat(end.replace('Z', '+00:00'))
            
            # Formatar para o Google Calendar
            start_iso = start.isoformat()
            end_iso = end.isoformat()
            
            # Criar evento com Meet
            event = {
                'summary': title,
                'description': 'Sessão de terapia online - Link do Google Meet gerado automaticamente',
                'start': {
                    'dateTime': start_iso,
                    'timeZone': 'America/Sao_Paulo',
                },
                'end': {
                    'dateTime': end_iso,
                    'timeZone': 'America/Sao_Paulo',
                },
                'conferenceData': {
                    'createRequest': {
                        'requestId': f"meet-{int(start.timestamp())}",
                        'conferenceSolutionKey': {'type': 'hangoutsMeet'}
                    }
                }
            }
            
            # Criar evento com conferência
            created_event = self.service.events().insert(
                calendarId='primary',
                body=event,
                conferenceDataVersion=1
            ).execute()
            
            # Extrair link do Meet
            meet_link = created_event.get('hangoutLink')
            if meet_link:
                print(f"✅ Meet criado: {meet_link}")
                return meet_link
            else:
                print("⚠️ Evento criado mas sem link Meet")
                return None
                
        except Exception as e:
            print(f"❌ Erro ao criar Meet: {e}")
            return None


# Instância global do serviço
google_meet_service = None
try:
    google_meet_service = GoogleMeetService()
except Exception as e:
    print(f"❌ Falha ao inicializar GoogleMeetService: {e}")
    google_meet_service = None