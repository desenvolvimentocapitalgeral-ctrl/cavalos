export type Situacao = 'PAGO' | 'VENCIDO' | 'A_VENCER' | 'DISTRATOS' | 'DESCONTOS'
export type SituacaoAnimal = 'ATIVO' | 'NEGOCIAR' | 'CANCELADA' | 'VENDIDA' | 'DEVOLVIDA'

export interface Animal {
  id: string
  nome: string
  localizacao: string | null
  finalidade: string | null
  tipo: string | null
  comprador: string | null
  situacao: SituacaoAnimal
  observacao: string | null
  created_at: string
  updated_at: string
}

export interface Fornecedor {
  id: string
  nome: string
  nome_curto: string | null
  cnpj_cpf: string | null
  created_at: string
}

export interface Lancamento {
  id: string
  animal_id: string | null
  fornecedor_id: string | null
  animal_nome: string
  fornecedor_nome: string
  documento: string | null
  historico: string | null
  situacao: Situacao
  valor: number
  na_listagem: boolean
  created_at: string
  updated_at: string
  animais?: Animal
  fornecedores?: Fornecedor
}

export interface ResumoAnimal {
  animal_nome: string
  animal_id: string | null
  localizacao: string | null
  pago: number
  vencido: number
  a_vencer: number
  distratos: number
  descontos: number
  total: number
  na_listagem: boolean
  fornecedores: string[]
}

export interface ResumoFornecedor {
  fornecedor_nome: string
  fornecedor_id: string | null
  pago: number
  vencido: number
  a_vencer: number
  distratos: number
  descontos: number
  total: number
  qtd_animais: number
}

export type Database = {
  public: {
    Tables: {
      animais: {
        Row: Animal
        Insert: Omit<Animal, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Animal, 'id' | 'created_at' | 'updated_at'>>
      }
      fornecedores: {
        Row: Fornecedor
        Insert: Omit<Fornecedor, 'id' | 'created_at'>
        Update: Partial<Omit<Fornecedor, 'id' | 'created_at'>>
      }
      lancamentos: {
        Row: Lancamento
        Insert: Omit<Lancamento, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Lancamento, 'id' | 'created_at' | 'updated_at'>>
      }
    }
  }
}
