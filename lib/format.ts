export function brl(value: number | null | undefined): string {
  if (!value || value === 0) return '—'
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

export function sitLabel(sit: string): string {
  const map: Record<string, string> = {
    PAGO: 'Pago',
    VENCIDO: 'Vencido',
    A_VENCER: 'A Vencer',
    DISTRATOS: 'Distratos',
    DESCONTOS: 'Descontos',
    ATIVO: 'Ativo',
    NEGOCIAR: 'Negociar',
    CANCELADA: 'Cancelada',
    VENDIDA: 'Vendida',
    DEVOLVIDA: 'Devolvida',
  }
  return map[sit] ?? sit
}

export function sitColor(sit: string): string {
  const map: Record<string, string> = {
    PAGO: 'bg-green-100 text-green-800',
    VENCIDO: 'bg-red-100 text-red-800',
    A_VENCER: 'bg-blue-100 text-blue-800',
    DISTRATOS: 'bg-orange-100 text-orange-800',
    DESCONTOS: 'bg-purple-100 text-purple-800',
    ATIVO: 'bg-green-100 text-green-800',
    NEGOCIAR: 'bg-yellow-100 text-yellow-800',
    CANCELADA: 'bg-gray-100 text-gray-600',
    VENDIDA: 'bg-blue-100 text-blue-800',
    DEVOLVIDA: 'bg-orange-100 text-orange-800',
  }
  return map[sit] ?? 'bg-gray-100 text-gray-700'
}
