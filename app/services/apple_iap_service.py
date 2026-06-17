"""
Servico de integracao com Apple In-App Purchase / App Store Server API.

Responsabilidades:
- Validar o JWS (signedTransaction) enviado pelo app apos uma compra
- Decodificar e verificar notificacoes Server Notifications V2 (renovacao, cancelamento, etc)
- Mapear productId (001/002/003) para plano interno (profissional/premium/essencial)

Requer:
- pip install app-store-server-library
- Chave .p8 baixada de App Store Connect (Usuarios e Acesso > Integracoes > In-App Purchase)
- Certificado raiz da Apple (AppleRootCA-G3.cer)

Variaveis de ambiente esperadas (.env):
  APPLE_IAP_KEY_ID
  APPLE_IAP_ISSUER_ID
  APPLE_IAP_KEY_PATH
  APPLE_IAP_ROOT_CERT_PATH
  APPLE_IAP_BUNDLE_ID
  APPLE_IAP_ENVIRONMENT  (Sandbox ou Production)
"""
import os
from typing import Optional

from appstoreserverlibrary.api_client import AppStoreServerAPIClient, APIException
from appstoreserverlibrary.models.Environment import Environment
from appstoreserverlibrary.signed_data_verifier import SignedDataVerifier, VerificationException


# ============================================
# MAPEAMENTO DE PRODUTOS -> PLANOS
# ============================================
# Product IDs configurados no App Store Connect (grupo "Para Terapeutas")
APPLE_PRODUCT_TO_PLAN = {
    "001": "profissional",
    "002": "premium",
    "003": "essencial",
}

PLAN_TO_APPLE_PRODUCT = {v: k for k, v in APPLE_PRODUCT_TO_PLAN.items()}


def _get_environment() -> Environment:
    env_str = os.getenv("APPLE_IAP_ENVIRONMENT", "Sandbox").strip().lower()
    if env_str == "production":
        return Environment.PRODUCTION
    return Environment.SANDBOX


def _read_private_key() -> bytes:
    key_path = os.getenv("APPLE_IAP_KEY_PATH", "/var/www/meudiva/keys/SubscriptionKey_89YVQLMP28.p8")
    with open(key_path, "rb") as f:
        return f.read()


def _read_root_certificates() -> list:
    cert_path = os.getenv("APPLE_IAP_ROOT_CERT_PATH", "/var/www/meudiva/keys/apple_certs/AppleRootCA-G3.cer")
    with open(cert_path, "rb") as f:
        return [f.read()]


_verifier_cache: Optional[SignedDataVerifier] = None
_api_client_cache: Optional[AppStoreServerAPIClient] = None


def get_signed_data_verifier() -> SignedDataVerifier:
    """
    Retorna um SignedDataVerifier configurado, reaproveitando entre chamadas
    (carregar certificados a cada request seria desperdicio de I/O).
    """
    global _verifier_cache
    if _verifier_cache is not None:
        return _verifier_cache

    bundle_id = os.getenv("APPLE_IAP_BUNDLE_ID", "com.meudiva.app")
    environment = _get_environment()
    root_certificates = _read_root_certificates()

    # app_apple_id e obrigatorio apenas em Production
    app_apple_id = None
    if environment == Environment.PRODUCTION:
        app_apple_id = int(os.getenv("APPLE_APP_ID", "6764427213"))

    _verifier_cache = SignedDataVerifier(
        root_certificates=root_certificates,
        enable_online_checks=True,
        environment=environment,
        bundle_id=bundle_id,
        app_apple_id=app_apple_id,
    )
    return _verifier_cache


def get_api_client() -> AppStoreServerAPIClient:
    """
    Retorna um AppStoreServerAPIClient configurado, para consultas adicionais
    (ex: historico de transacoes, status de assinatura) quando necessario.
    """
    global _api_client_cache
    if _api_client_cache is not None:
        return _api_client_cache

    private_key = _read_private_key()
    key_id = os.getenv("APPLE_IAP_KEY_ID", "89YVQLMP28")
    issuer_id = os.getenv("APPLE_IAP_ISSUER_ID", "55b4f376-edd1-4088-bea5-d626fd02407d")
    bundle_id = os.getenv("APPLE_IAP_BUNDLE_ID", "com.meudiva.app")
    environment = _get_environment()

    _api_client_cache = AppStoreServerAPIClient(
        private_key, key_id, issuer_id, bundle_id, environment
    )
    return _api_client_cache


class AppleTransactionInfo:
    """Estrutura simplificada com os dados que importam de uma transacao decodificada."""
    def __init__(self, decoded):
        self.product_id: str = decoded.productId
        self.transaction_id: str = decoded.transactionId
        self.original_transaction_id: str = decoded.originalTransactionId
        self.plan: Optional[str] = APPLE_PRODUCT_TO_PLAN.get(decoded.productId)
        self.expires_date_ms: Optional[int] = getattr(decoded, "expiresDate", None)
        self.purchase_date_ms: Optional[int] = getattr(decoded, "purchaseDate", None)
        self.in_app_ownership_type = getattr(decoded, "inAppOwnershipType", None)
        self.raw = decoded


def verify_transaction(signed_transaction: str) -> AppleTransactionInfo:
    """
    Verifica e decodifica um JWS de transacao (signedTransactionInfo) recebido
    do app apos uma compra via @capgo/native-purchases.

    Lanca VerificationException se a assinatura for invalida, o bundle_id nao
    corresponder, ou o ambiente nao corresponder ao configurado.
    """
    verifier = get_signed_data_verifier()
    decoded = verifier.verify_and_decode_signed_transaction(signed_transaction)
    return AppleTransactionInfo(decoded)


def verify_notification(signed_payload: str):
    """
    Verifica e decodifica uma App Store Server Notification V2 (signedPayload).
    Retorna o payload decodificado (ResponseBodyV2DecodedPayload), que contem
    notificationType, subtype, e os dados da transacao/renewal info dentro de data.
    """
    verifier = get_signed_data_verifier()
    return verifier.verify_and_decode_notification(signed_payload)