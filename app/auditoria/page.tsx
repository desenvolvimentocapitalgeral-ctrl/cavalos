'use client'
import { useEffect, useState, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { brl } from '@/lib/format'
import { ChevronDown, ChevronRight, Search, RefreshCw } from 'lucide-react'

interface AnimalGroup {
  animal_nome: string
  localizacao: string
  na_listagem: boolean
  pago: number; vencido: number; a_vencer: number; distratos: number; descontos: number; total: number
  fornecedores: {
    nome: string
    pago: number; vencido: number; a_vencer: number; distratos: number; descontos: number; total: number
    docs: { documento: string; historico: string; situacao: string; valor: number }[]
  }[]
}

export default function AuditoriaPage() {
  const supabase = createClient()
  const [groups, setGroups] = useState<AnimalGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [lastUpdate, setLastUpdate] = useState(new Date())
  const [showFora, setShowFora] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('lancamentos')
      .select('animal_nome, fornecedor_nome, documento, historico, situacao, valor, na_listagem, animais(localizacao)')
      .order('animal_nome')

    if (!data) { setLoading(false); return }

    const byAnimal: Record<string, AnimalGroup> = {}
    data.forEach((l: { animal_nome: string; fornecedor_nome: string; documento: string; historico: string; situacao: string; valor: number; na_listagem: boolean; animais?: { localizacao: string } }) => {
      const an = l.animal_nome
      const fn = l.fornecedor_nome?.replace(/\s*-?\s*(CNPJ|CPF):.+/i, '').trim() ?? ''
      const v  = Number(l.valor) || 0

      if (!byAnimal[an]) byAnimal[an] = {
        animal_nome: an, localizacao: (l.animais as { localizacao: string } | undefined)?.localizacao ?? '',
        na_listagem: l.na_listagem,
        pago:0, vencido:0, a_vencer:0, distratos:0, descontos:0, total:0, fornecedores:[],
      }
      const ag = byAnimal[an]
      ag.total += v
      if (l.situacao === 'PAGO')      ag.pago      += v
      if (l.situacao === 'VENCIDO')   ag.vencido   += v
      if (l.situacao === 'A_VENCER')  ag.a_vencer  += v
      if (l.situacao === 'DISTRATOS') ag.distratos += v
      if (l.situacao === 'DESCONTOS') ag.descontos += v

      let fg = ag.fornecedores.find(f => f.nome === fn)
      if (!fg) { fg = { nome: fn, pago:0, vencido:0, a_vencer:0, distratos:0, descontos:0, total:0, docs:[] }; ag.fornecedores.push(fg) }
      fg.total += v
      if (l.situacao === 'PAGO')      fg.pago      += v
      if (l.situacao === 'VENCIDO')   fg.vencido   += v
      if (l.situacao === 'A_VENCER')  fg.a_vencer  += v
      if (l.situacao === 'DISTRATOS') fg.distratos += v
      if (l.situacao === 'DESCONTOS') fg.descontos += v
      fg.docs.push({ documento: l.documento ?? '', historico: l.historico ?? '', situacao: l.situacao, valor: v })
    })

    setGroups(Object.values(byAnimal).sort((a, b) => {
      if (a.na_listagem !== b.na_listagem) return a.na_listagem ? -1 : 1
      return a.animal_nome.localeCompare(b.animal_nome)
    }))
    setLastUpdate(new Date())
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    load()
    const ch = supabase.channel('audit-page')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lancamentos' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'animais' }, load)
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [load, supabase])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return groups.filter(g => {
      if (!showFora && !g.na_listagem) return false
      return !q || g.animal_nome.toLowerCase().includes(q) || g.localizacao.toLowerCase().includes(q) || g.fornecedores.some(f => f.nome.toLowerCase().includes(q))
    })
  }, [groups, search, showFora])

  const totals = useMemo(() => filtered.reduce((t, g) => ({
    pago: t.pago+g.pago, vencido: t.vencido+g.vencido, a_vencer: t.a_vencer+g.a_vencer,
    distratos: t.distratos+g.distratos, descontos: t.descontos+g.descontos, total: t.total+g.total,
  }), { pago:0, vencido:0, a_vencer:0, distratos:0, descontos:0, total:0 }), [filtered])

  function toggle(name: string) {
    setExpanded(prev => { const n = new Set(prev); n.has(name) ? n.delete(name) : n.add(name); return n })
  }

  const listed  = filtered.filter(g => g.na_listagem)
  const outside = filtered.filter(g => !g.na_listagem)

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Auditoria Consolidada</h1>
          <p className="text-sm text-gray-500">Atualizado {lastUpdate.toLocaleTimeString('pt-BR')}</p>
        </div>
        <div className="flex gap-3">
          <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
            <input type="checkbox" className="rounded" checked={showFora} onChange={e => setShowFora(e.target.checked)} />
            Mostrar fora da listagem
          </label>
          <button className="btn-secondary" onClick={load}><RefreshCw size={14} /> Atualizar</button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 lg:grid-cols-6 gap-3">
        {([['Total', totals.total, 'text-brand-800'], ['Pago', totals.pago, 'text-green-700'], ['Vencido', totals.vencido, 'text-red-700'],
          ['A Vencer', totals.a_vencer, 'text-blue-700'], ['Distratos', totals.distratos, 'text-orange-700'], ['Descontos', totals.descontos, 'text-purple-700']
        ] as [string, number, string][]).map(([l, v, c]) => (
          <div key={l} className="card p-4 text-center">
            <p className="text-xs text-gray-500">{l}</p>
            <p className={`font-bold text-sm mt-1 ${c}`}>{brl(v)}</p>
          </div>
        ))}
      </div>

      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input className="input pl-9" placeholder="Buscar animal, fornecedor, localização..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin w-8 h-8 border-4 border-brand-800 border-t-transparent rounded-full" />
        </div>
      ) : (
        <div className="space-y-1.5">
          {listed.map(g => <AnimalRow key={g.animal_nome} g={g} expanded={expanded.has(g.animal_nome)} onToggle={() => toggle(g.animal_nome)} />)}
          {showFora && outside.length > 0 && (
            <>
              <div className="py-2 px-4 bg-gray-600 text-white text-sm font-semibold rounded-lg mt-4">
                Fora da Listagem — {outside.length} itens
              </div>
              {outside.map(g => <AnimalRow key={g.animal_nome} g={g} expanded={expanded.has(g.animal_nome)} onToggle={() => toggle(g.animal_nome)} fora />)}
            </>
          )}
        </div>
      )}
    </div>
  )
}

