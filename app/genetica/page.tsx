'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { brl, sitLabel, sitColor } from '@/lib/format'
import { Plus, Search, Pencil, Trash2, X, Check } from 'lucide-react'

interface Lanc {
  id: string; animal_nome: string; fornecedor_nome: string
  historico: string | null; situacao: string; valor: number
}
interface Opt { id: string; nome: string }

const SITS = ['PAGO', 'VENCIDO', 'A_VENCER', 'DISTRATOS', 'DESCONTOS']
const empty = () => ({ animal_nome: '', fornecedor_nome: '', historico: '', situacao: 'A_VENCER', valor: '' })

export default function GeneticaPage() {
  const supabase = createClient()
  const [lancamentos, setLancamentos] = useState<Lanc[]>([])
  const [animaisList, setAnimaisList] = useState<Opt[]>([])
  const [fornecsList, setFornecsList] = useState<Opt[]>([])
  const [search, setSearch] = useState('')
  const [filtroSit, setFiltroSit] = useState('TODOS')
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<Record<string, string>>(empty())
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    const [{ data: l }, { data: a }, { data: f }] = await Promise.all([
      supabase.from('lancamentos').select('id, animal_nome, fornecedor_nome, historico, situacao, valor').eq('tipo', 'Genetica').order('animal_nome'),
      supabase.from('animais').select('id, nome').order('nome'),
      supabase.from('fornecedores').select('id, nome, nome_curto').order('nome_curto'),
    ])
    if (l) setLancamentos(l)
    if (a) setAnimaisList(a as Opt[])
    if (f) setFornecsList((f as { id: string; nome: string; nome_curto: string | null }[]).map(x => ({ id: x.id, nome: x.nome_curto ?? x.nome })))
    setLoading(false)
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

  const porSituacao = SITS.map(sit => ({
    sit, valor: lancamentos.filter(l => l.situacao === sit).reduce((s, l) => s + Number(l.valor), 0)
  }))

  function openNew() { setEditingId(null); setForm(empty()); setShowForm(true); setError('') }
  function openEdit(l: Lanc) {
    setEditingId(l.id)
    setForm({ animal_nome: l.animal_nome, fornecedor_nome: l.fornecedor_nome, historico: l.historico ?? '', situacao: l.situacao, valor: String(l.valor) })
    setShowForm(true); setError('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function save() {
    setSaving(true); setError('')
    if (!form.animal_nome.trim()) { setError('Animal/garanhão obrigatório'); setSaving(false); return }
    if (!form.fornecedor_nome.trim()) { setError('Fornecedor obrigatório'); setSaving(false); return }
    const animal = animaisList.find(a => a.nome.toLowerCase() === form.animal_nome.toLowerCase())
    const fornec  = fornecsList.find(f => f.nome.toLowerCase() === form.fornecedor_nome.toLowerCase())
    const payload = {
      animal_nome: form.animal_nome, fornecedor_nome: form.fornecedor_nome,
      animal_id: animal?.id ?? null, fornecedor_id: fornec?.id ?? null,
      historico: form.historico || null, situacao: form.situacao,
      valor: parseFloat(form.valor) || 0, tipo: 'Genetica', na_listagem: false,
    }
    const { error: e } = editingId
      ? await supabase.from('lancamentos').update(payload).eq('id', editingId)
      : await supabase.from('lancamentos').insert([payload])
    if (e) { setError(e.message); setSaving(false); return }
    setSaving(false); setShowForm(false); setEditingId(null); setForm(empty())
  }

  async function remove(id: string) {
    if (!confirm('Excluir este lançamento de genética?')) return
    await supabase.from('lancamentos').delete().eq('id', id)
  }

  const set = (key: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [key]: e.target.value }))

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">🧬 Genética</h1>
          <p className="text-sm text-gray-500">{lancamentos.length} lançamentos · {brl(totalGeral)} total</p>
        </div>
        <button className="btn-primary" onClick={openNew}><Plus size={16} /> Novo Lançamento</button>
      </div>

      {/* Formulário */}
      {showForm && (
        <div className="card p-6 border-2 border-purple-200">
          <h2 className="font-semibold text-lg text-[#1F3864] mb-4">{editingId ? 'Editar Lançamento de Genética' : 'Novo Lançamento de Genética'}</h2>
          {error && <p className="text-red-600 text-sm mb-3 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="label">Animal / Garanhão *</label>
              <input className="input" list="al" value={form.animal_nome} onChange={set('animal_nome')} placeholder="Nome do animal ou garanhão" />
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
            <div className="lg:col-span-2">
              <label className="label">Histórico (cobertura, lote, leilão...)</label>
              <input className="input" value={form.historico} onChange={set('historico')} placeholder="Ex: COBERTURA CH TIME TO SHINE - LOTE 100C" />
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

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {porSituacao.map(({ sit, valor }) => (
          <div key={sit} className="card p-4">
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${sitColor(sit)}`}>{sitLabel(sit)}</span>
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
          {SITS.map(s => <option key={s} value={s}>{sitLabel(s)}</option>)}
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
                <th className="th">Animal / Garanhão</th>
                <th className="th">Fornecedor</th>
                <th className="th">Histórico</th>
                <th className="th">Situação</th>
                <th className="th text-right">Valor</th>
                <th className="th w-20">Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="td text-center text-gray-400 py-12">Carregando...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={6} className="td text-center text-gray-400 py-12">Nenhum registro encontrado</td></tr>
              ) : filtered.map(l => (
                <tr key={l.id} className="hover:bg-purple-50/30 transition-colors group">
                  <td className="td font-semibold text-[#1F3864] text-sm max-w-[160px] truncate">{l.animal_nome}</td>
                  <td className="td text-gray-600 text-xs max-w-[200px] truncate" title={l.fornecedor_nome}>{l.fornecedor_nome}</td>
                  <td className="td text-gray-500 text-xs max-w-[250px] truncate" title={l.historico ?? ''}>{l.historico ?? '—'}</td>
                  <td className="td">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${sitColor(l.situacao)}`}>
                      {sitLabel(l.situacao)}
                    </span>
                  </td>
                  <td className="td text-right font-bold text-[#1F3864]">{brl(Number(l.valor))}</td>
                  <td className="td">
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button className="p-1.5 rounded hover:bg-blue-100 text-blue-600" onClick={() => openEdit(l)} title="Editar"><Pencil size={13} /></button>
                      <button className="p-1.5 rounded hover:bg-red-100 text-red-600" onClick={() => remove(l.id)} title="Excluir"><Trash2 size={13} /></button>
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
