'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { brl } from '@/lib/format'
import { Search } from 'lucide-react'

interface Lancamento {
  id: string; animal_nome: string; fornecedor_nome: string
  historico: string | null; situacao: string; valor: number
}

const SIT_COLORS: Record<string, string> = {
  PAGO:      'bg-green-100 text-green-800',
  VENCIDO:   'bg-red-100 text-red-800',
  A_VENCER:  'bg-blue-100 text-blue-800',
  DISTRATOS: 'bg-orange-100 text-orange-800',
  DESCONTOS: 'bg-purple-100 text-purple-800',
}
const SIT_LABEL: Record<string, string> = {
  PAGO: 'Pago', VENCIDO: 'Vencido', A_VENCER: 'A Vencer', DISTRATOS: 'Distratos', DESCONTOS: 'Descontos'
}

export default function GeneticaPage() {
  const supabase = createClient()
  const [lancamentos, setLancamentos] = useState<Lancamento[]>([])
  const [search, setSearch] = useState('')
  const [filtroSit, setFiltroSit] = useState('TODOS')
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('lancamentos')
      .select('id, animal_nome, fornecedor_nome, historico, situacao, valor')
      .eq('tipo', 'Genetica')
      .order('animal_nome')
    if (data) { setLancamentos(data); setLoading(false) }
  }, [supabase])

  useEffect(() => {
    load()
    const ch = supabase.channel('genetica-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lancamentos' }, load)
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [load, supabase])

  const filtered = lancamentos.filter(l => {
    const q = search.toLowerCase()
    const matchSearch = !q || l.animal_nome.toLowerCase().includes(q) || l.fornecedor_nome.toLowerCase().includes(q) || (l.historico ?? '').toLowerCase().includes(q)
    const matchSit = filtroSit === 'TODOS' || l.situacao === filtroSit
    return matchSearch && matchSit
  })

  const totalGeral = lancamentos.reduce((s, l) => s + Number(l.valor), 0)
  const totalFiltrado = filtered.reduce((s, l) => s + Number(l.valor), 0)

  const porSituacao = ['PAGO', 'VENCIDO', 'A_VENCER', 'DISTRATOS', 'DESCONTOS'].map(sit => ({
    sit, valor: lancamentos.filter(l => l.situacao === sit).reduce((s, l) => s + Number(l.valor), 0)
  }))

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">🧬 Genética</h1>
          <p className="text-sm text-gray-500">{lancamentos.length} lançamentos · {brl(totalGeral)} total</p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {porSituacao.map(({ sit, valor }) => (
          <div key={sit} className="card p-4">
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${SIT_COLORS[sit]}`}>{SIT_LABEL[sit]}</span>
            <p className="font-bold text-[#1F3864] mt-2">{brl(valor)}</p>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input className="input pl-9" placeholder="Buscar por animal, fornecedor, histórico..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="input w-auto" value={filtroSit} onChange={e => setFiltroSit(e.target.value)}>
          <option value="TODOS">Todas as situações</option>
          {Object.entries(SIT_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>

      {filtered.length < lancamentos.length && (
        <p className="text-sm text-gray-500">
          Exibindo {filtered.length} de {lancamentos.length} · Total filtrado: <strong>{brl(totalFiltrado)}</strong>
        </p>
      )}

      {/* Tabela */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="th">Animal</th>
                <th className="th">Fornecedor / Garanhão</th>
                <th className="th">Histórico</th>
                <th className="th">Situação</th>
                <th className="th text-right">Valor</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="td text-center text-gray-400 py-12">Carregando...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={5} className="td text-center text-gray-400 py-12">Nenhum registro encontrado</td></tr>
              ) : filtered.map(l => (
                <tr key={l.id} className="hover:bg-purple-50/30 transition-colors">
                  <td className="td font-semibold text-[#1F3864] text-sm">{l.animal_nome}</td>
                  <td className="td text-gray-600 text-xs max-w-[200px] truncate" title={l.fornecedor_nome}>{l.fornecedor_nome}</td>
                  <td className="td text-gray-500 text-xs max-w-[250px] truncate" title={l.historico ?? ''}>{l.historico ?? '—'}</td>
                  <td className="td">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${SIT_COLORS[l.situacao] ?? ''}`}>
                      {SIT_LABEL[l.situacao] ?? l.situacao}
                    </span>
                  </td>
                  <td className="td text-right font-bold text-[#1F3864]">{brl(Number(l.valor))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
