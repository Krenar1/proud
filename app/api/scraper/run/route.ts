import { NextResponse } from "next/server"
import { runAutoScraperJob } from "@/lib/scheduled-jobs"
import { initializeStorage } from "@/lib/file-storage"

export async function POST() {
  try {
    // Ensure storage is initialized
    initializeStorage()

    console.log("Manual scraper run triggered")

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

