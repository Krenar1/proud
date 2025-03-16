import { NextResponse } from "next/server"
import { checkForNewProducts } from "@/actions/auto-scraper"
import fs from "fs"
import path from "path"

// Simple file-based storage
const SETTINGS_FILE = path.join(process.cwd(), "data", "settings.json")

// Make sure the data directory exists
try {
  fs.mkdirSync(path.join(process.cwd(), "data"), { recursive: true })
} catch (error) {
  // Directory already exists or cannot be created
}

// Function to get settings
function getSettings() {
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      const data = fs.readFileSync(SETTINGS_FILE, "utf8")
      return JSON.parse(data)
    }
    return null
  } catch (error) {
    console.error("Error reading settings:", error)
    return null
  }
}

// This endpoint can be called by a cron job or external service
export async function GET(request: Request) {
  try {
    // Get the webhook URL from the query parameters
    const url = new URL(request.url)
    const webhookUrl = url.searchParams.get("webhookUrl")
    const token = url.searchParams.get("token")

    // Check if the token matches the CRON_SECRET
    if (token !== process.env.CRON_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // If no webhook URL is provided, try to get it from settings
    let finalWebhookUrl = webhookUrl
    if (!finalWebhookUrl) {
      const settings = getSettings()
      if (settings && settings.discordWebhook) {
        finalWebhookUrl = settings.discordWebhook
      }
    }

    if (!finalWebhookUrl) {
      return NextResponse.json(
        { success: false, message: "No webhook URL provided or found in settings" },
        { status: 400 },
      )
    }

    // Check for new products and send notifications
    const result = await checkForNewProducts(50, true, finalWebhookUrl)

    return NextResponse.json(result)
  } catch (error) {
    console.error("Error in auto-scraper API route:", error)
    return NextResponse.json({ success: false, message: `Server error: ${error.message}` }, { status: 500 })
  }
}

