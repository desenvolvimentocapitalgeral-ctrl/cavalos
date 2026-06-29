'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { brl } from '@/lib/format'
import { TrendingUp, AlertCircle, Clock, TrendingDown, Zap } from 'lucide-react'

interface Totals {
  pago: number; vencido: number; a_vencer: number; distratos: number; descontos: number; total: number
}
interface AnimalTop { animal_nome: string; total: number; vencido: number }

export default function Dashboard() {
  const supabase = createClient()
  const [totals, setTotals] = useState<Totals>({ pago: 0, vencido: 0, a_vencer: 0, distratos: 0, descontos: 0, total: 0 })
  const [topAnimais, setTopAnimais] = useState<AnimalTop[]>([])
  const [qtdAnimais, setQtdAnimais] = useState(0)
  const [qtdFornec, setQtdFornec] = useState(0)
  const [loading, setLoading] = useState(true)
  const [lastUpdate, setLastUpdate] = useState('')

  const load = useCallback(async () => {
    const [{ data: lancs }, { count: ca }, { count: cf }] = await Promise.all([
      supabase.from('lancamentos').select('animal_nome, situacao, valor'),
      supabase.from('animais').select('*', { count: 'exact', head: true }),
      supabase.from('fornecedores').select('*', { count: 'exact', head: true }),
    ])

    setQtdAnimais(ca ?? 0)
    setQtdFornec(cf ?? 0)

    if (lancs) {
      const t: Totals = { pago: 0, vencido: 0, a_vencer: 0, distratos: 0, descontos: 0, total: 0 }
      const byAnimal: Record<string, AnimalTop> = {}

      for (const l of lancs) {
        const v = Number(l.valor) || 0
        t.total += v
        if (l.situacao === 'PAGO')      t.pago      += v
        if (l.situacao === 'VENCIDO')   t.vencido   += v
        if (l.situacao === 'A_VENCER')  t.a_vencer  += v
        if (l.situacao === 'DISTRATOS') t.distratos += v
        if (l.situacao === 'DESCONTOS') t.descontos += v

        if (!byAnimal[l.animal_nome]) byAnimal[l.animal_nome] = { animal_nome: l.animal_nome, total: 0, vencido: 0 }
        byAnimal[l.animal_nome].total += v
        if (l.situacao === 'VENCIDO') byAnimal[l.animal_nome].vencido += v
      }

      setTotals(t)
      setTopAnimais(Object.values(byAnimal).sort((a, b) => b.total - a.total).slice(0, 12))
    }

    setLastUpdate(new Date().toLocaleTimeString('pt-BR'))
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    load()
    const ch = supabase
      .channel('dashboard-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lancamentos' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'animais' }, load)
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [load, supabase])

  const kpis = [
    { label: 'Total Geral',  value: brl(totals.total),     color: 'text-[#1F3864]', bg: 'bg-blue-50',   icon: TrendingUp },
    { label: 'Pago',         value: brl(totals.pago),      color: 'text-green-700', bg: 'bg-green-50',  icon: TrendingUp },
    { label: 'Vencido',      value: brl(totals.vencido),   color: 'text-red-700',   bg: 'bg-red-50',    icon: AlertCircle },
    { label: 'A Vencer',     value: brl(totals.a_vencer),  color: 'text-blue-700',  bg: 'bg-blue-50',   icon: Clock },
    { label: 'Distratos',    value: brl(totals.distratos), color: 'text-orange-700',bg: 'bg-orange-50', icon: TrendingDown },
    { label: 'Descontos',    value: brl(totals.descontos), color: 'text-purple-700',bg: 'bg-purple-50', icon: TrendingDown },
  ]

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin w-8 h-8 border-4 border-[#1F3864] border-t-transparent rounded-full" />
    </div>
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500">Atualizado às {lastUpdate}</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-green-700 bg-green-50 px-3 py-1.5 rounded-full border border-green-200 font-medium">
          <Zap size={12} /> Sincronização em tempo real
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        {kpis.map(({ label, value, color, bg, icon: Icon }) => (
          <div key={label} className="card p-5">
            <div className="flex items-start justify-between mb-3">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
              <div className={`p-1.5 rounded-lg ${bg}`}><Icon size={16} className={color} /></div>
            </div>
            <p className={`text-xl font-bold ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Contadores */}
      <div className="grid grid-cols-2 gap-4">
        <div className="card p-5">
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Animais</p>
          <p className="text-3xl font-bold text-[#1F3864]">{qtdAnimais}</p>
        </div>
        <div className="card p-5">
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Fornecedores</p>
          <p className="text-3xl font-bold text-[#1F3864]">{qtdFornec}</p>
        </div>
      </div>

      {/* Top animais */}
      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 font-semibold text-gray-800">
          Top Animais por Valor Total
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th className="th w-8">#</th>
                <th className="th">Animal</th>
                <th className="th text-right">Vencido</th>
                <th className="th text-right">Total</th>
                <th className="th text-right w-40">Participação</th>
              </tr>
            </thead>
            <tbody>
              {topAnimais.map((a, i) => (
                <tr key={a.animal_nome} className="hover:bg-gray-50 transition-colors">
                  <td className="td text-gray-400 font-mono">{i + 1}</td>
                  <td className="td font-medium">{a.animal_nome}</td>
                  <td className="td text-right text-red-700 font-medium">{a.vencido > 0 ? brl(a.vencido) : '—'}</td>
                  <td className="td text-right font-bold text-[#1F3864]">{brl(a.total)}</td>
                  <td className="td text-right">
                    <div className="flex items-center justify-end gap-2">
                      <div className="w-20 bg-gray-100 rounded-full h-1.5 flex-shrink-0">
                        <div className="bg-[#2E75B6] h-1.5 rounded-full" style={{ width: `${Math.min((a.total / totals.total) * 100, 100)}%` }} />
                      </div>
                      <span className="text-xs text-gray-500 w-9 text-right">
                        {totals.total > 0 ? ((a.total / totals.total) * 100).toFixed(1) : 0}%
                      </span>
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
