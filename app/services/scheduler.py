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


# ==========================
# 🔥 NOTIFICAÇÃO: TERAPEUTAS SEM DOCUMENTOS
# Roda diariamente às 09:00
# Envia e-mail para terapeutas que não enviaram nenhum documento
# ==========================

def check_therapists_without_documents():
    """
    Verifica terapeutas que não enviaram documentos para validação
    e envia e-mail lembrando de completar o perfil.
    """
    from app.models.therapist_document import TherapistDocument
    from app.services.email_service import email_service

    db = SessionLocal()
    try:
        print(f"\n📋 Verificando terapeutas sem documentos - {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")

        # Busca todos os terapeutas ativos
        all_therapists = db.query(TherapistProfile).all()

        # IDs de terapeutas que já enviaram pelo menos 1 documento
        therapists_with_docs = db.query(TherapistDocument.therapist_id).distinct().all()
        ids_with_docs = {row[0] for row in therapists_with_docs}

        # Filtra os que não enviaram nenhum documento
        therapists_without_docs = [
            t for t in all_therapists
            if t.id not in ids_with_docs
        ]

        print(f"   Total: {len(all_therapists)} | Com documentos: {len(ids_with_docs)} | Sem documentos: {len(therapists_without_docs)}")

        sent_count = 0
        for therapist in therapists_without_docs:
            user = db.query(User).filter(User.id == therapist.user_id).first()
            if not user or not user.email or not user.is_active:
                continue

            nome = therapist.full_name or user.full_name or "Terapeuta"
            logo_url = "https://meudivaonline.com/wp-content/uploads/favicon-meudiva.png"
            app_url = "https://app.meudivaonline.com"

            html = f"""
            <!DOCTYPE html>
            <html>
            <head><meta charset="UTF-8"></head>
            <body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,sans-serif;">
                <div style="max-width:600px;margin:32px auto;background:white;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">

                    <!-- Header -->
                    <div style="background:#2F80D3;padding:20px 24px;display:flex;align-items:center;gap:12px;">
                        <img src="{logo_url}" alt="Meu Divã" style="width:40px;height:40px;border-radius:8px;object-fit:contain;background:white;padding:2px;">
                        <span style="color:white;font-size:1.2rem;font-weight:700;">Meu Divã</span>
                    </div>

                    <!-- Corpo -->
                    <div style="padding:28px 24px;">
                        <h2 style="color:#2F80D3;margin:0 0 16px;">Olá, {nome}! 👋</h2>

                        <p style="color:#555;line-height:1.6;margin:0 0 16px;">
                            Notamos que você ainda não enviou seus documentos para validação do perfil no <strong>Meu Divã</strong>.
                        </p>

                        <p style="color:#555;line-height:1.6;margin:0 0 20px;">
                            Terapeutas com perfil validado recebem o <strong>selo de Terapeuta Verificado ✅</strong>
                            e aparecem com destaque para os pacientes, gerando mais confiança e agendamentos.
                        </p>

                        <!-- Documentos necessários -->
                        <div style="background:#f9f5ff;border-left:4px solid #E03673;border-radius:8px;padding:16px 20px;margin:0 0 24px;">
                            <p style="color:#E03673;font-weight:700;margin:0 0 10px;">📄 Documentos necessários:</p>
                            <ul style="color:#555;margin:0;padding-left:20px;line-height:2;">
                                <li>Diploma ou Certificado de Formação</li>
                                <li>Registro Profissional (CRP, CRM, etc.)</li>
                            </ul>
                        </div>

                        <!-- Botão -->
                        <a href="{app_url}/therapist/documents/required"
                           style="display:inline-block;background:#E03673;color:white;padding:12px 28px;border-radius:50px;text-decoration:none;font-weight:600;font-size:0.95rem;">
                            Enviar documentos agora →
                        </a>

                        <p style="margin-top:28px;color:#888;font-size:0.85rem;line-height:1.6;">
                            Qualquer dúvida, entre em contato com nossa equipe.<br>
                            <strong>Time Meu Divã</strong>
                        </p>
                    </div>

                    <!-- Footer -->
                    <div style="border-top:1px solid #eee;padding:16px 24px;text-align:center;">
                        <img src="{logo_url}" alt="Meu Divã" style="width:28px;height:28px;border-radius:6px;object-fit:contain;vertical-align:middle;margin-right:8px;">
                        <span style="color:#aaa;font-size:0.78rem;">Meu Divã · contato@meudivaonline.com</span>
                    </div>
                </div>
            </body>
            </html>
            """

            try:
                email_service._send_email(
                    to_email=user.email,
                    subject="⚠️ Complete seu perfil — envie seus documentos no Meu Divã",
                    html_content=html
                )
                sent_count += 1
                print(f"   ✅ E-mail enviado para {user.email} ({nome})")
            except Exception as e:
                print(f"   ❌ Erro ao enviar e-mail para {user.email}: {e}")

        print(f"✅ Notificações enviadas: {sent_count} de {len(therapists_without_docs)} terapeutas sem documentos")

    except Exception as e:
        print(f"❌ Erro em check_therapists_without_documents: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()


def run_scheduler():
    """Executa o scheduler em background"""
    print("🔄 Scheduler iniciado")
    while True:
        now = datetime.now()

        # Verificação de assinaturas às 08:00
        target_subscriptions = now.replace(hour=8, minute=0, second=0, microsecond=0)
        # Verificação de documentos às 09:00
        target_documents = now.replace(hour=9, minute=0, second=0, microsecond=0)

        # Janela de execução: se estiver dentro do minuto alvo, executa
        diff_subs = abs((now - target_subscriptions).total_seconds())
        diff_docs = abs((now - target_documents).total_seconds())

        if diff_subs < 60:
            print(f"📅 Executando verificação de assinaturas - {now.strftime('%Y-%m-%d %H:%M:%S')}")
            check_expiring_subscriptions()

        if diff_docs < 60:
            print(f"📋 Executando verificação de documentos - {now.strftime('%Y-%m-%d %H:%M:%S')}")
            check_therapists_without_documents()

        # Verifica a cada 60 segundos
        time.sleep(60)


def start_scheduler():
    """Inicia o scheduler em uma thread separada"""
    try:
        scheduler_thread = threading.Thread(target=run_scheduler, daemon=True)
        scheduler_thread.start()
        print("✅ Scheduler de notificações iniciado com sucesso")
        return scheduler_thread
    except Exception as e:
        print(f"⚠️ Erro ao iniciar scheduler: {e}")
        return None