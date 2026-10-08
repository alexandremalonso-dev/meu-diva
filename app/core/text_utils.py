# app/core/text_utils.py

_LOWERCASE_PARTICLES = {"de", "da", "do", "das", "dos", "e"}


def normalize_full_name(name: str | None) -> str | None:
    """
    Normaliza nomes de usuários pra Title Case, mantendo em minúsculo as
    preposições/conectivos comuns em nomes brasileiros (de, da, do, das,
    dos, e). Ex: "LUANA PINHEIRO DA SILVA" -> "Luana Pinheiro da Silva".
    Trata também nomes compostos com hífen (ex: "ana-maria" -> "Ana-Maria").
    """
    if not name:
        return name

    words = name.strip().split()
    if not words:
        return name

    result = []
    for i, word in enumerate(words):
        lower = word.lower()
        if i > 0 and lower in _LOWERCASE_PARTICLES:
            result.append(lower)
        else:
            result.append("-".join(part.capitalize() for part in lower.split("-")))

    return " ".join(result)
