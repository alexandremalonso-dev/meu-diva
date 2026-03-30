-- ============================================
-- VERIFICACAO COMPLETA DA MIGRACAO
-- ============================================

-- 1. Estrutura da tabela
SELECT '=== ESTRUTURA DA TABELA ===' as info;
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'patient_profiles'
ORDER BY ordinal_position;

-- 2. Quantidade de registros
SELECT '=== ESTATISTICAS ===' as info;
SELECT 'Total de pacientes em users:' as descricao, COUNT(*) as valor
FROM users WHERE role = 'patient'
UNION ALL
SELECT 'Total de perfis criados:', COUNT(*)
FROM patient_profiles
UNION ALL
SELECT 'Pacientes sem perfil:', COUNT(*)
FROM users u
WHERE u.role = 'patient'
AND NOT EXISTS (SELECT 1 FROM patient_profiles pp WHERE pp.user_id = u.id);

-- 3. Amostra dos dados (primeiros 10)
SELECT '=== AMOSTRA DOS DADOS ===' as info;
SELECT 
    u.id as user_id,
    u.email,
    u.full_name as user_name,
    pp.full_name as profile_name,
    pp.phone,
    pp.foto_url,
    pp.timezone
FROM users u
LEFT JOIN patient_profiles pp ON u.id = pp.user_id
WHERE u.role = 'patient'
ORDER BY u.id
LIMIT 10;