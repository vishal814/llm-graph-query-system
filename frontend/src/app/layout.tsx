import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Neo4j Graph Chat',
  description: 'Chat with Graph Data',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
