'use client'
import { useEffect, useState, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { brl } from '@/lib/format'
import { ChevronDown, ChevronRight, Search, RefreshCw } from 'lucide-react'

interface Doc { documento: string; historico: string; situacao: string; valor: number }
interface FornRow { nome: string; pago: number; vencido: number; a_vencer: number; distratos: number; descontos: number; total: number; docs: Doc[] }
interface AnimalGroup { animal_nome: string; localizacao: string; na_listagem: boolean; pago: number; vencido: number; a_vencer: number; distratos: number; descontos: number; total: number; fornecedores: FornRow[] }

export default function AuditoriaPage() {
  const supabase = createClient()
  const [groups, setGroups] = useState<AnimalGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [lastUpdate, setLastUpdate] = useState('')
  const [showFora, setShowFora] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('lancamentos')
      .select('animal_nome, fornecedor_nome, documento, historico, situacao, valor, na_listagem')
      .order('animal_nome')

    // Buscar localizações separadamente
    const { data: animaisLoc } = await supabase
      .from('animais')
      .select('nome, localizacao')

    const locMap: Record<string, string> = {}
    if (animaisLoc) {
      for (const a of animaisLoc) locMap[a.nome.toUpperCase()] = a.localizacao ?? ''
    }

    if (!data) { setLoading(false); return }

    const byAnimal: Record<string, AnimalGroup> = {}
    for (const l of data) {
      const an = l.animal_nome ?? ''
      const fn = (l.fornecedor_nome ?? '').replace(/\s*-?\s*(CNPJ|CPF):.+/i, '').trim()
      const v  = Number(l.valor) || 0

      if (!byAnimal[an]) {
        byAnimal[an] = {
          animal_nome: an,
          localizacao: locMap[an.toUpperCase()] ?? '',
          na_listagem: Boolean(l.na_listagem),
          pago: 0, vencido: 0, a_vencer: 0, distratos: 0, descontos: 0, total: 0,
          fornecedores: [],
        }
      }
      const ag = byAnimal[an]
      ag.total += v
      if (l.situacao === 'PAGO')      ag.pago      += v
      if (l.situacao === 'VENCIDO')   ag.vencido   += v
      if (l.situacao === 'A_VENCER')  ag.a_vencer  += v
      if (l.situacao === 'DISTRATOS') ag.distratos += v
      if (l.situacao === 'DESCONTOS') ag.descontos += v

      let fg = ag.fornecedores.find(f => f.nome === fn)
      if (!fg) {
        fg = { nome: fn, pago: 0, vencido: 0, a_vencer: 0, distratos: 0, descontos: 0, total: 0, docs: [] }
        ag.fornecedores.push(fg)
      }
      fg.total += v
      if (l.situacao === 'PAGO')      fg.pago      += v
      if (l.situacao === 'VENCIDO')   fg.vencido   += v
      if (l.situacao === 'A_VENCER')  fg.a_vencer  += v
      if (l.situacao === 'DISTRATOS') fg.distratos += v
      if (l.situacao === 'DESCONTOS') fg.descontos += v
      fg.docs.push({ documento: l.documento ?? '', historico: l.historico ?? '', situacao: l.situacao, valor: v })
    }

    setGroups(
      Object.values(byAnimal).sort((a, b) => {
        if (a.na_listagem !== b.na_listagem) return a.na_listagem ? -1 : 1
        return a.animal_nome.localeCompare(b.animal_nome)
      })
    )
    setLastUpdate(new Date().toLocaleTimeString('pt-BR'))
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    load()
    const ch = supabase
      .channel('audit-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lancamentos' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'animais' }, load)
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [load, supabase])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return groups.filter(g => {
      if (!showFora && !g.na_listagem) return false
      if (!q) return true
      return g.animal_nome.toLowerCase().includes(q) ||
        g.localizacao.toLowerCase().includes(q) ||
        g.fornecedores.some(f => f.nome.toLowerCase().includes(q))
    })
  }, [groups, search, showFora])

  const totals = useMemo(() => filtered.reduce(
    (t, g) => ({ pago: t.pago+g.pago, vencido: t.vencido+g.vencido, a_vencer: t.a_vencer+g.a_vencer, distratos: t.distratos+g.distratos, descontos: t.descontos+g.descontos, total: t.total+g.total }),
    { pago: 0, vencido: 0, a_vencer: 0, distratos: 0, descontos: 0, total: 0 }
  ), [filtered])

  function toggle(name: string) {
    setExpanded(prev => {
      const n = new Set(prev)
      n.has(name) ? n.delete(name) : n.add(name)
      return n
    })
  }

  const listed  = filtered.filter(g => g.na_listagem)
  const outside = filtered.filter(g => !g.na_listagem)

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Auditoria Consolidada</h1>
          <p className="text-sm text-gray-500">{lastUpdate && `Atualizado às ${lastUpdate}`}</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
            <input type="checkbox" checked={showFora} onChange={e => setShowFora(e.target.checked)} className="rounded" />
            Mostrar fora da listagem
          </label>
          <button className="btn-secondary" onClick={load}><RefreshCw size={14} /> Atualizar</button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 lg:grid-cols-6 gap-3">
        {([
          ['Total',     totals.total,     'text-[#1F3864]'],
          ['Pago',      totals.pago,      'text-green-700'],
          ['Vencido',   totals.vencido,   'text-red-700'],
          ['A Vencer',  totals.a_vencer,  'text-blue-700'],
          ['Distratos', totals.distratos, 'text-orange-700'],
          ['Descontos', totals.descontos, 'text-purple-700'],
        ] as [string, number, string][]).map(([label, val, color]) => (
          <div key={label} className="card p-4 text-center">
            <p className="text-xs text-gray-500 mb-1">{label}</p>
            <p className={`font-bold text-sm ${color}`}>{brl(val)}</p>
          </div>
        ))}
      </div>

      {/* Busca */}
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input className="input pl-9" placeholder="Buscar animal, fornecedor ou localização..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {/* Lista */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin w-8 h-8 border-4 border-[#1F3864] border-t-transparent rounded-full" />
        </div>
      ) : (
        <div className="space-y-1.5">
          {/* Na listagem */}
          {listed.map(g => (
            <AnimalRow key={g.animal_nome} g={g} expanded={expanded.has(g.animal_nome)} onToggle={() => toggle(g.animal_nome)} />
          ))}

          {/* Fora da listagem */}
          {showFora && outside.length > 0 && (
            <>
              <div className="mt-5 mb-2 px-4 py-3 bg-gray-600 text-white text-sm font-semibold rounded-lg">
                Fora da Listagem — {outside.length} {outside.length === 1 ? 'item' : 'itens'} · {brl(outside.reduce((s, g) => s + g.total, 0))}
              </div>
              {outside.map(g => (
                <AnimalRow key={g.animal_nome} g={g} expanded={expanded.has(g.animal_nome)} onToggle={() => toggle(g.animal_nome)} fora />
              ))}
            </>
          )}
        </div>
      )}
    </div>
  )
}

