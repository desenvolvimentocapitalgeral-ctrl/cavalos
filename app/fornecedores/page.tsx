'use client'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { brl } from '@/lib/format'
import { Plus, Search, Pencil, Trash2, X, Check } from 'lucide-react'
import type { Fornecedor } from '@/lib/types'

export default function FornecedoresPage() {
  const supabase = createClient()
  const [items, setItems] = useState<Fornecedor[]>([])
  const [totais, setTotais] = useState<Record<string, { total: number; vencido: number }>>({})
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<string | null>(null)
  const [editData, setEditData] = useState<Partial<Fornecedor>>({ nome: '', nome_curto: '', cnpj_cpf: '' })
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
      const t: Record<string, { total: number; vencido: number }> = {}
      l.forEach((r: { fornecedor_id: string | null; situacao: string; valor: number }) => {
        if (!r.fornecedor_id) return
        if (!t[r.fornecedor_id]) t[r.fornecedor_id] = { total: 0, vencido: 0 }
        t[r.fornecedor_id].total   += Number(r.valor) || 0
        if (r.situacao === 'VENCIDO') t[r.fornecedor_id].vencido += Number(r.valor) || 0
      })
      setTotais(t)
    }
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    load()
    const ch = supabase.channel('fornec-page')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'fornecedores' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lancamentos' }, load)
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [load, supabase])

  const filtered = items.filter(f => {
    const q = search.toLowerCase()
    return !q || (f.nome_curto ?? f.nome).toLowerCase().includes(q) || (f.cnpj_cpf ?? '').includes(q)
  })

  async function save() {
    setSaving(true); setError('')
    if (!editData.nome?.trim()) { setError('Nome obrigatório'); setSaving(false); return }
    const payload = { nome: editData.nome, nome_curto: editData.nome_curto || editData.nome, cnpj_cpf: editData.cnpj_cpf || null }
    if (editing) {
      const { error: e } = await supabase.from('fornecedores').update(payload).eq('id', editing)
      if (e) setError(e.message)
    } else {
      const { error: e } = await supabase.from('fornecedores').insert([payload])
      if (e) setError(e.message)
    }
    setSaving(false)
    if (!error) { setShowForm(false); setEditing(null); setEditData({ nome: '', nome_curto: '', cnpj_cpf: '' }) }
  }

  async function remove(id: string) {
    if (!confirm('Excluir este fornecedor?')) return
    await supabase.from('fornecedores').delete().eq('id', id)
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Fornecedores</h1>
          <p className="text-sm text-gray-500">{items.length} fornecedores cadastrados</p>
        </div>
        <button className="btn-primary" onClick={() => { setShowForm(true); setEditing(null); setEditData({ nome: '', nome_curto: '', cnpj_cpf: '' }); setError('') }}>
          <Plus size={16} /> Novo Fornecedor
        </button>
      </div>

      {showForm && (
        <div className="card p-6 border-2 border-brand-200">
          <h2 className="font-semibold text-lg text-brand-800 mb-4">{editing ? 'Editar Fornecedor' : 'Novo Fornecedor'}</h2>
          {error && <p className="text-red-600 text-sm mb-3 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <label className="label">Nome completo *</label>
              <input className="input" value={editData.nome ?? ''} onChange={e => setEditData(d => ({ ...d, nome: e.target.value }))} />
            </div>
            <div>
              <label className="label">Nome curto</label>
              <input className="input" value={editData.nome_curto ?? ''} onChange={e => setEditData(d => ({ ...d, nome_curto: e.target.value }))} />
            </div>
            <div>
              <label className="label">CNPJ / CPF</label>
              <input className="input" value={editData.cnpj_cpf ?? ''} onChange={e => setEditData(d => ({ ...d, cnpj_cpf: e.target.value }))} />
            </div>
          </div>
          <div className="flex gap-3 mt-5">
            <button className="btn-primary" onClick={save} disabled={saving}><Check size={16} /> {saving ? 'Salvando...' : 'Salvar'}</button>
            <button className="btn-secondary" onClick={() => { setShowForm(false); setEditing(null) }}><X size={16} /> Cancelar</button>
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
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="th">Nome</th>
                <th className="th">CNPJ / CPF</th>
                <th className="th text-right">Vencido</th>
                <th className="th text-right">Total</th>
                <th className="th text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="td text-center text-gray-400 py-12">Carregando...</td></tr>
              ) : filtered.map(f => (
                <tr key={f.id} className="hover:bg-blue-50/30 transition-colors group">
                  <td className="td">
                    <p className="font-semibold text-gray-800">{f.nome_curto ?? f.nome}</p>
                    {f.nome_curto && <p className="text-xs text-gray-400 truncate max-w-xs">{f.nome}</p>}
                  </td>
                  <td className="td text-xs font-mono text-gray-500">{f.cnpj_cpf ?? '—'}</td>
                  <td className="td text-right font-medium text-red-700">{brl(totais[f.id]?.vencido ?? 0)}</td>
                  <td className="td text-right font-semibold text-brand-800">{brl(totais[f.id]?.total ?? 0)}</td>
                  <td className="td">
                    <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button className="p-1.5 rounded hover:bg-blue-100 text-blue-600" onClick={() => { setEditing(f.id); setEditData({ ...f }); setShowForm(true) }}><Pencil size={14} /></button>
                      <button className="p-1.5 rounded hover:bg-red-100 text-red-600" onClick={() => remove(f.id)}><Trash2 size={14} /></button>
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
