'use client'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { brl } from '@/lib/format'
import { TrendingUp, TrendingDown, Clock, AlertCircle, Zap, Horse } from 'lucide-react'
import type { Lancamento } from '@/lib/types'

interface Totals {
  pago: number; vencido: number; a_vencer: number; distratos: number; descontos: number; total: number
}
interface AnimalTop { animal_nome: string; total: number; vencido: number }

function KpiCard({ label, value, icon: Icon, color }: { label: string; value: string; icon: React.ElementType; color: string }) {
  return (
    <div className="card p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
          <p className={`text-2xl font-bold mt-1 ${color}`}>{value}</p>
        </div>
        <div className={`p-2 rounded-lg bg-gray-50`}>
          <Icon size={20} className={color} />
        </div>
      </div>
    </div>
  )
}

export default function Dashboard() {
  const supabase = createClient()
  const [totals, setTotals] = useState<Totals>({ pago:0, vencido:0, a_vencer:0, distratos:0, descontos:0, total:0 })
  const [topAnimais, setTopAnimais] = useState<AnimalTop[]>([])
  const [qtdAnimais, setQtdAnimais] = useState(0)
  const [qtdFornec, setQtdFornec]   = useState(0)
  const [loading, setLoading] = useState(true)
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date())

  const load = useCallback(async () => {
    const { data } = await supabase.from('lancamentos').select('animal_nome, situacao, valor, na_listagem')
    if (!data) return

    const t: Totals = { pago:0, vencido:0, a_vencer:0, distratos:0, descontos:0, total:0 }
    const byAnimal: Record<string, AnimalTop> = {}

    data.forEach((l: { animal_nome: string; situacao: string; valor: number; na_listagem: boolean }) => {
      const v = Number(l.valor) || 0
      t.total += v
      if (l.situacao === 'PAGO')     t.pago     += v
      if (l.situacao === 'VENCIDO')  t.vencido  += v
      if (l.situacao === 'A_VENCER') t.a_vencer += v
      if (l.situacao === 'DISTRATOS') t.distratos += v
      if (l.situacao === 'DESCONTOS') t.descontos += v

      if (!byAnimal[l.animal_nome]) byAnimal[l.animal_nome] = { animal_nome: l.animal_nome, total: 0, vencido: 0 }
      byAnimal[l.animal_nome].total   += v
      if (l.situacao === 'VENCIDO') byAnimal[l.animal_nome].vencido += v
    })

    setTotals(t)
    setTopAnimais(Object.values(byAnimal).sort((a, b) => b.total - a.total).slice(0, 10))
    setLastUpdate(new Date())
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    load()

    const { data: { subscription: q1 } } = supabase.from('animais').select('id', { count: 'exact', head: true })
      .then(({ count }) => { if (count !== null) setQtdAnimais(count) }) as unknown as { data: { subscription: { unsubscribe: () => void } } }

    supabase.from('animais').select('id', { count: 'exact', head: true })
      .then(({ count }) => { if (count !== null) setQtdAnimais(count) })
    supabase.from('fornecedores').select('id', { count: 'exact', head: true })
      .then(({ count }) => { if (count !== null) setQtdFornec(count) })

    // Realtime — qualquer mudança em lancamentos atualiza o dashboard
    const channel = supabase
      .channel('dashboard')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lancamentos' }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'animais' }, () => {
        supabase.from('animais').select('id', { count: 'exact', head: true })
          .then(({ count }) => { if (count !== null) setQtdAnimais(count) })
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [load, supabase])

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin w-8 h-8 border-4 border-brand-800 border-t-transparent rounded-full" />
    </div>
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">
            Atualizado em {lastUpdate.toLocaleTimeString('pt-BR')} &bull; Sincronização em tempo real ativa
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-green-600 bg-green-50 px-3 py-1.5 rounded-full border border-green-200">
          <Zap size={12} />
          Live
        </div>
      </div>

      {/* KPIs principais */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <KpiCard label="Total Geral"  value={brl(totals.total)}     icon={TrendingUp}   color="text-brand-800" />
        <KpiCard label="Pago"         value={brl(totals.pago)}      icon={TrendingUp}   color="text-green-700" />
        <KpiCard label="Vencido"      value={brl(totals.vencido)}   icon={AlertCircle}  color="text-red-700" />
        <KpiCard label="A Vencer"     value={brl(totals.a_vencer)}  icon={Clock}        color="text-blue-700" />
        <KpiCard label="Distratos"    value={brl(totals.distratos)} icon={TrendingDown} color="text-orange-700" />
        <KpiCard label="Descontos"    value={brl(totals.descontos)} icon={TrendingDown} color="text-purple-700" />
      </div>

      {/* Contadores */}
      <div className="grid grid-cols-2 gap-4">
        <div className="card p-5 flex items-center gap-4">
          <div className="p-3 bg-brand-50 rounded-xl">
            <Horse size={24} className="text-brand-800" />
          </div>
          <div>
            <p className="text-3xl font-bold text-brand-800">{qtdAnimais}</p>
            <p className="text-sm text-gray-500">Animais cadastrados</p>
          </div>
        </div>
        <div className="card p-5 flex items-center gap-4">
          <div className="p-3 bg-brand-50 rounded-xl">
            <AlertCircle size={24} className="text-brand-800" />
          </div>
          <div>
            <p className="text-3xl font-bold text-brand-800">{qtdFornec}</p>
            <p className="text-sm text-gray-500">Fornecedores</p>
          </div>
        </div>
      </div>

      {/* Top animais */}
      <div className="card">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-800">Top 10 Animais por Valor Total</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th className="th">#</th>
                <th className="th">Animal</th>
                <th className="th text-right">Vencido</th>
                <th className="th text-right">Total</th>
                <th className="th text-right">% do total</th>
              </tr>
            </thead>
            <tbody>
              {topAnimais.map((a, i) => (
                <tr key={a.animal_nome} className="hover:bg-gray-50 transition-colors">
                  <td className="td w-8 text-gray-400 font-mono">{i + 1}</td>
                  <td className="td font-medium">{a.animal_nome}</td>
                  <td className="td text-right text-red-700 font-medium">{a.vencido > 0 ? brl(a.vencido) : '—'}</td>
                  <td className="td text-right font-semibold text-brand-800">{brl(a.total)}</td>
                  <td className="td text-right text-gray-500">
                    <div className="flex items-center justify-end gap-2">
                      <div className="w-24 bg-gray-100 rounded-full h-1.5">
                        <div
                          className="bg-brand-600 h-1.5 rounded-full"
                          style={{ width: `${Math.min((a.total / totals.total) * 100, 100)}%` }}
                        />
                      </div>
                      <span className="text-xs w-10">
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
