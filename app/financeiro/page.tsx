'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { brl, sitLabel } from '@/lib/format'
import { exportToExcel } from '@/lib/export'
import { Plus, Search, Pencil, Trash2, X, Check, Download } from 'lucide-react'

interface Lanc {
  id: string; animal_nome: string; fornecedor_nome: string; documento: string | null
  historico: string | null; situacao: string; valor: number; na_listagem: boolean
}
interface Opt { id: string; nome: string }
interface CellEntry { id: string; valor: number }
interface PivotRow {
  key: string; animal_nome: string; fornecedor_nome: string; documento: string
  historico: string; na_listagem: boolean
  cells: Record<string, CellEntry[]>
  total: number
}

const SITS = ['PAGO', 'VENCIDO', 'A_VENCER', 'DISTRATOS', 'DESCONTOS']
const empty = () => ({ animal_nome: '', fornecedor_nome: '', documento: '', historico: '', situacao: 'A_VENCER', valor: '' })

export default function FinanceiroPage() {
  const supabase = createClient()
  const [lancs, setLancs] = useState<Lanc[]>([])
  const [animaisList, setAnimaisList] = useState<Opt[]>([])
  const [fornecsList, setFornecsList] = useState<Opt[]>([])
  const [search, setSearch] = useState('')
  const [filterLista, setFilterLista] = useState('ALL')
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<Record<string, string>>(empty())
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    const [{ data: l }, { data: a }, { data: f }] = await Promise.all([
      supabase.from('lancamentos').select('*').order('animal_nome'),
      supabase.from('animais').select('id, nome').order('nome'),
      supabase.from('fornecedores').select('id, nome, nome_curto').order('nome_curto'),
    ])
    if (l) setLancs(l)
    if (a) setAnimaisList(a as Opt[])
    if (f) setFornecsList((f as { id: string; nome: string; nome_curto: string | null }[]).map(x => ({ id: x.id, nome: x.nome_curto ?? x.nome })))
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    load()
    const ch = supabase.channel('fin-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lancamentos' }, load)
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [load, supabase])

  const filteredLancs = lancs.filter(l => {
    const q = search.toLowerCase()
    const mQ = !q || l.animal_nome.toLowerCase().includes(q) || l.fornecedor_nome.toLowerCase().includes(q) || (l.documento ?? '').toLowerCase().includes(q)
    const mL = filterLista === 'ALL' || (filterLista === 'SIM' ? l.na_listagem : !l.na_listagem)
    return mQ && mL
  })

  // Pivota: agrupa por animal+fornecedor+documento, situação vira coluna
  const pivot = useMemo(() => {
    const map: Record<string, PivotRow> = {}
    for (const l of filteredLancs) {
      const key = `${l.animal_nome}|${l.fornecedor_nome}|${l.documento ?? ''}`
      if (!map[key]) {
        map[key] = {
          key, animal_nome: l.animal_nome, fornecedor_nome: l.fornecedor_nome,
          documento: l.documento ?? '', historico: l.historico ?? '', na_listagem: l.na_listagem,
          cells: {}, total: 0,
        }
      }
      const row = map[key]
      if (!row.cells[l.situacao]) row.cells[l.situacao] = []
      row.cells[l.situacao].push({ id: l.id, valor: Number(l.valor) || 0 })
      row.total += Number(l.valor) || 0
    }
    return Object.values(map).sort((a, b) => b.total - a.total)
  }, [filteredLancs])

  const totals = filteredLancs.reduce((t, l) => ({ ...t, [l.situacao]: (t[l.situacao] ?? 0) + Number(l.valor) }), {} as Record<string, number>)

  function openNew() { setEditingId(null); setForm(empty()); setShowForm(true); setError('') }
  function openEditLanc(l: Lanc) {
    setEditingId(l.id)
    setForm({ animal_nome: l.animal_nome, fornecedor_nome: l.fornecedor_nome, documento: l.documento ?? '', historico: l.historico ?? '', situacao: l.situacao, valor: String(l.valor) })
    setShowForm(true); setError('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  function openEditCell(row: PivotRow, situacao: string) {
    const entry = row.cells[situacao]?.[0]
    if (!entry) return
    const original = lancs.find(l => l.id === entry.id)
    if (original) openEditLanc(original)
  }

  async function save() {
    setSaving(true); setError('')
    if (!form.animal_nome.trim()) { setError('Nome do animal obrigatório'); setSaving(false); return }
    if (!form.fornecedor_nome.trim()) { setError('Fornecedor obrigatório'); setSaving(false); return }
    const animal = animaisList.find(a => a.nome.toLowerCase() === form.animal_nome.toLowerCase())
    const fornec  = fornecsList.find(f => f.nome.toLowerCase() === form.fornecedor_nome.toLowerCase())
    const payload = {
      animal_nome: form.animal_nome, fornecedor_nome: form.fornecedor_nome,
      animal_id: animal?.id ?? null, fornecedor_id: fornec?.id ?? null,
      documento: form.documento || null, historico: form.historico || null,
      situacao: form.situacao, valor: parseFloat(form.valor) || 0,
      na_listagem: !!animal,
    }
    const { error: e } = editingId
      ? await supabase.from('lancamentos').update(payload).eq('id', editingId)
      : await supabase.from('lancamentos').insert([payload])
    if (e) { setError(e.message); setSaving(false); return }
    setSaving(false); setShowForm(false); setEditingId(null); setForm(empty())
  }

  async function removeCell(row: PivotRow, situacao: string) {
    const ids = row.cells[situacao]?.map(c => c.id) ?? []
    if (ids.length === 0) return
    if (!confirm(`Excluir ${ids.length > 1 ? 'estes lançamentos' : 'este lançamento'} (${sitLabel(situacao)})?`)) return
    await supabase.from('lancamentos').delete().in('id', ids)
  }

  const set = (key: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [key]: e.target.value }))

  function handleExport() {
    exportToExcel(pivot.map(r => ({
      Animal: r.animal_nome, Fornecedor: r.fornecedor_nome.replace(/\s*-?\s*(CNPJ|CPF):.+/i, '').trim(),
      Documento: r.documento, Histórico: r.historico,
      Pago: r.cells.PAGO?.reduce((s, c) => s + c.valor, 0) ?? 0,
      Vencido: r.cells.VENCIDO?.reduce((s, c) => s + c.valor, 0) ?? 0,
      'A Vencer': r.cells.A_VENCER?.reduce((s, c) => s + c.valor, 0) ?? 0,
      Distratos: r.cells.DISTRATOS?.reduce((s, c) => s + c.valor, 0) ?? 0,
      Descontos: r.cells.DESCONTOS?.reduce((s, c) => s + c.valor, 0) ?? 0,
      Total: r.total, 'Na Listagem': r.na_listagem ? 'Sim' : 'Não',
    })), 'financeiro')
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Financeiro</h1>
          <p className="text-sm text-gray-500">{lancs.length} lançamentos · {pivot.length} registros agrupados</p>
        </div>
        <div className="flex gap-2">
          <button className="btn-secondary" onClick={handleExport} disabled={pivot.length === 0}><Download size={16} /> Exportar Excel</button>
          <button className="btn-primary" onClick={openNew}><Plus size={16} /> Novo Lançamento</button>
        </div>
      </div>

      {/* Formulário */}
      {showForm && (
        <div className="card p-6 border-2 border-[#BDD7EE]">
          <h2 className="font-semibold text-lg text-[#1F3864] mb-4">{editingId ? 'Editar Lançamento' : 'Novo Lançamento'}</h2>
          {error && <p className="text-red-600 text-sm mb-3 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="label">Animal *</label>
              <input className="input" list="al" value={form.animal_nome} onChange={set('animal_nome')} placeholder="Nome do animal" />
              <datalist id="al">{animaisList.map(a => <option key={a.id} value={a.nome} />)}</datalist>
            </div>
            <div>
              <label className="label">Fornecedor *</label>
              <input className="input" list="fl" value={form.fornecedor_nome} onChange={set('fornecedor_nome')} placeholder="Nome do fornecedor" />
              <datalist id="fl">{fornecsList.map(f => <option key={f.id} value={f.nome} />)}</datalist>
            </div>
            <div>
              <label className="label">Situação</label>
              <select className="input" value={form.situacao} onChange={set('situacao')}>
                {SITS.map(s => <option key={s} value={s}>{sitLabel(s)}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Valor (R$)</label>
              <input className="input" type="number" min={0} step={0.01} value={form.valor} onChange={set('valor')} />
            </div>
            <div>
              <label className="label">Documento / Ref.</label>
              <input className="input" value={form.documento} onChange={set('documento')} />
            </div>
            <div>
              <label className="label">Histórico</label>
              <input className="input" value={form.historico} onChange={set('historico')} />
            </div>
          </div>
          <div className="flex gap-3 mt-5">
            <button className="btn-primary" onClick={save} disabled={saving}>
              <Check size={16} /> {saving ? 'Salvando...' : 'Salvar'}
            </button>
            <button className="btn-secondary" onClick={() => { setShowForm(false); setEditingId(null) }}>
              <X size={16} /> Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="relative md:col-span-2">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input className="input pl-9" placeholder="Buscar animal, fornecedor..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="input" value={filterLista} onChange={e => setFilterLista(e.target.value)}>
          <option value="ALL">Todos</option>
          <option value="SIM">Na listagem</option>
          <option value="NAO">Fora da listagem</option>
        </select>
      </div>

      {/* Totais do filtro */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {SITS.map(s => (
          <div key={s} className="card p-3 text-center">
            <p className="text-xs text-gray-500 mb-1">{sitLabel(s)}</p>
            <p className={`font-bold text-sm ${s === 'VENCIDO' ? 'text-red-700' : 'text-[#1F3864]'}`}>
              {brl(totals[s] ?? 0)}
            </p>
          </div>
        ))}
      </div>

      {/* Tabela pivotada: situação em colunas */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="th py-2">Animal</th>
                <th className="th py-2">Fornecedor</th>
                <th className="th py-2 text-right">Pago</th>
                <th className="th py-2 text-right">Vencido</th>
                <th className="th py-2 text-right">A Vencer</th>
                <th className="th py-2 text-right">Distratos</th>
                <th className="th py-2 text-right">Descontos</th>
                <th className="th py-2 text-right">Total</th>
                <th className="th py-2 w-14">Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} className="td text-center text-gray-400 py-12">Carregando...</td></tr>
              ) : pivot.length === 0 ? (
                <tr><td colSpan={9} className="td text-center text-gray-400 py-12">Nenhum lançamento encontrado</td></tr>
              ) : pivot.map(row => (
                <tr key={row.key} className={`hover:bg-blue-50/40 transition-colors group ${!row.na_listagem ? 'bg-orange-50/20' : ''}`}>
                  <td className="td py-1.5 font-semibold text-[#1F3864] max-w-[140px] truncate" title={row.animal_nome}>{row.animal_nome}</td>
                  <td className="td py-1.5 text-gray-600 max-w-[150px] truncate" title={row.fornecedor_nome}>
                    {row.fornecedor_nome.replace(/\s*-?\s*(CNPJ|CPF):.+/i, '').trim()}
                  </td>
                  {SITS.map(sit => {
                    const v = row.cells[sit]?.reduce((s, c) => s + c.valor, 0) ?? 0
                    return (
                      <td key={sit} className="td py-1.5 text-right">
                        {v > 0 ? (
                          <div className="flex items-center justify-end gap-1">
                            <span className={`font-medium tabular-nums ${sit === 'VENCIDO' ? 'text-red-700' : 'text-gray-700'}`}>{brl(v)}</span>
                            <span className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-0.5">
                              <button className="p-0.5 rounded hover:bg-blue-100 text-blue-600" onClick={() => openEditCell(row, sit)} title="Editar">
                                <Pencil size={10} />
                              </button>
                              <button className="p-0.5 rounded hover:bg-red-100 text-red-600" onClick={() => removeCell(row, sit)} title="Excluir">
                                <Trash2 size={10} />
                              </button>
                            </span>
                          </div>
                        ) : <span className="text-gray-300">—</span>}
                      </td>
                    )
                  })}
                  <td className="td py-1.5 text-right font-bold text-[#1F3864] tabular-nums">{brl(row.total)}</td>
                  <td className="td py-1.5">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${row.na_listagem ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                      {row.na_listagem ? '✓' : '?'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
