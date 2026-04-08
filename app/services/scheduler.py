import threading
import time
from datetime import datetime, timedelta
from app.db.database import SessionLocal
from app.models.subscription import Subscription
from app.models.therapist_profile import TherapistProfile
from app.models.user import User
from app.models.notification import Notification


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
                    plan_display_name = plan_names.get(sub.plan, sub.plan)
                    
                    # Criar notificação diretamente
                    notification = Notification(
                        user_id=therapist_user.id,
                        title="Assinatura próximo do vencimento",
                        message=f"Sua assinatura {plan_display_name} vencerá em {days_remaining} dias. Renove para não perder os benefícios.",
                        type="subscription_expiring",
                        is_read=False
                    )
                    db.add(notification)
                    print(f"✅ Notificação criada para terapeuta {therapist_user.id} - {plan_display_name} vence em {days_remaining} dias")
        
        db.commit()
        print(f"✅ Verificação concluída - {len(expiring_subs)} assinaturas próximas do vencimento")
        
    except Exception as e:
        print(f"❌ Erro ao verificar assinaturas: {e}")
        import traceback
        traceback.print_exc()
        db.rollback()
    finally:
        db.close()


def run_scheduler():
    """Executa o scheduler em background"""
    print("🔄 Scheduler de assinaturas iniciado - verificará diariamente às 08:00")
    while True:
        now = datetime.now()
        target_time = now.replace(hour=8, minute=0, second=0, microsecond=0)
        
        if now >= target_time:
            print(f"📅 Executando verificação - {now.strftime('%Y-%m-%d %H:%M:%S')}")
            check_expiring_subscriptions()
            time.sleep(24 * 3600)
        else:
            seconds_until_target = (target_time - now).total_seconds()
            wait_time = min(seconds_until_target, 3600) if seconds_until_target > 0 else 3600
            time.sleep(wait_time)


def start_scheduler():
    """Inicia o scheduler em uma thread separada"""
    try:
        scheduler_thread = threading.Thread(target=run_scheduler, daemon=True)
        scheduler_thread.start()
        print("✅ Scheduler de notificações de assinaturas iniciado com sucesso")
        return scheduler_thread
    except Exception as e:
        print(f"⚠️ Erro ao iniciar scheduler: {e}")
        return None