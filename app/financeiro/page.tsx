'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { brl, sitLabel, sitColor } from '@/lib/format'
import { Plus, Search, Pencil, Trash2, X, Check } from 'lucide-react'

interface Lanc {
  id: string; animal_nome: string; fornecedor_nome: string; documento: string | null
  historico: string | null; situacao: string; valor: number; na_listagem: boolean
}
interface Opt { id: string; nome: string }

const SITS = ['PAGO', 'VENCIDO', 'A_VENCER', 'DISTRATOS', 'DESCONTOS']
const empty = () => ({ animal_nome: '', fornecedor_nome: '', documento: '', historico: '', situacao: 'A_VENCER', valor: '' })

export default function FinanceiroPage() {
  const supabase = createClient()
  const [lancs, setLancs] = useState<Lanc[]>([])
  const [animaisList, setAnimaisList] = useState<Opt[]>([])
  const [fornecsList, setFornecsList] = useState<Opt[]>([])
  const [search, setSearch] = useState('')
  const [filterSit, setFilterSit] = useState('ALL')
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

  const filtered = lancs.filter(l => {
    const q = search.toLowerCase()
    const mQ = !q || l.animal_nome.toLowerCase().includes(q) || l.fornecedor_nome.toLowerCase().includes(q) || (l.documento ?? '').toLowerCase().includes(q)
    const mS = filterSit === 'ALL' || l.situacao === filterSit
    const mL = filterLista === 'ALL' || (filterLista === 'SIM' ? l.na_listagem : !l.na_listagem)
    return mQ && mS && mL
  })

  const totals = filtered.reduce((t, l) => ({ ...t, [l.situacao]: (t[l.situacao] ?? 0) + Number(l.valor) }), {} as Record<string, number>)

  function openNew() { setEditingId(null); setForm(empty()); setShowForm(true); setError('') }
  function openEdit(l: Lanc) {
    setEditingId(l.id)
    setForm({ animal_nome: l.animal_nome, fornecedor_nome: l.fornecedor_nome, documento: l.documento ?? '', historico: l.historico ?? '', situacao: l.situacao, valor: String(l.valor) })
    setShowForm(true); setError('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
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

  async function remove(id: string) {
    if (!confirm('Excluir este lançamento?')) return
    await supabase.from('lancamentos').delete().eq('id', id)
  }

  const set = (key: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [key]: e.target.value }))

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Financeiro</h1>
          <p className="text-sm text-gray-500">{lancs.length} lançamentos · {filtered.length} exibidos</p>
        </div>
        <button className="btn-primary" onClick={openNew}><Plus size={16} /> Novo Lançamento</button>
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
        <div className="relative md:col-span-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input className="input pl-9" placeholder="Buscar animal, fornecedor..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="input" value={filterSit} onChange={e => setFilterSit(e.target.value)}>
          <option value="ALL">Todas as situações</option>
          {SITS.map(s => <option key={s} value={s}>{sitLabel(s)}</option>)}
        </select>
        <select className="input" value={filterLista} onChange={e => setFilterLista(e.target.value)}>
          <option value="ALL">Todos</option>
          <option value="SIM">Na listagem</option>
          <option value="NAO">Fora da listagem</option>
        </select>
      </div>

      {/* Totais do filtro */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {SITS.map(s => (
          <div key={s} className="card p-4 text-center">
            <p className="text-xs text-gray-500 mb-1">{sitLabel(s)}</p>
            <p className={`font-bold text-sm ${s === 'VENCIDO' ? 'text-red-700' : 'text-[#1F3864]'}`}>
              {brl(totals[s] ?? 0)}
            </p>
          </div>
        ))}
      </div>

      {/* Tabela */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="th">Animal</th>
                <th className="th">Fornecedor</th>
                <th className="th">Documento</th>
                <th className="th">Situação</th>
                <th className="th text-right">Valor</th>
                <th className="th">Status</th>
                <th className="th w-20">Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="td text-center text-gray-400 py-12">Carregando...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={7} className="td text-center text-gray-400 py-12">Nenhum lançamento encontrado</td></tr>
              ) : filtered.map(l => (
                <tr key={l.id} className={`hover:bg-blue-50/40 transition-colors group ${!l.na_listagem ? 'bg-orange-50/20' : ''}`}>
                  <td className="td font-semibold text-[#1F3864] max-w-[160px] truncate">{l.animal_nome}</td>
                  <td className="td text-gray-600 text-xs max-w-[180px] truncate">{l.fornecedor_nome.replace(/\s*-?\s*(CNPJ|CPF):.+/i, '').trim()}</td>
                  <td className="td text-xs font-mono text-gray-400">{l.documento ?? '—'}</td>
                  <td className="td">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${sitColor(l.situacao)}`}>
                      {sitLabel(l.situacao)}
                    </span>
                  </td>
                  <td className={`td text-right font-semibold tabular-nums ${l.situacao === 'VENCIDO' ? 'text-red-700' : 'text-gray-800'}`}>
                    {brl(l.valor)}
                  </td>
                  <td className="td">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${l.na_listagem ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                      {l.na_listagem ? '✓ Listagem' : '? Fora'}
                    </span>
                  </td>
                  <td className="td">
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button className="p-1.5 rounded hover:bg-blue-100 text-blue-600" onClick={() => openEdit(l)}><Pencil size={13} /></button>
                      <button className="p-1.5 rounded hover:bg-red-100 text-red-600" onClick={() => remove(l.id)}><Trash2 size={13} /></button>
                    </div>
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
