'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { sitLabel, sitColor } from '@/lib/format'
import { Plus, Search, Pencil, Trash2, X, Check } from 'lucide-react'

interface Animal {
  id: string; nome: string; localizacao: string | null; finalidade: string | null
  tipo: string | null; comprador: string | null; situacao: string; observacao: string | null
}

const SITUACOES = ['ATIVO', 'NEGOCIAR', 'CANCELADA', 'VENDIDA', 'DEVOLVIDA']
const empty = () => ({ nome: '', localizacao: '', finalidade: '', tipo: '', comprador: '', situacao: 'ATIVO', observacao: '' })

export default function AnimaisPage() {
  const supabase = createClient()
  const [animais, setAnimais] = useState<Animal[]>([])
  const [search, setSearch] = useState('')
  const [filtroLocal, setFiltroLocal] = useState('TODOS')
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<Record<string, string>>(empty())
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    const { data } = await supabase.from('animais').select('*').order('nome')
    if (data) { setAnimais(data); setLoading(false) }
  }, [supabase])

  useEffect(() => {
    load()
    const ch = supabase.channel('animais-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'animais' }, load)
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [load, supabase])

  const localizacoes = Array.from(new Set(animais.map(a => a.localizacao).filter(Boolean))).sort() as string[]

  const filtered = animais.filter(a => {
    const q = search.toLowerCase()
    const matchSearch = !q || a.nome.toLowerCase().includes(q) || (a.localizacao ?? '').toLowerCase().includes(q) || (a.finalidade ?? '').toLowerCase().includes(q) || (a.tipo ?? '').toLowerCase().includes(q)
    const matchLocal = filtroLocal === 'TODOS' || a.localizacao === filtroLocal
    return matchSearch && matchLocal
  })

  function openNew() { setEditingId(null); setForm(empty()); setShowForm(true); setError('') }
  function openEdit(a: Animal) {
    setEditingId(a.id)
    setForm({ nome: a.nome, localizacao: a.localizacao ?? '', finalidade: a.finalidade ?? '', tipo: a.tipo ?? '', comprador: a.comprador ?? '', situacao: a.situacao, observacao: a.observacao ?? '' })
    setShowForm(true); setError('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function save() {
    setSaving(true); setError('')
    if (!form.nome.trim()) { setError('Nome obrigatório'); setSaving(false); return }
    const payload = { nome: form.nome.trim(), localizacao: form.localizacao || null, finalidade: form.finalidade || null, tipo: form.tipo || null, comprador: form.comprador || null, situacao: form.situacao, observacao: form.observacao || null }
    const { error: e } = editingId
      ? await supabase.from('animais').update(payload).eq('id', editingId)
      : await supabase.from('animais').insert([payload])
    if (e) { setError(e.message); setSaving(false); return }
    setSaving(false); setShowForm(false); setEditingId(null); setForm(empty())
  }

  async function remove(id: string) {
    if (!confirm('Excluir este animal? Os lançamentos financeiros não serão excluídos.')) return
    await supabase.from('animais').delete().eq('id', id)
  }

  const set = (key: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [key]: e.target.value }))

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Animais</h1>
          <p className="text-sm text-gray-500">{animais.length} cadastrados · {filtered.length} exibidos</p>
        </div>
        <button className="btn-primary" onClick={openNew}><Plus size={16} /> Novo Animal</button>
      </div>

      {/* Formulário */}
      {showForm && (
        <div className="card p-6 border-2 border-[#BDD7EE]">
          <h2 className="font-semibold text-lg text-[#1F3864] mb-4">{editingId ? 'Editar Animal' : 'Novo Animal'}</h2>
          {error && <p className="text-red-600 text-sm mb-3 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2">
              <label className="label">Nome *</label>
              <input className="input" value={form.nome} onChange={set('nome')} placeholder="Ex: SOOKIE" />
            </div>
            <div>
              <label className="label">Situação</label>
              <select className="input" value={form.situacao} onChange={set('situacao')}>
                {SITUACOES.map(s => <option key={s} value={s}>{sitLabel(s)}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Localização</label>
              <input className="input" value={form.localizacao} onChange={set('localizacao')} placeholder="Ex: Monte Sião Haras - TO" />
            </div>
            <div>
              <label className="label">Finalidade</label>
              <input className="input" value={form.finalidade} onChange={set('finalidade')} placeholder="Ex: Vaquejada, Trabalho..." />
            </div>
            <div>
              <label className="label">Tipo</label>
              <input className="input" value={form.tipo} onChange={set('tipo')} placeholder="Ex: Égua, Potro..." />
            </div>
            <div>
              <label className="label">Comprador / Contrato</label>
              <input className="input" value={form.comprador} onChange={set('comprador')} placeholder="Ex: Vilma, Dalide..." />
            </div>
            <div className="lg:col-span-2">
              <label className="label">Observação</label>
              <input className="input" value={form.observacao} onChange={set('observacao')} />
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

      {/* Busca + Filtro Localização */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input className="input pl-9" placeholder="Buscar por nome, localização, finalidade..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="input w-auto" value={filtroLocal} onChange={e => setFiltroLocal(e.target.value)}>
          <option value="TODOS">Todas as localizações</option>
          {localizacoes.map(l => <option key={l} value={l}>{l}</option>)}
        </select>
      </div>

      {/* Tabela */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="th">Nome</th>
                <th className="th">Localização</th>
                <th className="th">Finalidade</th>
                <th className="th">Tipo</th>
                <th className="th">Comprador</th>
                <th className="th">Situação</th>
                <th className="th w-20">Ações</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="td text-center text-gray-400 py-12">Carregando...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={7} className="td text-center text-gray-400 py-12">Nenhum animal encontrado</td></tr>
              ) : filtered.map(a => (
                <tr key={a.id} className="hover:bg-blue-50/40 transition-colors group">
                  <td className="td font-semibold text-[#1F3864]">{a.nome}</td>
                  <td className="td text-gray-600 text-xs">{a.localizacao ?? '—'}</td>
                  <td className="td text-gray-600 text-xs">{a.finalidade ?? '—'}</td>
                  <td className="td text-gray-600 text-xs">{a.tipo ?? '—'}</td>
                  <td className="td text-gray-600 text-xs">{a.comprador ?? '—'}</td>
                  <td className="td">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${sitColor(a.situacao)}`}>
                      {sitLabel(a.situacao)}
                    </span>
                  </td>
                  <td className="td">
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button className="p-1.5 rounded hover:bg-blue-100 text-blue-600" onClick={() => openEdit(a)} title="Editar">
                        <Pencil size={13} />
                      </button>
                      <button className="p-1.5 rounded hover:bg-red-100 text-red-600" onClick={() => remove(a.id)} title="Excluir">
                        <Trash2 size={13} />
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