function AnimalRow({ g, expanded, onToggle, fora }: { g: AnimalGroup; expanded: boolean; onToggle: () => void; fora?: boolean }) {
  const sitColor: Record<string, string> = {
    PAGO: 'text-green-700', VENCIDO: 'text-red-700', A_VENCER: 'text-blue-700',
    DISTRATOS: 'text-orange-700', DESCONTOS: 'text-purple-700',
  }

  return (
    <div className={`rounded-xl overflow-hidden border ${fora ? 'border-gray-300' : 'border-[#BDD7EE]'}`}>
      {/* Header do animal */}
      <button
        className={`w-full flex items-center px-4 py-3 text-left gap-3 transition-colors ${
          fora
            ? 'bg-gray-100 hover:bg-gray-200 text-gray-700'
            : 'bg-[#1F3864] hover:bg-[#2E75B6] text-white'
        }`}
        onClick={onToggle}
      >
        {expanded ? <ChevronDown size={16} className="flex-shrink-0" /> : <ChevronRight size={16} className="flex-shrink-0" />}
        <span className="font-semibold flex-1 truncate text-sm">{g.animal_nome}</span>
        {g.localizacao && (
          <span className={`text-xs hidden md:block truncate max-w-[200px] ${fora ? 'text-gray-500' : 'text-[#BDD7EE]'}`}>
            📍 {g.localizacao}
          </span>
        )}
        {g.vencido > 0 && (
          <span className={`text-xs font-medium ${fora ? 'text-red-700' : 'text-red-300'}`}>
            V: {brl(g.vencido)}
          </span>
        )}
        <span className={`text-sm font-bold tabular-nums flex-shrink-0 ${fora ? 'text-gray-800' : 'text-white'}`}>
          {brl(g.total)}
        </span>
      </button>

      {/* Detalhes expandidos */}
      {expanded && (
        <div>
          {g.fornecedores.map(f => (
            <div key={f.nome}>
              {/* Linha do fornecedor */}
              <div className="flex items-center gap-3 px-6 py-2.5 bg-[#E2EFDA] border-t border-[#A9D18E] text-sm">
                <span className="flex-1 font-medium text-gray-800 truncate">{f.nome || '—'}</span>
                <span className="text-green-700 text-xs tabular-nums">{f.pago > 0 ? `P: ${brl(f.pago)}` : ''}</span>
                <span className="text-red-700 text-xs font-semibold tabular-nums">{f.vencido > 0 ? `V: ${brl(f.vencido)}` : ''}</span>
                <span className="text-blue-700 text-xs tabular-nums">{f.a_vencer > 0 ? `AV: ${brl(f.a_vencer)}` : ''}</span>
                {f.distratos > 0 && <span className="text-orange-700 text-xs tabular-nums">D: {brl(f.distratos)}</span>}
                <span className="font-bold text-[#1F3864] tabular-nums">{brl(f.total)}</span>
              </div>
              {/* Documentos individuais */}
              {f.docs.map((d, i) => (
                <div key={i} className="flex items-center gap-3 px-10 py-1.5 bg-white border-t border-gray-50 text-xs text-gray-500">
                  {d.documento && <span className="font-mono text-gray-400 flex-shrink-0">{d.documento}</span>}
                  <span className="flex-1 truncate">{d.historico}</span>
                  <span className={`px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${
                    d.situacao === 'VENCIDO'  ? 'bg-red-100 text-red-700'   :
                    d.situacao === 'PAGO'     ? 'bg-green-100 text-green-700' :
                    d.situacao === 'A_VENCER' ? 'bg-blue-100 text-blue-700'  :
                    'bg-orange-100 text-orange-700'
                  }`}>{d.situacao}</span>
                  <span className={`tabular-nums font-semibold flex-shrink-0 ${sitColor[d.situacao] ?? ''}`}>{brl(d.valor)}</span>
                </div>
              ))}
            </div>
          ))}
          {/* Subtotal */}
          <div className="flex items-center gap-3 px-4 py-2.5 bg-[#BDD7EE] text-sm font-bold text-[#1F3864] border-t-2 border-[#2E75B6]">
            <span className="flex-1">Subtotal {g.animal_nome}</span>
            <span className="text-green-800">{g.pago > 0 ? `P: ${brl(g.pago)}` : ''}</span>
            <span className="text-red-700">{g.vencido > 0 ? `V: ${brl(g.vencido)}` : ''}</span>
            <span className="text-blue-800">{g.a_vencer > 0 ? `AV: ${brl(g.a_vencer)}` : ''}</span>
            <span className="text-[#1F3864]">{brl(g.total)}</span>
          </div>
        </div>
      )}
    </div>
  )
}
