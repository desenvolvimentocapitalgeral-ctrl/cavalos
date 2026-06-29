'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { brl } from '@/lib/format'
import { Plus, Search, Pencil, Trash2, X, Check } from 'lucide-react'

interface Fornecedor { id: string; nome: string; nome_curto: string | null; cnpj_cpf: string | null }
interface FornTotal { total: number; vencido: number }

const empty = () => ({ nome: '', nome_curto: '', cnpj_cpf: '' })

export default function FornecedoresPage() {
  const supabase = createClient()
  const [items, setItems] = useState<Fornecedor[]>([])
  const [totais, setTotais] = useState<Record<string, FornTotal>>({})
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<Record<string, string>>(empty())
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    const [{ data: f }, { data: l }] = await Promise.all([
      supabase.from('fornecedores').select('*').order('nome_curto'),
      supabase.from('lancamentos').select('fornecedor_id, situacao, valor'),
    ])
    if (f) setItems(f)
    if (l) {
      const t: Record<string, FornTotal> = {}
      for (const r of l) {
        if (!r.fornecedor_id) continue
        if (!t[r.fornecedor_id]) t[r.fornecedor_id] = { total: 0, vencido: 0 }
        t[r.fornecedor_id].total += Number(r.valor) || 0
        if (r.situacao === 'VENCIDO') t[r.fornecedor_id].vencido += Number(r.valor) || 0
      }
      setTotais(t)
    }
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    load()
    const ch = supabase.channel('fornec-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'fornecedores' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lancamentos' }, load)
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [load, supabase])

  const filtered = items.filter(f => {
    const q = search.toLowerCase()
    return !q || (f.nome_curto ?? f.nome).toLowerCase().includes(q) || (f.cnpj_cpf ?? '').includes(q)
  })

  function openNew() { setEditingId(null); setForm(empty()); setShowForm(true); setError('') }
  function openEdit(f: Fornecedor) {
    setEditingId(f.id)
    setForm({ nome: f.nome, nome_curto: f.nome_curto ?? '', cnpj_cpf: f.cnpj_cpf ?? '' })
    setShowForm(true); setError('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function save() {
    setSaving(true); setError('')
    if (!form.nome.trim()) { setError('Nome obrigatório'); setSaving(false); return }
    const payload = { nome: form.nome.trim(), nome_curto: form.nome_curto.trim() || form.nome.trim(), cnpj_cpf: form.cnpj_cpf.trim() || null }
    const { error: e } = editingId
      ? await supabase.from('fornecedores').update(payload).eq('id', editingId)
      : await supabase.from('fornecedores').insert([payload])
    if (e) { setError(e.message); setSaving(false); return }
    setSaving(false); setShowForm(false); setEditingId(null); setForm(empty())
  }

  async function remove(id: string) {
    if (!confirm('Excluir este fornecedor? Os lançamentos continuarão mas sem vínculo.')) return
    await supabase.from('fornecedores').delete().eq('id', id)
  }

  const set = (key: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [key]: e.target.value }))

  const sorted = [...filtered].sort((a, b) => (totais[b.id]?.total ?? 0) - (totais[a.id]?.total ?? 0))

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Fornecedores</h1>
          <p className="text-sm text-gray-500">{items.length} cadastrados</p>
        </div>
        <button className="btn-primary" onClick={openNew}><Plus size={16} /> Novo Fornecedor</button>
      </div>

      {showForm && (
        <div className="card p-6 border-2 border-[#BDD7EE]">
          <h2 className="font-semibold text-lg text-[#1F3864] mb-4">{editingId ? 'Editar Fornecedor' : 'Novo Fornecedor'}</h2>
          {error && <p className="text-red-600 text-sm mb-3 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <label className="label">Nome completo *</label>
              <input className="input" value={form.nome} onChange={set('nome')} placeholder="Ex: CAFULA AGROPECUARIA - CNPJ: 05956202000125" />
            </div>
            <div>
              <label className="label">Nome curto (exibição)</label>
              <input className="input" value={form.nome_curto} onChange={set('nome_curto')} placeholder="Ex: Cafula Agropecuária" />
            </div>
            <div>
              <label className="label">CNPJ / CPF</label>
              <input className="input" value={form.cnpj_cpf} onChange={set('cnpj_cpf')} placeholder="Somente números" />
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

      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input className="input pl-9" placeholder="Buscar por nome ou CNPJ/CPF..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="th">Fornecedor</th>
                <th className="th">CNPJ / CPF</th>
                <th className="th text-right">Vencido</th>
                <th className="th text-right">Total</th>
                <th className="th w-20">Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="td text-center text-gray-400 py-12">Carregando...</td></tr>
              ) : sorted.length === 0 ? (
                <tr><td colSpan={5} className="td text-center text-gray-400 py-12">Nenhum fornecedor encontrado</td></tr>
              ) : sorted.map(f => (
                <tr key={f.id} className="hover:bg-blue-50/40 transition-colors group">
                  <td className="td">
                    <p className="font-semibold text-gray-800">{f.nome_curto ?? f.nome}</p>
                    {f.nome_curto && <p className="text-xs text-gray-400 truncate max-w-xs">{f.nome}</p>}
                  </td>
                  <td className="td text-xs font-mono text-gray-500">{f.cnpj_cpf ?? '—'}</td>
                  <td className="td text-right font-semibold text-red-700">
                    {(totais[f.id]?.vencido ?? 0) > 0 ? brl(totais[f.id].vencido) : '—'}
                  </td>
                  <td className="td text-right font-bold text-[#1F3864]">
                    {(totais[f.id]?.total ?? 0) > 0 ? brl(totais[f.id].total) : '—'}
                  </td>
                  <td className="td">
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button className="p-1.5 rounded hover:bg-blue-100 text-blue-600" onClick={() => openEdit(f)}><Pencil size={13} /></button>
                      <button className="p-1.5 rounded hover:bg-red-100 text-red-600" onClick={() => remove(f.id)}><Trash2 size={13} /></button>
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
