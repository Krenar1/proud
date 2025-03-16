import { NextResponse } from "next/server"
import { runAutoScraperJob } from "@/lib/scheduled-jobs"

// This endpoint will be called by a cron job service (like Vercel Cron)
export async function GET(request: Request) {
  try {
    // Verify the request is authorized (you can add a secret token check here)
    const url = new URL(request.url)
    const token = url.searchParams.get("token")

    // Simple authorization check - in production, use a more secure method
    if (token !== process.env.CRON_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Run the auto-scraper job
    const result = await runAutoScraperJob()

    return NextResponse.json(result)
  } catch (error) {
    console.error("Error in cron API route:", error)
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

