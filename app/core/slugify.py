import re
import unicodedata


def generate_slug(text: str) -> str:
    """
    Gera um slug a partir de um nome:
    'Márcia Valdívia' -> 'marcia_valdivia'
    """
    text = text or ""
    nfkd = unicodedata.normalize('NFKD', text)
    ascii_text = nfkd.encode('ascii', 'ignore').decode('ascii')
    ascii_text = ascii_text.lower().strip()
    ascii_text = re.sub(r'[^a-z0-9]+', '_', ascii_text)
    ascii_text = re.sub(r'_+', '_', ascii_text).strip('_')
    return ascii_text or "terapeuta"
