"""Privacidade dos perfis de terapeuta: o que cada pessoa pode ver (criado em 20/10/2026).
Admin e o proprio terapeuta veem o perfil completo. Qualquer outra pessoa ve so o cartao publico: sem CPF, CNPJ, conta bancaria,
Pix e assinatura; telefone e nascimento so se o terapeuta marcou 'mostrar' e quem ve e paciente."""

CAMPOS_RESTRITOS = ("cpf", "cnpj", "cpf_masked", "bank_agency", "bank_account", "bank_account_digit", "pix_key_type", "pix_key", "signature_url")


def _papel(usuario) -> str:
    papel = getattr(usuario, "role", None)
    return str(getattr(papel, "value", papel) or "").lower()


def limpar_perfil_para(usuario, d: dict) -> dict:
    d = dict(d)
    papel = _papel(usuario)
    if papel == "admin":
        return d
    if usuario is not None and d.get("user_id") is not None and getattr(usuario, "id", None) == d.get("user_id"):
        return d
    for campo in CAMPOS_RESTRITOS:
        if campo in d:
            d[campo] = None
    ver_contato = papel == "patient"
    if not (ver_contato and d.get("show_phone_to_patients") and d.get("phone")):
        if "phone" in d:
            d["phone"] = None
        if "show_phone_to_patients" in d:
            d["show_phone_to_patients"] = False
    if not (ver_contato and d.get("show_birth_date_to_patients") and d.get("birth_date")):
        if "birth_date" in d:
            d["birth_date"] = None
        if "show_birth_date_to_patients" in d:
            d["show_birth_date_to_patients"] = False
    return d
