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
            "basico": "Básico",
            "essencial": "Essencial",
            "profissional": "Profissional",
            "premium": "Premium"
        }
        
        for sub in expiring_subs:
            # 🔥 current_period_end é datetime e today é date: compara só as datas.
            days_remaining = (sub.current_period_end.date() - today).days
            # Avisa só com 7, 3 e 1 dia(s) (o job roda 1x por dia): sem repetir todo dia.
            if days_remaining not in (7, 3, 1):
                continue
            
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
            # 🔥 Contas de teste/revisão (Apple Reviewer e conta de teste) não recebem lembrete
            if therapist.id in (183, 187):
                continue
            user = db.query(User).filter(User.id == therapist.user_id).first()
            if not user or not user.email or not user.is_active:
                continue

            nome = therapist.full_name or user.full_name or "Terapeuta"
            logo_url = "https://app.meudivaonline.com/jitsi-watermark.png"
            app_url = "https://app.meudivaonline.com"

            html = f"""
            <!DOCTYPE html>
            <html>
            <head><meta charset="UTF-8"></head>
            <body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,sans-serif;">
                <div style="max-width:600px;margin:32px auto;background:white;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">

                    <!-- Header -->
                    <table role="presentation" width="100%" style="background:#ffffff;padding:22px 24px;border-collapse:collapse;border-bottom:3px solid #2F80D3;">
                        <tr>
                            <td style="width:130px;padding-right:16px;vertical-align:middle;">
                                <img src="{logo_url}" alt="Meu Divã" width="120" height="120" style="display:block;width:120px;height:120px;object-fit:contain;">
                            </td>
                            <td style="vertical-align:middle;">
                                <span style="color:#2F80D3;font-size:1.25rem;font-weight:700;white-space:nowrap;">Meu Divã</span>
                            </td>
                        </tr>
                    </table>

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
                        <img src="{logo_url}" alt="Meu Divã" width="48" height="48" style="width:48px;height:48px;object-fit:contain;vertical-align:middle;margin-right:8px;">
                        <span style="color:#aaa;font-size:0.78rem;">Meu Divã · contato@meudivaonline.com</span>
                    </div>
                </div>
            </body>
            </html>
            """

            try:
                enviado = email_service._send_email(
                    to_email=user.email,
                    subject="⚠️ Complete seu perfil — envie seus documentos no Meu Divã",
                    html_content=html
                )
                if enviado:
                    sent_count += 1
                    print(f"   ✅ E-mail enviado para {user.email} ({nome})")
                else:
                    print(f"   ❌ Falha ao enviar e-mail para {user.email} ({nome})")
            except Exception as e:
                print(f"   ❌ Erro ao enviar e-mail para {user.email}: {e}")

        print(f"✅ Notificações enviadas: {sent_count} de {len(therapists_without_docs)} terapeutas sem documentos")

    except Exception as e:
        print(f"❌ Erro em check_therapists_without_documents: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()


# 🔥 Frequência do lembrete de documentos: None = todo dia; {0} = só segunda-feira
# (0=segunda ... 6=domingo)
DOC_REMINDER_WEEKDAYS = None


def _claim_daily_run(job_name: str) -> bool:
    """
    True só para a PRIMEIRA execução do dia de cada job. O backend roda com mais
    de um worker (cada um com sua thread de scheduler) e a janela de disparo
    dura 2 minutos, então sem isso o mesmo job rodava até 4 vezes por dia.
    """
    import os as _os
    marker = f"/tmp/meudiva_job_{job_name}_{datetime.now().strftime('%Y%m%d')}"
    try:
        fd = _os.open(marker, _os.O_CREAT | _os.O_EXCL | _os.O_WRONLY)
        _os.close(fd)
        return True
    except FileExistsError:
        return False
    except Exception as e:
        print(f"⚠️ Erro no controle de execução diária ({job_name}): {e}")
        return True


def _claim_run(marker_name: str) -> bool:
    """True só na primeira chamada com esse nome (marcador atômico em /tmp, vale entre workers)."""
    import os as _os
    marker = f"/tmp/meudiva_job_{marker_name}"
    try:
        fd = _os.open(marker, _os.O_CREAT | _os.O_EXCL | _os.O_WRONLY)
        _os.close(fd)
        return True
    except FileExistsError:
        return False
    except Exception as e:
        print(f"⚠️ Erro no controle de execução ({marker_name}): {e}")
        return True


def apply_scheduled_cancellations():
    """Rebaixa para 'basico' as assinaturas canceladas pelo terapeuta cujo período pago já terminou."""
    from app.services.notification_service import NotificationService
    from app.core.pricing_config import get_plan_name
    db = SessionLocal()
    try:
        agora = datetime.now()
        vencidas = db.query(Subscription).filter(
            Subscription.status == "active",
            Subscription.cancel_at_period_end == True,
            Subscription.current_period_end != None,
            Subscription.current_period_end <= agora,
        ).all()
        for sub in vencidas:
            plano_antigo = sub.plan
            terapeuta_id = sub.therapist_id
            sub.status = "cancelled"
            sub.plan = "basico"
            sub.cancel_at_period_end = False
            sub.updated_at = agora
            db.commit()
            print(f"🗓️ Cancelamento agendado concluido: perfil {terapeuta_id} voltou ao Basico (era {plano_antigo})")
            try:
                tp = db.get(TherapistProfile, terapeuta_id)
                user = db.get(User, tp.user_id) if tp else None
                if user:
                    NotificationService(db).notify_subscription_cancelled(user, get_plan_name(plano_antigo))
            except Exception as e:
                print(f"⚠️ Erro notificacao do cancelamento concluido: {e}")
    except Exception as e:
        print(f"❌ Erro em apply_scheduled_cancellations: {e}")
        db.rollback()
    finally:
        db.close()


def _send_unpaid_warning(user, deadline_utc) -> bool:
    import html as _html
    from app.services.email_service import email_service
    nome = _html.escape((user.full_name or "").split(" ")[0] or "Terapeuta")
    limite_br = (deadline_utc - timedelta(hours=3)).strftime("%d/%m às %H:%M")
    corpo = f"""
    <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;">
      <img src="https://app.meudivaonline.com/jitsi-watermark.png" alt="Meu Divã" width="80" height="80" style="display:block;margin-bottom:16px;">
      <h2 style="color:#E03673;margin:0 0 12px;">Falta só escolher seu plano</h2>
      <p style="color:#555;line-height:1.6;">Olá, <strong>{nome}</strong>! Seu cadastro de terapeuta no Meu Divã foi criado, mas ainda falta escolher um plano para começar a atender.</p>
      <p style="color:#555;line-height:1.6;">Escolha seu plano até <strong>{limite_br}</strong> (horário de Brasília). Depois dessa data, o cadastro poderá ser excluído automaticamente.</p>
      <p style="color:#555;line-height:1.6;">Os planos começam em R$&nbsp;19,90/mês, e o Essencial tem 7 dias para experimentar.</p>
      <p style="margin:24px 0;"><a href="https://app.meudivaonline.com/adesao" style="display:inline-block;background:#E03673;color:#fff;padding:12px 28px;border-radius:50px;text-decoration:none;font-weight:600;">Escolher meu plano</a></p>
      <p style="color:#888;font-size:13px;line-height:1.6;">Se tiver qualquer dificuldade para concluir o pagamento, escreva para contato@meudivaonline.com.</p>
    </div>
    """
    try:
        return bool(email_service._send_email(
            to_email=user.email,
            subject="⏳ Falta escolher seu plano no Meu Divã",
            html_content=corpo,
        ))
    except Exception as e:
        print(f"⚠️ Erro ao enviar aviso: {e}")
        return False


def cleanup_unpaid_signups(live=None, warn_after_hours=None):
    """
    Cadastros de terapeuta SEM assinatura (sem linha em subscriptions):
      1) passadas warn_after_hours do cadastro, envia o aviso;
      2) 48h depois do aviso (ou da última tentativa de checkout, se for mais recente), exclui.
    Nunca exclui quem tem consulta, saldo ou documentos enviados.
    Em modo SIMULACAO (padrão) só imprime o que faria.
    """
    import os as _os
    from datetime import timezone
    from sqlalchemy import text as _text, exists as _exists
    from app.models.appointment import Appointment
    from app.models.wallet import Wallet
    from app.models.therapist_document import TherapistDocument

    if live is None:
        live = _os.getenv("ONBOARDING_CLEANUP_LIVE", "false").strip().lower() in ("1", "true", "yes", "sim")
    if warn_after_hours is None:
        try:
            warn_after_hours = float(_os.getenv("ONBOARDING_WARN_AFTER_HOURS", "24"))
        except ValueError:
            warn_after_hours = 24.0
    GRACE = timedelta(hours=48)
    PROTEGIDOS = {183, 187}
    modo = "AO VIVO" if live else "SIMULACAO"

    def naive_utc(dt):
        if dt is not None and dt.tzinfo is not None:
            dt = dt.astimezone(timezone.utc).replace(tzinfo=None)
        return dt

    db = SessionLocal()
    resumo = {"avisaria": 0, "apagaria": 0, "aguardando": 0, "protegido": 0, "novo_demais": 0}
    try:
        agora = datetime.utcnow()
        print(f"🧹 [{modo}] cadastros sem plano - {agora:%Y-%m-%d %H:%M:%S} UTC | avisar apos {warn_after_hours}h")
        candidatos = db.query(User, TherapistProfile).join(
            TherapistProfile, TherapistProfile.user_id == User.id
        ).filter(
            User.deletion_status != "deleted",
            User.is_active == True,
            ~User.email.ilike("%@meudivaonline.com"),
            ~_exists().where(Subscription.therapist_id == TherapistProfile.id),
        ).all()

        for user, tp in candidatos:
            if tp.id in PROTEGIDOS:
                continue

            motivos = []
            if db.query(Appointment.id).filter(Appointment.therapist_user_id == user.id).first():
                motivos.append("consulta")
            carteira = db.query(Wallet).filter(Wallet.therapist_id == tp.id).first()
            if carteira is not None and float(carteira.balance or 0) != 0:
                motivos.append("saldo")
            if db.query(TherapistDocument.id).filter(TherapistDocument.therapist_id == tp.id).first():
                motivos.append("documentos")
            if motivos:
                resumo["protegido"] += 1
                print(f"   🛡️ usuario {user.id} (perfil {tp.id}) protegido: {', '.join(motivos)}")
                continue

            criado = naive_utc(user.created_at)
            row = db.execute(
                _text("SELECT warned_at, last_attempt_at FROM onboarding_cleanup WHERE user_id = :u"),
                {"u": user.id},
            ).first()
            warned_at = row[0] if row else None
            last_attempt = row[1] if row else None

            if warned_at is None:
                if criado and agora - criado >= timedelta(hours=warn_after_hours):
                    resumo["avisaria"] += 1
                    print(f"   ✉️ usuario {user.id} (perfil {tp.id}, cadastro {criado:%d/%m %H:%M}): {'AVISANDO' if live else 'avisaria'}")
                    if live and _send_unpaid_warning(user, agora + GRACE):
                        db.execute(
                            _text("INSERT INTO onboarding_cleanup (user_id, warned_at) VALUES (:u, :t) ON CONFLICT (user_id) DO UPDATE SET warned_at = :t"),
                            {"u": user.id, "t": agora},
                        )
                        db.commit()
                else:
                    resumo["novo_demais"] += 1
                continue

            base = max(warned_at, last_attempt) if last_attempt else warned_at
            limite = base + GRACE
            if agora < limite:
                resumo["aguardando"] += 1
                print(f"   ⏳ usuario {user.id} aguardando ate {limite:%d/%m %H:%M} UTC")
                continue

            resumo["apagaria"] += 1
            print(f"   🗑️ usuario {user.id} (perfil {tp.id}): {'EXCLUINDO' if live else 'apagaria'}")
            if not live:
                continue
            if db.query(Subscription.id).filter(Subscription.therapist_id == tp.id).first():
                print(f"   ↪ usuario {user.id} acabou de assinar, mantido")
                continue
            try:
                if carteira is not None:
                    db.delete(carteira)
                db.delete(tp)
                user.is_active = False
                user.email = f"deleted_{user.id}_{user.email}"
                user.full_name = None
                user.password_hash = None
                user.deletion_status = "deleted"
                user.deletion_confirmed_at = datetime.now()
                db.execute(
                    _text("UPDATE onboarding_cleanup SET deleted_at = :t WHERE user_id = :u"),
                    {"t": agora, "u": user.id},
                )
                db.commit()
                print(f"   ✅ usuario {user.id} excluido")
            except Exception as e:
                db.rollback()
                print(f"   ❌ falha ao excluir usuario {user.id}: {e}")

        print(f"🧹 [{modo}] resumo: {resumo}")
    except Exception as e:
        print(f"❌ Erro em cleanup_unpaid_signups: {e}")
        db.rollback()
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

        if diff_subs < 60 and _claim_daily_run("subs"):
            print(f"📅 Executando verificação de assinaturas - {now.strftime('%Y-%m-%d %H:%M:%S')}")
            check_expiring_subscriptions()

        if (
            diff_docs < 60
            and (DOC_REMINDER_WEEKDAYS is None or now.weekday() in DOC_REMINDER_WEEKDAYS)
            and _claim_daily_run("docs")
        ):
            print(f"📋 Executando verificação de documentos - {now.strftime('%Y-%m-%d %H:%M:%S')}")
            check_therapists_without_documents()

        # 🔥 Cancelamentos agendados: a cada hora, rebaixa quem passou do fim do período pago
        if now.minute < 2 and _claim_run(f"cancel_{now.strftime('%Y%m%d%H')}"):
            apply_scheduled_cancellations()

        # 🔥 Repasse dos pacotes de pacientes: a cada hora, registra as sessões concluídas (ou com falta)
        if now.minute < 2 and _claim_run(f"pkgpay_{now.strftime('%Y%m%d%H')}"):
            try:
                from app.services.patient_package_booking import settle_package_payouts
                settle_package_payouts()
            except Exception as _e:
                print(f"❌ Erro no repasse dos pacotes: {_e}")

        # 🔥 Cadastros sem plano: diário às 12:00 UTC (9h em Brasília). Simulação até ONBOARDING_CLEANUP_LIVE=true
        target_cleanup = now.replace(hour=12, minute=0, second=0, microsecond=0)
        if abs((now - target_cleanup).total_seconds()) < 60 and _claim_daily_run("cleanup"):
            cleanup_unpaid_signups()

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