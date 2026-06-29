-- Schema: Haras Monte Sião
-- Execute este arquivo no SQL Editor do Supabase ANTES do seed.sql

-- ─── Tabelas ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS animais (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome         TEXT NOT NULL,
  localizacao  TEXT,
  finalidade   TEXT,
  tipo         TEXT,
  comprador    TEXT,
  situacao     TEXT DEFAULT 'ATIVO',
  observacao   TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS fornecedores (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome        TEXT NOT NULL,
  nome_curto  TEXT,
  cnpj_cpf    TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS lancamentos (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  animal_id        UUID REFERENCES animais(id) ON DELETE SET NULL,
  fornecedor_id    UUID REFERENCES fornecedores(id) ON DELETE SET NULL,
  animal_nome      TEXT NOT NULL,
  fornecedor_nome  TEXT NOT NULL,
  documento        TEXT,
  historico        TEXT,
  situacao         TEXT NOT NULL,   -- PAGO | VENCIDO | A_VENCER | DISTRATOS | DESCONTOS
  valor            NUMERIC(15,2) DEFAULT 0,
  na_listagem      BOOLEAN DEFAULT FALSE,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Índices ────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_lancamentos_animal      ON lancamentos(animal_id);
CREATE INDEX IF NOT EXISTS idx_lancamentos_fornecedor  ON lancamentos(fornecedor_id);
CREATE INDEX IF NOT EXISTS idx_lancamentos_situacao    ON lancamentos(situacao);
CREATE INDEX IF NOT EXISTS idx_lancamentos_animal_nome ON lancamentos(animal_nome);
CREATE INDEX IF NOT EXISTS idx_animais_nome            ON animais(nome);

-- ─── Trigger: atualiza updated_at ──────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS animais_updated_at    ON animais;
DROP TRIGGER IF EXISTS lancamentos_updated_at ON lancamentos;

CREATE TRIGGER animais_updated_at
  BEFORE UPDATE ON animais
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER lancamentos_updated_at
  BEFORE UPDATE ON lancamentos
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── Row Level Security ─────────────────────────────────────────────────────
-- Para acesso público (sem autenticação). Se quiser adicionar login,
-- altere as policies para exigir auth.uid() IS NOT NULL.

ALTER TABLE animais     ENABLE ROW LEVEL SECURITY;
ALTER TABLE fornecedores ENABLE ROW LEVEL SECURITY;
ALTER TABLE lancamentos  ENABLE ROW LEVEL SECURITY;

-- Permite leitura e escrita para todos (protegido só pelas env vars)
CREATE POLICY "allow_all_animais"      ON animais      FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_fornecedores" ON fornecedores FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_lancamentos"  ON lancamentos  FOR ALL USING (true) WITH CHECK (true);

-- ─── Realtime ────────────────────────────────────────────────────────────────
-- Ativar realtime nas tabelas (requer que Realtime esteja habilitado no projeto)
-- Execute no SQL Editor após criar as tabelas:
-- ALTER PUBLICATION supabase_realtime ADD TABLE animais, fornecedores, lancamentos;
