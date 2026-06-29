# 🐴 Haras Monte Sião — Sistema de Gestão

App web completo para gestão financeira e inventário de animais.
Deploy no Vercel + banco de dados Supabase com sincronização em tempo real.

## Como subir no Vercel (passo a passo)

### 1. Criar conta no Supabase
1. Acesse [supabase.com](https://supabase.com) → **Start your project** (grátis)
2. Crie um novo projeto (anote o **Project URL** e a **anon public key**)
3. No painel do projeto, vá em **SQL Editor**

### 2. Criar o banco de dados
1. No SQL Editor, cole o conteúdo de `supabase/schema.sql` e clique em **Run**
2. Depois cole o conteúdo de `supabase/seed.sql` e clique em **Run**
   - Isso importa todos os 115 animais, 105 fornecedores e 382 lançamentos reais
3. Ative o Realtime: no SQL Editor execute:
   ```sql
   ALTER PUBLICATION supabase_realtime ADD TABLE animais, fornecedores, lancamentos;
   ```

### 3. Subir para o GitHub
```bash
# Na pasta do projeto:
git init
git add .
git commit -m "feat: haras monte siao inicial"
# Crie um repo no GitHub e faça push
git remote add origin https://github.com/SEU-USUARIO/haras-monte-siao.git
git push -u origin main
```

### 4. Deploy no Vercel
1. Acesse [vercel.com](https://vercel.com) → **Add New Project**
2. Importe o repositório do GitHub
3. Em **Environment Variables**, adicione:
   - `NEXT_PUBLIC_SUPABASE_URL` → URL do seu projeto Supabase
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` → Anon key do Supabase
4. Clique em **Deploy**

Pronto! O app estará disponível em `https://seu-projeto.vercel.app`

---

## Funcionalidades

| Aba | O que faz |
|-----|-----------|
| **Dashboard** | KPIs em tempo real: total, pago, vencido, a vencer, distratos, descontos. Top 10 animais |
| **Animais** | Lista completa com localização. Criar, editar, excluir. Busca instantânea |
| **Financeiro** | Todos os lançamentos com filtro por situação. Criar, editar, excluir |
| **Fornecedores** | Lista de fornecedores com totais. Criar, editar, excluir |
| **Auditoria** | Visão consolidada por animal → fornecedor → lançamentos. Expansível |

## Dados carregados
- **115 animais** da listagem (BASE + ATUALIZADO 2)
- **105 fornecedores** do histórico de transações
- **382 lançamentos** financeiros auditados linha por linha

## Sincronização em tempo real
Qualquer mudança feita em uma aba do navegador aparece automaticamente
em todas as outras abas abertas — sem precisar recarregar a página.

## Desenvolvimento local
```bash
npm install
cp .env.local.example .env.local
# Preencha as variáveis no .env.local
npm run dev
```
