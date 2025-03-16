import { NextResponse } from "next/server"
import { resetScrapedProducts } from "@/actions/auto-scraper"
import fs from "fs"
import path from "path"

// Simple file-based storage
const LOGS_FILE = path.join(process.cwd(), "data", "logs.json")

// Make sure the data directory exists
try {
  fs.mkdirSync(path.join(process.cwd(), "data"), { recursive: true })
} catch (error) {
  // Directory already exists or cannot be created
}

// Function to add a log
function addLog(log) {
  try {
    let logs = []
    if (fs.existsSync(LOGS_FILE)) {
      logs = JSON.parse(fs.readFileSync(LOGS_FILE, "utf8"))
    }

    const newLog = {
      id: Date.now().toString(),
      createdAt: new Date().toISOString(),
      ...log,
    }
    logs.unshift(newLog) // Add to beginning

    // Keep only the last 100 logs
    const trimmedLogs = logs.slice(0, 100)

    fs.writeFileSync(LOGS_FILE, JSON.stringify(trimmedLogs, null, 2))
    return newLog
  } catch (error) {
    console.error("Error adding log:", error)
    return null
  }
}

export async function POST() {
  try {
    // Reset the scraper's in-memory cache
    await resetScrapedProducts()

    // Create a log entry
    addLog({
      success: true,
      message: "Scraper cache reset manually",
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

