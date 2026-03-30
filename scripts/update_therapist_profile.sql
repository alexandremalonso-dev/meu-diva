-- ===========================================
-- ATUALIZAÇÃO DA TABELA therapist_profiles
-- ===========================================

-- 1. Adicionar campo professional_registration (Registro Profissional)
ALTER TABLE therapist_profiles ADD COLUMN IF NOT EXISTS professional_registration VARCHAR(100);

-- 2. Adicionar campo treatment (Tratamento: Dr., Dra., Sr., Sra.)
ALTER TABLE therapist_profiles ADD COLUMN IF NOT EXISTS treatment VARCHAR(10);

-- 3. Adicionar campo lgbtqia_belonging (Pertencente à comunidade)
ALTER TABLE therapist_profiles ADD COLUMN IF NOT EXISTS lgbtqia_belonging BOOLEAN DEFAULT FALSE;

-- 4. Garantir que lgbtqia_ally existe (já existe, mas garantir)
ALTER TABLE therapist_profiles ALTER COLUMN lgbtqia_ally SET DEFAULT FALSE;

-- 5. Atualizar dados existentes (se houver)
-- Se o campo antigo lgbtqia_ally era usado para ambos, podemos migrar
-- UPDATE therapist_profiles SET lgbtqia_belonging = lgbtqia_ally WHERE lgbtqia_ally = TRUE;

-- 6. Verificar as alterações
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'therapist_profiles' 
ORDER BY ordinal_position;