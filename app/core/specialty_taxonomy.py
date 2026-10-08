# app/core/specialty_taxonomy.py
#
# Taxonomia estruturada de especialidades do Meu Divã. Substitui o antigo
# campo de texto livre por 6 categorias fixas, cada uma com uma única
# opção selecionável por terapeuta. Baseado na proposta anexada em
# 22/09/2026.

PROFESSIONAL_TYPES = [
    "Coach",
    "Nutricionista",
    "Psicanalista",
    "Psicólogo(a)",
    "Psiquiatra",
    "Terapeuta",
    "Terapeuta Integrativo/Holístico",
    "Terapeuta Ocupacional",
]

THERAPEUTIC_APPROACHES = [
    "Psicanálise",
    "Psicanálise Winnicottiana",
    "Psicanálise Lacaniana",
    "Psicanálise Freudiana",
    "Psicologia Analítica / Junguiana",
    "Terapia Cognitivo-Comportamental (TCC)",
    "Terapia Comportamental",
    "Terapia Humanista",
    "Gestalt-terapia",
    "Abordagem Centrada na Pessoa",
    "Psicodrama",
    "Terapia Sistêmica",
    "Terapia Familiar",
]

INTEGRATIVE_PRACTICES = [
    "Acupuntura",
    "Antroposofia aplicada à saúde",
    "Apiterapia",
    "Aromaterapia",
    "Arteterapia",
    "Ayurveda",
    "Biodança",
    "Bioenergética",
    "Constelação Familiar",
    "Cromoterapia",
    "Dança Circular",
    "Geoterapia",
    "Hipnoterapia",
    "Homeopatia",
    "Imposição de mãos",
    "Medicina Tradicional Chinesa",
    "Meditação",
    "Musicoterapia",
    "Naturopatia",
    "Osteopatia",
    "Ozonioterapia",
    "Plantas Medicinais / Fitoterapia",
    "Quiropraxia",
    "Reflexoterapia",
    "Reiki",
    "Shantala",
    "Terapia Comunitária Integrativa",
    "Terapia de Florais",
    "Termalismo / Crenoterapia",
    "Yoga",
]

TARGET_AUDIENCES = [
    "Adultos",
    "Adolescentes",
    "Crianças",
    "Idosos",
    "Casais",
    "Famílias",
]

DEMAND_FOCUSES = [
    "Ansiedade",
    "Depressão",
    "Estresse",
    "Burnout",
    "Relacionamentos",
    "Luto",
    "Autoestima",
    "Autoconhecimento",
    "Trabalho e carreira",
    "Conflitos familiares",
    "Sexualidade",
    "Dependência emocional",
    "Transtornos alimentares",
    "Sono",
    "Desenvolvimento pessoal",
]

SERVICE_MODALITIES = [
    "Atendimento individual",
    "Atendimento de casal",
    "Atendimento familiar",
    "Atendimento em grupo",
    "Atendimento corporativo",
]

TAXONOMY = {
    "professional_type": PROFESSIONAL_TYPES,
    "therapeutic_approach": THERAPEUTIC_APPROACHES,
    "integrative_practice": INTEGRATIVE_PRACTICES,
    "target_audience": TARGET_AUDIENCES,
    "demand_focus": DEMAND_FOCUSES,
    "service_modality": SERVICE_MODALITIES,
}

# Palavras-chave extras pra reconhecer no texto livre além do nome exato
# da opção (ex: "TCC" já é sigla comum pra Terapia Cognitivo-Comportamental)
_EXTRA_KEYWORDS = {
    "Terapia Cognitivo-Comportamental (TCC)": ["tcc", "cognitivo comportamental", "cognitivo-comportamental"],
    "Psicologia Analítica / Junguiana": ["junguiana", "jung"],
    "Plantas Medicinais / Fitoterapia": ["fitoterapia", "plantas medicinais"],
    "Medicina Tradicional Chinesa": ["mtc", "medicina chinesa"],
    "Termalismo / Crenoterapia": ["crenoterapia", "termalismo"],
    "Trabalho e carreira": ["carreira", "trabalho"],
    "Dependência emocional": ["dependência emocional", "dependencia emocional"],
    "Transtornos alimentares": ["transtorno alimentar", "transtornos alimentares"],
    "Conflitos familiares": ["conflito familiar", "conflitos familiares", "relacionamento familiar"],
    "Desenvolvimento pessoal": ["desenvolvimento pessoal", "desenvolvimento emocional"],
}


def classify_text(free_text: str, category: str) -> str | None:
    """
    Procura no texto livre por qualquer opção da categoria informada
    (comparação sem acento/case), retornando a PRIMEIRA que encontrar
    seguindo a ordem da lista da taxonomia. Retorna None se nada bater.
    """
    if not free_text:
        return None

    import unicodedata

    def _norm(s: str) -> str:
        s = s.lower()
        s = unicodedata.normalize("NFKD", s)
        s = "".join(c for c in s if not unicodedata.combining(c))
        return s

    text_norm = _norm(free_text)
    options = TAXONOMY.get(category, [])

    for option in options:
        candidates = [option] + _EXTRA_KEYWORDS.get(option, [])
        for cand in candidates:
            if _norm(cand) in text_norm:
                return option

    return None
