import type React from "react"
import "./globals.css"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import { ThemeProvider } from "@/components/theme-provider"
import { Navbar } from "@/components/navbar"
import { Toaster } from "@/components/ui/toaster"
import { UnresponsiveHandler } from "@/components/unresponsive-handler"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "Product Hunt Scraper",
  description: "Discover and analyze the latest products from Product Hunt",
    generator: 'v0.dev'
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <Navbar />
          {children}
          <UnresponsiveHandler />
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  )
}



import './globals.css'