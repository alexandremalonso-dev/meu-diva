from ai_fix import corrigir_codigo

# arquivo que você quer corrigir
arquivo = "teste.py"

with open(arquivo, "r", encoding="utf-8") as f:
    codigo_original = f.read()

codigo_corrigido = corrigir_codigo(codigo_original)

# sobrescreve o arquivo automaticamente
with open(arquivo, "w", encoding="utf-8") as f:
    f.write(codigo_corrigido)

print("✅ Código corrigido e substituído com sucesso.")