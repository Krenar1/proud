import { checkForNewProducts } from "@/actions/auto-scraper"
import { prisma } from "@/lib/prisma"

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

    // Get the latest settings from the database
    const settings = await prisma.scraperSettings.findFirst({
      where: { active: true },
      orderBy: { updatedAt: "desc" },
    })

    if (!settings || !settings.enabled) {
      console.log("Auto-scraper is disabled or no settings found")
      isScraperRunning = false
      return {
        success: false,
        message: "Auto-scraper is disabled or no settings found",
      }
    }

    // Run the scraper with the settings
    const result = await checkForNewProducts(
      settings.numProductsToCheck,
      settings.notifyDiscord,
      settings.discordWebhook || undefined,
    )

    // Log the results
    console.log(
      `Auto-scraper job completed: Found ${result.newProducts.length} new products out of ${result.totalChecked} checked`,
    )

    // Update the last run time and stats in the database
    await prisma.scraperSettings.update({
      where: { id: settings.id },
      data: {
        lastRunAt: new Date(),
        totalRuns: { increment: 1 },
        totalProductsFound: { increment: result.newProducts.length },
        totalProductsChecked: { increment: result.totalChecked },
      },
    })

    // Create a log entry
    await prisma.scraperLog.create({
      data: {
        success: true,
        newProductsFound: result.newProducts.length,
        productsChecked: result.totalChecked,
        settingsId: settings.id,
        message: `Found ${result.newProducts.length} new products out of ${result.totalChecked} checked`,
      },
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
      await prisma.scraperLog.create({
        data: {
          success: false,
          newProductsFound: 0,
          productsChecked: 0,
          message: `Error: ${error instanceof Error ? error.message : String(error)}`,
        },
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

