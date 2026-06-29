'use client'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { sitLabel, sitColor } from '@/lib/format'
import { Plus, Search, Pencil, Trash2, X, Check } from 'lucide-react'
import type { Animal, SituacaoAnimal } from '@/lib/types'

const SITUACOES: SituacaoAnimal[] = ['ATIVO', 'NEGOCIAR', 'CANCELADA', 'VENDIDA', 'DEVOLVIDA']

const emptyAnimal = (): Partial<Animal> => ({
  nome: '', localizacao: '', finalidade: '', tipo: '', comprador: '', situacao: 'ATIVO', observacao: ''
})

export default function AnimaisPage() {
  const supabase = createClient()
  const [animais, setAnimais] = useState<Animal[]>([])
  const [filtered, setFiltered] = useState<Animal[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<string | null>(null)
  const [editData, setEditData] = useState<Partial<Animal>>(emptyAnimal())
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    const { data } = await supabase.from('animais').select('*').order('nome')
    if (data) { setAnimais(data); setLoading(false) }
  }, [supabase])

  useEffect(() => {
    load()
    const ch = supabase.channel('animais-page')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'animais' }, load)
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [load, supabase])

  useEffect(() => {
    const q = search.toLowerCase()
    setFiltered(animais.filter(a =>
      a.nome.toLowerCase().includes(q) ||
      (a.localizacao ?? '').toLowerCase().includes(q) ||
      (a.finalidade ?? '').toLowerCase().includes(q) ||
      (a.tipo ?? '').toLowerCase().includes(q)
    ))
  }, [search, animais])

  async function save() {
    setSaving(true); setError('')
    if (!editData.nome?.trim()) { setError('Nome obrigatório'); setSaving(false); return }
    if (editing) {
      const { error: e } = await supabase.from('animais').update({ ...editData, updated_at: new Date().toISOString() }).eq('id', editing)
      if (e) setError(e.message)
    } else {
      const { error: e } = await supabase.from('animais').insert([{ ...editData }])
      if (e) setError(e.message)
    }
    setSaving(false)
    if (!error) { setShowForm(false); setEditing(null); setEditData(emptyAnimal()) }
  }

  async function remove(id: string) {
    if (!confirm('Excluir este animal? Os lançamentos financeiros relacionados não serão excluídos.')) return
    await supabase.from('animais').delete().eq('id', id)
  }

  function startEdit(a: Animal) {
    setEditing(a.id); setEditData({ ...a }); setShowForm(true); setError('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function cancelForm() {
    setShowForm(false); setEditing(null); setEditData(emptyAnimal()); setError('')
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Animais</h1>
          <p className="text-sm text-gray-500">{animais.length} animais cadastrados</p>
        </div>
        <button className="btn-primary" onClick={() => { setShowForm(true); setEditing(null); setEditData(emptyAnimal()); setError('') }}>
          <Plus size={16} /> Novo Animal
        </button>
      </div>

      {/* Formulário */}
      {showForm && (
        <div className="card p-6 border-brand-200 border-2">
          <h2 className="font-semibold text-lg text-brand-800 mb-4">{editing ? 'Editar Animal' : 'Novo Animal'}</h2>
          {error && <p className="text-red-600 text-sm mb-3 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2">
              <label className="label">Nome *</label>
              <input className="input" value={editData.nome ?? ''} onChange={e => setEditData(d => ({ ...d, nome: e.target.value }))} placeholder="Ex: SOOKIE" />
            </div>
            <div>
              <label className="label">Situação</label>
              <select className="input" value={editData.situacao ?? 'ATIVO'} onChange={e => setEditData(d => ({ ...d, situacao: e.target.value as SituacaoAnimal }))}>
                {SITUACOES.map(s => <option key={s} value={s}>{sitLabel(s)}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Localização</label>
              <input className="input" value={editData.localizacao ?? ''} onChange={e => setEditData(d => ({ ...d, localizacao: e.target.value }))} placeholder="Ex: Monte Sião Haras - TO" />
            </div>
            <div>
              <label className="label">Finalidade</label>
              <input className="input" value={editData.finalidade ?? ''} onChange={e => setEditData(d => ({ ...d, finalidade: e.target.value }))} placeholder="Ex: Vaquejada, Trabalho..." />
            </div>
            <div>
              <label className="label">Tipo</label>
              <input className="input" value={editData.tipo ?? ''} onChange={e => setEditData(d => ({ ...d, tipo: e.target.value }))} placeholder="Ex: Égua, Potro, Reprodução..." />
            </div>
            <div>
              <label className="label">Comprador / Contrato</label>
              <input className="input" value={editData.comprador ?? ''} onChange={e => setEditData(d => ({ ...d, comprador: e.target.value }))} placeholder="Ex: Vilma, Dalide..." />
            </div>
            <div className="lg:col-span-2">
              <label className="label">Observação</label>
              <input className="input" value={editData.observacao ?? ''} onChange={e => setEditData(d => ({ ...d, observacao: e.target.value }))} />
            </div>
          </div>
          <div className="flex gap-3 mt-5">
            <button className="btn-primary" onClick={save} disabled={saving}>
              <Check size={16} /> {saving ? 'Salvando...' : 'Salvar'}
            </button>
            <button className="btn-secondary" onClick={cancelForm}><X size={16} /> Cancelar</button>
          </div>
        </div>
      )}

      {/* Busca */}
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          className="input pl-9"
          placeholder="Buscar por nome, localização, finalidade..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Tabela */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="th">Nome</th>
                <th className="th">Localização</th>
                <th className="th">Finalidade</th>
                <th className="th">Tipo</th>
                <th className="th">Comprador</th>
                <th className="th">Situação</th>
                <th className="th text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="td text-center text-gray-400 py-12">Carregando...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={7} className="td text-center text-gray-400 py-12">Nenhum animal encontrado</td></tr>
              ) : filtered.map(a => (
                <tr key={a.id} className="hover:bg-blue-50/30 transition-colors group">
                  <td className="td font-semibold text-brand-800">{a.nome}</td>
                  <td className="td text-gray-600">{a.localizacao ?? '—'}</td>
                  <td className="td text-gray-600">{a.finalidade ?? '—'}</td>
                  <td className="td text-gray-600">{a.tipo ?? '—'}</td>
                  <td className="td text-gray-600">{a.comprador ?? '—'}</td>
                  <td className="td">
                    <span className={`text-xs font-medium px-2 py-1 rounded-full ${sitColor(a.situacao)}`}>
                      {sitLabel(a.situacao)}
                    </span>
                  </td>
                  <td className="td">
                    <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button className="p-1.5 rounded hover:bg-blue-100 text-blue-600" onClick={() => startEdit(a)} title="Editar">
                        <Pencil size={14} />
                      </button>
                      <button className="p-1.5 rounded hover:bg-red-100 text-red-600" onClick={() => remove(a.id)} title="Excluir">
                        <Trash2 size={14} />
                      </button>
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
