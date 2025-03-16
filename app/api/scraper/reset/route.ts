import { NextResponse } from "next/server"
import { resetScrapedProducts } from "@/actions/auto-scraper"
import { prisma } from "@/lib/prisma"

export async function POST() {
  try {
    // Reset the scraper's in-memory cache
    await resetScrapedProducts()

    // Create a log entry
    await prisma.scraperLog.create({
      data: {
        success: true,
        message: "Scraper cache reset manually",
      },
    })

    return NextResponse.json({ success: true, message: "Scraper cache reset successfully" })
  } catch (error) {
    console.error("Error resetting scraper cache:", error)
    return NextResponse.json(
      {
        success: false,
        message: "Error resetting scraper cache",
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    )
  }
}

