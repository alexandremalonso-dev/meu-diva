"""
Serviço de integração com Google Meet
Estratégia 1: Conta central do sistema
"""

import os
from datetime import datetime, timedelta
from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build

# Escopos necessários
SCOPES = [
    'https://www.googleapis.com/auth/calendar',
    'https://www.googleapis.com/auth/calendar.events'
]

class GoogleMeetService:
    """Serviço para criar sessões no Google Meet"""
    
    def __init__(self):
        self.creds = None
        self.service = None
        self._authenticate()
    
    def _authenticate(self):
        """Autentica com Google Calendar API"""
        token_file = 'token.json'
        credentials_file = 'credentials.json'
        
        # Carrega credenciais do arquivo token.json se existir
        if os.path.exists(token_file):
            self.creds = Credentials.from_authorized_user_file(token_file, SCOPES)
        
        # Se não tem credenciais válidas, faz login
        if not self.creds or not self.creds.valid:
            if self.creds and self.creds.expired and self.creds.refresh_token:
                self.creds.refresh(Request())
            else:
                if not os.path.exists(credentials_file):
                    raise Exception(
                        "Arquivo credentials.json não encontrado. "
                        "Baixe em: https://console.cloud.google.com/apis/credentials"
                    )
                flow = InstalledAppFlow.from_client_secrets_file(
                    credentials_file, SCOPES)
                self.creds = flow.run_local_server(port=0)
            
            # Salva credenciais para próxima execução
            with open(token_file, 'w') as token:
                token.write(self.creds.to_json())
        
        self.service = build('calendar', 'v3', credentials=self.creds)
        print("✅ Google Calendar autenticado com sucesso!")
    
    def create_meet_link(self, appointment):
        """
        Cria um evento no Google Calendar com link do Meet
        
        Args:
            appointment: Objeto Appointment do banco
            
        Returns:
            str: URL do Google Meet
        """
        try:
            # Define título do evento
            summary = f"Sessão Terapêutica - Meu Divã"
            
            # Define descrição
            description = f"""
Sessão terapêutica agendada no Meu Divã

Paciente: {appointment.patient.full_name if appointment.patient and appointment.patient.full_name else 'Paciente'}
Terapeuta: {appointment.therapist.full_name if appointment.therapist and appointment.therapist.full_name else 'Terapeuta'}
ID da sessão: {appointment.id}

Para acessar, clique no link abaixo no horário agendado.
            """
            
            # Define horários
            start_time = appointment.starts_at
            end_time = appointment.ends_at
            
            # Cria evento no Google Calendar
            event = {
                'summary': summary,
                'description': description.strip(),
                'start': {
                    'dateTime': start_time.isoformat(),
                    'timeZone': 'America/Sao_Paulo',
                },
                'end': {
                    'dateTime': end_time.isoformat(),
                    'timeZone': 'America/Sao_Paulo',
                },
                'conferenceData': {
                    'createRequest': {
                        'requestId': f'appointment_{appointment.id}',
                        'conferenceSolutionKey': {'type': 'hangoutsMeet'}
                    }
                },
                'reminders': {
                    'useDefault': False,
                    'overrides': [
                        {'method': 'email', 'minutes': 60},
                        {'method': 'popup', 'minutes': 15},
                    ],
                },
            }
            
            # Adiciona participantes se tiverem email
            attendees = []
            if appointment.patient and appointment.patient.email:
                attendees.append({'email': appointment.patient.email})
            if appointment.therapist and appointment.therapist.email:
                attendees.append({'email': appointment.therapist.email})
            if attendees:
                event['attendees'] = attendees
            
            # Insere evento no calendário
            calendar_id = 'primary'
            event_result = self.service.events().insert(
                calendarId=calendar_id,
                body=event,
                conferenceDataVersion=1,
                sendUpdates='all'
            ).execute()
            
            # Extrai o link do Meet
            meet_link = None
            if 'conferenceData' in event_result:
                entry_points = event_result['conferenceData'].get('entryPoints', [])
                for entry in entry_points:
                    if entry.get('entryPointType') == 'video':
                        meet_link = entry.get('uri')
                        break
            
            # Salva o event_id para futuras atualizações
            if event_result.get('id'):
                appointment.google_event_id = event_result.get('id')
            
            print(f"✅ Meet criado para appointment {appointment.id}: {meet_link}")
            return meet_link
            
        except Exception as e:
            print(f"❌ Erro ao criar Meet: {e}")
            return None
    
    def update_meet_link(self, appointment, new_start, new_end):
        """
        Atualiza um evento no Google Calendar quando reagendado
        
        Args:
            appointment: Objeto Appointment
            new_start: Nova data/hora de início
            new_end: Nova data/hora de fim
            
        Returns:
            str: URL do Meet (se ainda existir)
        """
        try:
            # Busca o evento pelo ID
            event_id = getattr(appointment, 'google_event_id', None)
            if not event_id:
                return self.create_meet_link(appointment)
            
            # Atualiza o evento existente
            event = self.service.events().get(
                calendarId='primary',
                eventId=event_id
            ).execute()
            
            event['start']['dateTime'] = new_start.isoformat()
            event['end']['dateTime'] = new_end.isoformat()
            
            updated_event = self.service.events().update(
                calendarId='primary',
                eventId=event_id,
                body=event,
                sendUpdates='all'
            ).execute()
            
            # Extrai o link do Meet
            meet_link = None
            if 'conferenceData' in updated_event:
                entry_points = updated_event['conferenceData'].get('entryPoints', [])
                for entry in entry_points:
                    if entry.get('entryPointType') == 'video':
                        meet_link = entry.get('uri')
                        break
            
            return meet_link
            
        except Exception as e:
            print(f"❌ Erro ao atualizar Meet: {e}")
            return None
    
    def cancel_meet_event(self, appointment):
        """
        Cancela um evento no Google Calendar
        
        Args:
            appointment: Objeto Appointment com google_event_id
        """
        try:
            event_id = getattr(appointment, 'google_event_id', None)
            if not event_id:
                return
            
            self.service.events().delete(
                calendarId='primary',
                eventId=event_id,
                sendUpdates='all'
            ).execute()
            
            print(f"✅ Evento cancelado para appointment {appointment.id}")
            
        except Exception as e:
            print(f"❌ Erro ao cancelar evento: {e}")


# Instância global do serviço
google_meet_service = GoogleMeetService()