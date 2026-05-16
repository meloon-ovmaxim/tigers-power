import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Tigers Power',
  description: 'Твой тренировочный дневник',
  manifest: '/manifest.json',
  themeColor: '#E8521A',
  viewport: 'width=device-width, initial-scale=1, maximum-scale=1',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body>
        <div id="app-shell">
          {children}
        </div>
      </body>
    </html>
  )
}
