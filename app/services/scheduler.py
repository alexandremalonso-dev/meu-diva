import threading
import time
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from app.db.database import SessionLocal
from app.models.subscription import Subscription
from app.models.therapist_profile import TherapistProfile
from app.models.user import User
from app.services.notification_service import NotificationService

def check_expiring_subscriptions():
    """Verifica assinaturas que vao expirar nos proximos 7 dias e envia notificacoes"""
    db = SessionLocal()
    try:
        today = datetime.now().date()
        expire_threshold = today + timedelta(days=7)
        
        expiring_subs = db.query(Subscription).filter(
            Subscription.status == "active",
            Subscription.current_period_end <= expire_threshold,
            Subscription.current_period_end > today
        ).all()
        
        plan_names = {
            "essencial": "Essencial",
            "profissional": "Profissional",
            "premium": "Premium"
        }
        
        for sub in expiring_subs:
            days_remaining = (sub.current_period_end - today).days
            
            therapist_profile = db.query(TherapistProfile).filter(
                TherapistProfile.id == sub.therapist_id
            ).first()
            
            if therapist_profile:
                therapist_user = db.query(User).filter(
                    User.id == therapist_profile.user_id
                ).first()
                
                if therapist_user:
                    notification_service = NotificationService(db)
                    plan_display_name = plan_names.get(sub.plan, sub.plan)
                    notification_service.notify_subscription_expiring(
                        therapist_user, 
                        plan_display_name, 
                        days_remaining
                    )
                    print(f"Notificacao de expiracao enviada para terapeuta {therapist_user.id}")
        
        db.commit()
    except Exception as e:
        print(f"Erro ao verificar assinaturas expirando: {e}")
    finally:
        db.close()

def run_scheduler():
    """Executa o scheduler em background"""
    while True:
        now = datetime.now()
        target_time = now.replace(hour=8, minute=0, second=0, microsecond=0)
        
        if now >= target_time:
            print(f"Executando verificacao de assinaturas expirando - {now}")
            check_expiring_subscriptions()
            time.sleep(24 * 3600)
        else:
            seconds_until_target = (target_time - now).total_seconds()
            if seconds_until_target > 0:
                time.sleep(min(seconds_until_target, 3600))
            else:
                time.sleep(3600)

def start_scheduler():
    """Inicia o scheduler em uma thread separada"""
    scheduler_thread = threading.Thread(target=run_scheduler, daemon=True)
    scheduler_thread.start()
    print("Scheduler de notificacoes de assinaturas iniciado")