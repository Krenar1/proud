import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { runAutoScraperJob } from "@/lib/scheduled-jobs"

export async function GET() {
  try {
    // Get the current active settings
    const settings = await prisma.scraperSettings.findFirst({
      where: { active: true },
      orderBy: { updatedAt: "desc" },
    })

    // Get the latest logs
    const logs = await prisma.scraperLog.findMany({
      take: 10,
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json({ settings, logs })
  } catch (error) {
    console.error("Error fetching scraper settings:", error)
    return NextResponse.json({ error: "Failed to fetch scraper settings" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const data = await request.json()

    // Validate the data
    if (typeof data.enabled !== "boolean") {
      return NextResponse.json({ error: "Invalid settings: 'enabled' must be a boolean" }, { status: 400 })
    }

    // Deactivate all current settings
    await prisma.scraperSettings.updateMany({
      where: { active: true },
      data: { active: false },
    })

    // Create new settings
    const newSettings = await prisma.scraperSettings.create({
      data: {
        enabled: data.enabled,
        interval: data.interval || 30,
        numProductsToCheck: data.numProductsToCheck || 50,
        discordWebhook: data.discordWebhook || null,
        notifyDiscord: data.notifyDiscord || false,
        deepScanEnabled: data.deepScanEnabled ?? true,
        obfuscationEnabled: data.obfuscationEnabled ?? true,
        socialMediaEnabled: data.socialMediaEnabled ?? true,
        autoRetryEnabled: data.autoRetryEnabled ?? true,
        active: true,
      },
    })

    // If enabled, run the scraper job immediately
    if (data.enabled && data.runImmediately) {
      // Run in the background without waiting
      runAutoScraperJob().catch(console.error)
    }

    return NextResponse.json({ success: true, settings: newSettings })
  } catch (error) {
    console.error("Error saving scraper settings:", error)
    return NextResponse.json({ error: "Failed to save scraper settings" }, { status: 500 })
  }
}

