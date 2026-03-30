-- ============================================
-- MIGRAÇÃO: Adicionar coluna foto_url à tabela patient_profiles
-- ============================================

-- Verificar se a coluna já existe antes de adicionar
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'patient_profiles' 
        AND column_name = 'foto_url'
    ) THEN
        ALTER TABLE patient_profiles 
        ADD COLUMN foto_url VARCHAR(500);
        
        RAISE NOTICE 'Coluna foto_url adicionada com sucesso';
    ELSE
        RAISE NOTICE 'Coluna foto_url já existe';
    END IF;
END $$;

-- Verificar a estrutura atualizada
SELECT 
    column_name, 
    data_type, 
    is_nullable
FROM information_schema.columns
WHERE table_name = 'patient_profiles'
ORDER BY ordinal_position;