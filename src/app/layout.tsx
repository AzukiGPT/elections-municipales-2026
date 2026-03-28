import type { Metadata } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: "Municipales 2026 - Résultats du 1er tour",
  description: "Carte interactive des résultats des élections municipales 2026",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="fr">
      <body className="antialiased">{children}</body>
    </html>
  )
}
