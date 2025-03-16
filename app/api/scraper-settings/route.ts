import { NextResponse } from "next/server"
import { getSettings, saveSettings, getLogs } from "@/lib/file-storage"
import { runAutoScraperJob } from "@/lib/scheduled-jobs"

export async function GET() {
  try {
    // Get the current settings
    const settings = getSettings()

    // Get the latest logs
    const logs = getLogs()

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

    // Get current settings
    const currentSettings = getSettings() || {}

    // Create new settings by merging with current settings
    const newSettings = {
      ...currentSettings,
      enabled: data.enabled,
      interval: data.interval || 30,
      numProductsToCheck: data.numProductsToCheck || 50,
      discordWebhook: data.discordWebhook || null,
      notifyDiscord: data.notifyDiscord || false,
      deepScanEnabled: data.deepScanEnabled ?? true,
      obfuscationEnabled: data.obfuscationEnabled ?? true,
      socialMediaEnabled: data.socialMediaEnabled ?? true,
      autoRetryEnabled: data.autoRetryEnabled ?? true,
    }

    // Save the settings
    saveSettings(newSettings)

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