function AnimalRow({ g, expanded, onToggle, fora }: { g: AnimalGroup; expanded: boolean; onToggle: () => void; fora?: boolean }) {
  return (
    <div className={`rounded-lg overflow-hidden border ${fora ? 'border-gray-300' : 'border-brand-200'}`}>
      <button
        className={`w-full flex items-center px-4 py-3 text-left gap-3 ${fora ? 'bg-gray-100 hover:bg-gray-200' : 'bg-brand-800 hover:bg-brand-700 text-white'}`}
        onClick={onToggle}
      >
        {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        <span className="font-semibold flex-1 truncate">{g.animal_nome}</span>
        {g.localizacao && <span className={`text-xs hidden sm:block ${fora ? 'text-gray-500' : 'text-brand-300'}`}>{g.localizacao}</span>}
        <span className={`text-xs font-mono font-bold ${fora ? 'text-gray-700' : 'text-white'}`}>{brl(g.total)}</span>
      </button>
      {expanded && (
        <div className="divide-y divide-gray-100">
          {g.fornecedores.map(f => (
            <div key={f.nome} className="bg-green-50">
              <div className="flex items-center gap-4 px-6 py-2.5 text-sm">
                <span className="flex-1 font-medium text-gray-700 truncate">{f.nome || '—'}</span>
                <span className="text-green-700 tabular-nums text-xs">{f.pago > 0 ? `P: ${brl(f.pago)}` : ''}</span>
                <span className="text-red-700 tabular-nums text-xs font-medium">{f.vencido > 0 ? `V: ${brl(f.vencido)}` : ''}</span>
                <span className="text-blue-700 tabular-nums text-xs">{f.a_vencer > 0 ? `AV: ${brl(f.a_vencer)}` : ''}</span>
                <span className="font-semibold text-brand-800 tabular-nums text-sm">{brl(f.total)}</span>
              </div>
              {f.docs.length > 1 && f.docs.map((d, i) => (
                <div key={i} className="flex items-center gap-4 px-10 py-1.5 text-xs text-gray-500 bg-white border-t border-gray-50">
                  <span className="font-mono text-gray-400">{d.documento}</span>
                  <span className="flex-1 truncate">{d.historico}</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs ${d.situacao === 'VENCIDO' ? 'bg-red-100 text-red-700' : d.situacao === 'PAGO' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>{d.situacao}</span>
                  <span className="tabular-nums font-medium">{brl(d.valor)}</span>
                </div>
              ))}
            </div>
          ))}
          <div className="flex items-center gap-4 px-4 py-2 bg-blue-50 text-sm font-semibold border-t border-brand-100">
            <span className="flex-1 text-brand-800">Subtotal {g.animal_nome}</span>
            <span className="text-green-700">{g.pago > 0 ? `P: ${brl(g.pago)}` : ''}</span>
            <span className="text-red-700">{g.vencido > 0 ? `V: ${brl(g.vencido)}` : ''}</span>
            <span className="text-blue-700">{g.a_vencer > 0 ? `AV: ${brl(g.a_vencer)}` : ''}</span>
            <span className="text-brand-800 font-bold">{brl(g.total)}</span>
          </div>
        </div>
      )}
    </div>
  )
}
