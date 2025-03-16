import { NextResponse } from "next/server"
import { runAutoScraperJob } from "@/lib/scheduled-jobs"
import { getSettings, saveSettings, initializeStorage } from "@/lib/file-storage"

export async function GET(request: Request) {
  try {
    // Ensure storage is initialized
    initializeStorage()

    // Verify the request is authorized
    const url = new URL(request.url)
    const token = url.searchParams.get("token")

    // Check if the token matches the CRON_SECRET
    if (token !== process.env.CRON_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Get current settings
    const settings = getSettings()

    // Check if the scraper is enabled
    if (!settings.enabled) {
      return NextResponse.json({ message: "Auto-scraper is disabled" })
    }

    // Check if it's time to run the scraper
    const now = new Date()
    const lastRunAt = settings.lastRunAt ? new Date(settings.lastRunAt) : null
    const intervalMinutes = settings.interval || 30

    // If lastRunAt is null or the interval has passed, run the scraper
    if (!lastRunAt || now.getTime() - lastRunAt.getTime() > intervalMinutes * 60 * 1000) {
      console.log("Running auto-scraper job...")

      // Run the scraper
      const result = await runAutoScraperJob()

      // Update the last run time
      settings.lastRunAt = now.toISOString()
      saveSettings(settings)

      return NextResponse.json(result)
    }

    return NextResponse.json({ message: "Not time to run yet" })
  } catch (error) {
    console.error("Error in cron check API route:", error)
    return NextResponse.json(
      {
        success: false,
        message: "Error checking auto-scraper schedule",
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    )
  }
}

