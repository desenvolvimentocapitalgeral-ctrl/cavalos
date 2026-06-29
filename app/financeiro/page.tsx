'use client'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { brl, sitLabel, sitColor } from '@/lib/format'
import { Plus, Search, Pencil, Trash2, X, Check, Filter } from 'lucide-react'
import type { Animal, Fornecedor, Lancamento, Situacao } from '@/lib/types'

const SITUACOES: Situacao[] = ['PAGO', 'VENCIDO', 'A_VENCER', 'DISTRATOS', 'DESCONTOS']

const emptyLanc = (): Partial<Lancamento> => ({
  animal_nome: '', fornecedor_nome: '', documento: '', historico: '',
  situacao: 'A_VENCER', valor: 0, na_listagem: true,
})

export default function FinanceiroPage() {
  const supabase = createClient()
  const [lancs, setLancs] = useState<Lancamento[]>([])
  const [animais, setAnimais] = useState<Animal[]>([])
  const [fornecs, setFornecs] = useState<Fornecedor[]>([])
  const [search, setSearch] = useState('')
  const [filterSit, setFilterSit] = useState<string>('ALL')
  const [filterLista, setFilterLista] = useState<string>('ALL')
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<string | null>(null)
  const [editData, setEditData] = useState<Partial<Lancamento>>(emptyLanc())
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    const [{ data: l }, { data: a }, { data: f }] = await Promise.all([
      supabase.from('lancamentos').select('*, animais(nome), fornecedores(nome_curto)').order('animal_nome'),
      supabase.from('animais').select('id, nome').order('nome'),
      supabase.from('fornecedores').select('id, nome, nome_curto').order('nome_curto'),
    ])
    if (l) setLancs(l)
    if (a) setAnimais(a as Animal[])
    if (f) setFornecs(f as Fornecedor[])
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    load()
    const ch = supabase.channel('financeiro-page')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lancamentos' }, load)
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [load, supabase])

  const filtered = lancs.filter(l => {
    const q = search.toLowerCase()
    const matchQ = !q || l.animal_nome.toLowerCase().includes(q) || l.fornecedor_nome.toLowerCase().includes(q) || (l.documento ?? '').toLowerCase().includes(q)
    const matchSit = filterSit === 'ALL' || l.situacao === filterSit
    const matchLista = filterLista === 'ALL' || (filterLista === 'SIM' ? l.na_listagem : !l.na_listagem)
    return matchQ && matchSit && matchLista
  })

  const totals = filtered.reduce((acc, l) => {
    acc[l.situacao] = (acc[l.situacao] ?? 0) + Number(l.valor)
    return acc
  }, {} as Record<string, number>)

  async function save() {
    setSaving(true); setError('')
    if (!editData.animal_nome?.trim()) { setError('Nome do animal obrigatório'); setSaving(false); return }
    if (!editData.fornecedor_nome?.trim()) { setError('Fornecedor obrigatório'); setSaving(false); return }

    // Tentar encontrar IDs
    const animal = animais.find(a => a.nome.toLowerCase() === editData.animal_nome?.toLowerCase())
    const fornec  = fornecs.find(f => f.nome.toLowerCase() === editData.fornecedor_nome?.toLowerCase() || f.nome_curto?.toLowerCase() === editData.fornecedor_nome?.toLowerCase())

    const payload = {
      ...editData,
      animal_id: animal?.id ?? null,
      fornecedor_id: fornec?.id ?? null,
      na_listagem: !!animal,
      valor: Number(editData.valor) || 0,
    }

    if (editing) {
      const { error: e } = await supabase.from('lancamentos').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', editing)
      if (e) setError(e.message)
    } else {
      const { error: e } = await supabase.from('lancamentos').insert([payload])
      if (e) setError(e.message)
    }
    setSaving(false)
    if (!error) { setShowForm(false); setEditing(null); setEditData(emptyLanc()) }
  }

  async function remove(id: string) {
    if (!confirm('Excluir este lançamento?')) return
    await supabase.from('lancamentos').delete().eq('id', id)
  }

  function startEdit(l: Lancamento) {
    setEditing(l.id); setEditData({ ...l }); setShowForm(true); setError('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Financeiro</h1>
          <p className="text-sm text-gray-500">{lancs.length} lançamentos &bull; {filtered.length} exibidos</p>
        </div>
        <button className="btn-primary" onClick={() => { setShowForm(true); setEditing(null); setEditData(emptyLanc()); setError('') }}>
          <Plus size={16} /> Novo Lançamento
        </button>
      </div>

      {/* Formulário */}
      {showForm && (
        <div className="card p-6 border-2 border-brand-200">
          <h2 className="font-semibold text-lg text-brand-800 mb-4">{editing ? 'Editar Lançamento' : 'Novo Lançamento'}</h2>
          {error && <p className="text-red-600 text-sm mb-3 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="label">Animal *</label>
              <input className="input" list="animais-list" value={editData.animal_nome ?? ''} onChange={e => setEditData(d => ({ ...d, animal_nome: e.target.value }))} placeholder="Nome do animal" />
              <datalist id="animais-list">{animais.map(a => <option key={a.id} value={a.nome} />)}</datalist>
            </div>
            <div>
              <label className="label">Fornecedor *</label>
              <input className="input" list="fornec-list" value={editData.fornecedor_nome ?? ''} onChange={e => setEditData(d => ({ ...d, fornecedor_nome: e.target.value }))} placeholder="Nome do fornecedor" />
              <datalist id="fornec-list">{fornecs.map(f => <option key={f.id} value={f.nome_curto ?? f.nome} />)}</datalist>
            </div>
            <div>
              <label className="label">Situação</label>
              <select className="input" value={editData.situacao ?? 'A_VENCER'} onChange={e => setEditData(d => ({ ...d, situacao: e.target.value as Situacao }))}>
                {SITUACOES.map(s => <option key={s} value={s}>{sitLabel(s)}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Valor (R$)</label>
              <input className="input" type="number" min={0} step={0.01} value={editData.valor ?? ''} onChange={e => setEditData(d => ({ ...d, valor: parseFloat(e.target.value) || 0 }))} />
            </div>
            <div>
              <label className="label">Documento / Ref.</label>
              <input className="input" value={editData.documento ?? ''} onChange={e => setEditData(d => ({ ...d, documento: e.target.value }))} />
            </div>
            <div className="md:col-span-2">
              <label className="label">Histórico</label>
              <input className="input" value={editData.historico ?? ''} onChange={e => setEditData(d => ({ ...d, historico: e.target.value }))} />
            </div>
          </div>
          <div className="flex gap-3 mt-5">
            <button className="btn-primary" onClick={save} disabled={saving}>
              <Check size={16} /> {saving ? 'Salvando...' : 'Salvar'}
            </button>
            <button className="btn-secondary" onClick={() => { setShowForm(false); setEditing(null); setEditData(emptyLanc()); setError('') }}>
              <X size={16} /> Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Filtros + resumo */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input className="input pl-9" placeholder="Buscar animal, fornecedor, documento..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="flex gap-3">
          <select className="input flex-1" value={filterSit} onChange={e => setFilterSit(e.target.value)}>
            <option value="ALL">Todas as situações</option>
            {SITUACOES.map(s => <option key={s} value={s}>{sitLabel(s)}</option>)}
          </select>
          <select className="input w-40" value={filterLista} onChange={e => setFilterLista(e.target.value)}>
            <option value="ALL">Todos</option>
            <option value="SIM">Na listagem</option>
            <option value="NAO">Fora da listagem</option>
          </select>
        </div>
      </div>

      {/* Cards de totais do filtro atual */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {SITUACOES.map(s => (
          <div key={s} className="card p-4 text-center">
            <p className="text-xs text-gray-500 mb-1">{sitLabel(s)}</p>
            <p className={`font-bold text-base ${s === 'VENCIDO' ? 'text-red-700' : 'text-brand-800'}`}>
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
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="th">Animal</th>
                <th className="th">Fornecedor</th>
                <th className="th">Documento</th>
                <th className="th">Situação</th>
                <th className="th text-right">Valor</th>
                <th className="th">Listagem</th>
                <th className="th text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="td text-center text-gray-400 py-12">Carregando...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={7} className="td text-center text-gray-400 py-12">Nenhum lançamento encontrado</td></tr>
              ) : filtered.map(l => (
                <tr key={l.id} className={`hover:bg-blue-50/30 transition-colors group ${!l.na_listagem ? 'bg-orange-50/30' : ''}`}>
                  <td className="td font-semibold text-brand-800 max-w-[180px] truncate" title={l.animal_nome}>{l.animal_nome}</td>
                  <td className="td text-gray-600 max-w-[200px] truncate" title={l.fornecedor_nome}>{l.fornecedor_nome.replace(/\s*-?\s*(CNPJ|CPF):.+/i, '').trim()}</td>
                  <td className="td text-xs text-gray-400 font-mono">{l.documento ?? '—'}</td>
                  <td className="td">
                    <span className={`text-xs font-medium px-2 py-1 rounded-full ${sitColor(l.situacao)}`}>
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
                    <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button className="p-1.5 rounded hover:bg-blue-100 text-blue-600" onClick={() => startEdit(l)}><Pencil size={14} /></button>
                      <button className="p-1.5 rounded hover:bg-red-100 text-red-600" onClick={() => remove(l.id)}><Trash2 size={14} /></button>
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
