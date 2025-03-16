import { NextResponse } from "next/server"
import { runAutoScraperJob } from "@/lib/scheduled-jobs"

export async function POST() {
  try {
    // Run the auto-scraper job
    const result = await runAutoScraperJob()

    return NextResponse.json(result)
  } catch (error) {
    console.error("Error running auto-scraper manually:", error)
    return NextResponse.json(
      {
        success: false,
        message: "Error running auto-scraper job",
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    )
  }
}

