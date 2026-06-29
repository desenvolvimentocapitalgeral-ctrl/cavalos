'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { BarChart3, Horse, Users, DollarSign, FileSearch, Menu, X } from 'lucide-react'
import { useState } from 'react'

const links = [
  { href: '/',               label: 'Dashboard',    icon: BarChart3 },
  { href: '/animais',        label: 'Animais',      icon: Horse },
  { href: '/financeiro',     label: 'Financeiro',   icon: DollarSign },
  { href: '/fornecedores',   label: 'Fornecedores', icon: Users },
  { href: '/auditoria',      label: 'Auditoria',    icon: FileSearch },
]

export default function Nav() {
  const path = usePathname()
  const [open, setOpen] = useState(false)

  return (
    <header className="bg-brand-800 text-white shadow-lg">
      <div className="max-w-screen-2xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-lg font-bold">
              🐴
            </div>
            <span className="font-bold text-lg tracking-tight">Haras Monte Sião</span>
          </div>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-1">
            {links.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  path === href
                    ? 'bg-white/20 text-white'
                    : 'text-white/70 hover:text-white hover:bg-white/10'
                }`}
              >
                <Icon size={16} />
                {label}
              </Link>
            ))}
          </nav>

          {/* Mobile toggle */}
          <button
            className="md:hidden p-2 rounded-lg hover:bg-white/10"
            onClick={() => setOpen(!open)}
          >
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        {/* Mobile menu */}
        {open && (
          <nav className="md:hidden pb-4 flex flex-col gap-1">
            {links.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium ${
                  path === href
                    ? 'bg-white/20 text-white'
                    : 'text-white/70 hover:text-white hover:bg-white/10'
                }`}
              >
                <Icon size={16} />
                {label}
              </Link>
            ))}
          </nav>
        )}
      </div>
    </header>
  )
}
