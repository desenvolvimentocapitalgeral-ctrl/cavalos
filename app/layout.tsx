import type { Metadata } from 'next'
import './globals.css'
import Nav from '@/components/nav'

export const metadata: Metadata = {
  title: 'Haras Monte Sião',
  description: 'Gestão financeira e inventário de animais',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        <div className="min-h-screen flex flex-col">
          <Nav />
          <main className="flex-1 max-w-screen-2xl mx-auto w-full px-4 py-6">
            {children}
          </main>
          <footer className="text-center text-xs text-gray-400 py-4 border-t border-gray-100">
            Haras Monte Sião &mdash; Sistema de Gestão
          </footer>
        </div>
      </body>
    </html>
  )
}
