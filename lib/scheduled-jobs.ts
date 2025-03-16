import { checkForNewProducts } from "@/actions/auto-scraper"
import { getSettings, saveSettings, addLog } from "@/lib/file-storage"

// In-memory flag to prevent concurrent runs
let isScraperRunning = false

// Function to run the auto-scraper job
export async function runAutoScraperJob(): Promise<{
  success: boolean
  message: string
  newProducts?: number
  error?: string
}> {
  try {
    // Check if the scraper is already running
    if (isScraperRunning) {
      console.log("Auto-scraper job is already running, skipping this run")
      return {
        success: false,
        message: "Auto-scraper job is already running",
      }
    }

    isScraperRunning = true
    console.log("Starting auto-scraper job...")

    // Get the latest settings
    const settings = getSettings()
    console.log("Retrieved settings:", JSON.stringify(settings, null, 2))

    // For manual runs, we'll proceed even if the scraper is disabled
    // We'll just check if we have the necessary settings
    if (!settings) {
      console.error("No settings found, this should not happen with our initialization")
      isScraperRunning = false
      return {
        success: false,
        message: "No settings found. Please check server logs.",
      }
    }

    // Determine how many products to check
    const numProductsToCheck = settings.numProductsToCheck || 50

    // Determine if we should notify Discord
    const notifyDiscord = settings.notifyDiscord || false

    // Get the Discord webhook URL
    const discordWebhook = settings.discordWebhook || undefined

    console.log(
      `Running scraper with: products=${numProductsToCheck}, notify=${notifyDiscord}, webhook=${discordWebhook ? "set" : "not set"}`,
    )

    // Run the scraper with the settings
    const result = await checkForNewProducts(numProductsToCheck, notifyDiscord, discordWebhook)

    // Log the results
    console.log(
      `Auto-scraper job completed: Found ${result.newProducts.length} new products out of ${result.totalChecked} checked`,
    )

    // Update the last run time and stats in the settings
    settings.lastRunAt = new Date().toISOString()
    settings.totalRuns = (settings.totalRuns || 0) + 1
    settings.totalProductsFound = (settings.totalProductsFound || 0) + result.newProducts.length
    settings.totalProductsChecked = (settings.totalProductsChecked || 0) + result.totalChecked
    saveSettings(settings)

    // Create a log entry
    addLog({
      success: true,
      newProductsFound: result.newProducts.length,
      productsChecked: result.totalChecked,
      message: `Found ${result.newProducts.length} new products out of ${result.totalChecked} checked`,
    })

    isScraperRunning = false
    return {
      success: true,
      message: `Auto-scraper job completed successfully`,
      newProducts: result.newProducts.length,
    }
  } catch (error) {
    console.error("Error running auto-scraper job:", error)

    // Create an error log entry
    try {
      addLog({
        success: false,
        newProductsFound: 0,
        productsChecked: 0,
        message: `Error: ${error instanceof Error ? error.message : String(error)}`,
      })
    } catch (logError) {
      console.error("Failed to log error:", logError)
    }

    isScraperRunning = false
    return {
      success: false,
      message: "Error running auto-scraper job",
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

