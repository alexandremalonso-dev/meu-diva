-- ============================================
-- MIGRAÇÃO: Popular patient_profiles a partir dos users existentes
-- ============================================

-- Inserir perfis para todos os pacientes que ainda não têm
-- NOTA: foto_url foi removida desta inserção (será adicionada depois via upload)
INSERT INTO patient_profiles (
    user_id,
    full_name,
    email,
    phone,
    timezone,
    preferred_language,
    created_at,
    updated_at
)
SELECT
    u.id AS user_id,
    COALESCE(u.full_name, split_part(u.email, '@', 1)) AS full_name,
    u.email,
    NULL AS phone,
    'America/Sao_Paulo' AS timezone,
    'pt-BR' AS preferred_language,
    NOW() AS created_at,
    NOW() AS updated_at
FROM users u
WHERE u.role = 'patient'
AND NOT EXISTS (
    SELECT 1 FROM patient_profiles pp WHERE pp.user_id = u.id
);

-- Mostrar resultado
SELECT 
    'Perfis criados: ' || COUNT(*) || ' pacientes' as resultado
FROM patient_profiles;