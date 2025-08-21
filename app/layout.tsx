import type React from "react"
import type { Metadata } from "next"
import { Geist, Manrope } from "next/font/google"
import "./globals.css"
import { Toaster } from "@/components/ui/toaster"

const geist = Geist({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-geist",
})

const manrope = Manrope({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-manrope",
})

export const metadata: Metadata = {
  title: "KETIlabel - AI-Powered Image Labeling Tool",
  description: "Professional image annotation and labeling tool powered by SAM2 AI technology",
    generator: 'v0.app'
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`${geist.variable} ${manrope.variable} antialiased`}>
      <body className="font-sans">
        {children}
        <Toaster />
      </body>
    </html>
  )
}
