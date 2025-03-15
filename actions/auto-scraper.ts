"use server"

import { fetchProducts } from "./fetch-products"
import { sendDiscordNotification } from "./discord-webhook"
import { extractContactInfo } from "./extract-contacts"
import type { Product } from "@/types/product"

// In-memory storage for tracking seen products
// This will be synced with localStorage on the client side
let seenProductIds = new Set<string>()
let lastRunTime = 0
let isRunning = false

// Function to save seen product IDs to localStorage (will be called from client component)
export async function saveSeenProductIds(ids: string[]): Promise<boolean> {
  try {
    // This is just a server-side function that will be called from the client
    // The actual saving happens in the client component
    return true
  } catch (error) {
    console.error("Error in saveSeenProductIds server function:", error)
    return false
  }
}

// Function to load seen product IDs (will be called from client component)
export async function loadSeenProductIds(ids: string[]): Promise<boolean> {
  try {
    // Update the in-memory set with the IDs from localStorage
    seenProductIds = new Set(ids)
    console.log(`Loaded ${seenProductIds.size} product IDs from persistent storage`)
    return true
  } catch (error) {
    console.error("Error in loadSeenProductIds server function:", error)
    return false
  }
}

// Add this new function after the loadSeenProductIds function:

// Function to initialize with products from a specific time range
export async function initializeWithTimeRange(
  webhookUrl: string,
  daysBack: number,
): Promise<{
  success: boolean
  message: string
  seenIds?: string[]
  productsCount?: number
}> {
  try {
    // Check if webhook URL is valid
    if (!webhookUrl || !webhookUrl.includes("discord.com/api/webhooks")) {
      return {
        success: false,
        message: "Invalid Discord webhook URL. Please provide a valid Discord webhook URL.",
      }
    }

    // Clear existing seen product IDs
    seenProductIds = new Set<string>()

    console.log(`Initializing auto-scraper with products from the last ${daysBack} days...`)

    // Fetch in batches to get all products from the specified time range
    let hasMore = true
    let cursor = undefined
    let totalProducts = 0
    let batchCount = 0
    const MAX_BATCHES = 10 // Limit to prevent excessive API calls

    while (hasMore && batchCount < MAX_BATCHES) {
      batchCount++
      const batchProducts = await fetchProducts(
        {
          daysBack,
          sortBy: "newest",
          limit: 50,
        },
        cursor,
      )

      if (!batchProducts?.posts?.edges || batchProducts.posts.edges.length === 0) {
        break
      }

      batchProducts.posts.edges.forEach((edge) => {
        seenProductIds.add(edge.node.id)
      })

      totalProducts += batchProducts.posts.edges.length
      cursor = batchProducts.posts.pageInfo.endCursor
      hasMore = batchProducts.posts.pageInfo.hasNextPage

      // Avoid rate limiting
      if (hasMore) {
        await new Promise((resolve) => setTimeout(resolve, 1000))
      }
    }

    console.log(`Initialized auto-scraper with ${seenProductIds.size} products from the last ${daysBack} days`)

    // Return the seen product IDs so they can be saved to localStorage
    return {
      success: true,
      message: `Auto-scraper initialized successfully. Tracking ${seenProductIds.size} products from the last ${daysBack} days.`,
      seenIds: Array.from(seenProductIds),
      productsCount: totalProducts,
    }
  } catch (error) {
    console.error(`Error initializing auto-scraper with time range (${daysBack} days):`, error)
    return {
      success: false,
      message: `Failed to initialize auto-scraper: ${error.message}`,
    }
  }
}

// Function to initialize with only today's products
export async function initializeWithTodayOnly(webhookUrl: string): Promise<{
  success: boolean
  message: string
  seenIds?: string[]
}> {
  try {
    // Check if webhook URL is valid
    if (!webhookUrl || !webhookUrl.includes("discord.com/api/webhooks")) {
      return {
        success: false,
        message: "Invalid Discord webhook URL. Please provide a valid Discord webhook URL.",
      }
    }

    // Clear existing seen product IDs
    seenProductIds = new Set<string>()

    console.log("Initializing auto-scraper with today's products only...")

    // Fetch today's products
    const todayProducts = await fetchProducts({
      daysBack: 1,
      sortBy: "newest",
      limit: 50,
    })

    if (todayProducts?.posts?.edges) {
      todayProducts.posts.edges.forEach((edge) => {
        seenProductIds.add(edge.node.id)
      })
    }

    console.log(`Initialized auto-scraper with ${seenProductIds.size} products from today`)

    // Return the seen product IDs so they can be saved to localStorage
    return {
      success: true,
      message: `Auto-scraper initialized successfully. Tracking ${seenProductIds.size} products from today.`,
      seenIds: Array.from(seenProductIds),
    }
  } catch (error) {
    console.error("Error initializing auto-scraper with today's products:", error)
    return {
      success: false,
      message: `Failed to initialize auto-scraper: ${error.message}`,
    }
  }
}

// Get the current seen product IDs
export async function getSeenProductIds(): Promise<string[]> {
  return Array.from(seenProductIds)
}

export async function initializeAutoScraper(webhookUrl: string): Promise<{
  success: boolean
  message: string
  seenIds?: string[]
}> {
  try {
    // Check if webhook URL is valid
    if (!webhookUrl || !webhookUrl.includes("discord.com/api/webhooks")) {
      return {
        success: false,
        message: "Invalid Discord webhook URL. Please provide a valid Discord webhook URL.",
      }
    }

    // Initialize with products from the last 7 days to avoid sending notifications for existing products
    console.log("Initializing auto-scraper with products from the last 7 days...")

    // Fetch in batches to get all products from the last 7 days
    let hasMore = true
    let cursor = undefined
    let totalProducts = 0

    while (hasMore) {
      const batchProducts = await fetchProducts(
        {
          daysBack: 7,
          sortBy: "newest",
          limit: 50,
        },
        cursor,
      )

      if (!batchProducts?.posts?.edges || batchProducts.posts.edges.length === 0) {
        break
      }

      batchProducts.posts.edges.forEach((edge) => {
        seenProductIds.add(edge.node.id)
      })

      totalProducts += batchProducts.posts.edges.length
      cursor = batchProducts.posts.pageInfo.endCursor
      hasMore = batchProducts.posts.pageInfo.hasNextPage

      // Avoid rate limiting
      if (hasMore) {
        await new Promise((resolve) => setTimeout(resolve, 1000))
      }
    }

    console.log(`Initialized auto-scraper with ${seenProductIds.size} recent products from the last 7 days`)

    // Return the seen product IDs so they can be saved to localStorage
    return {
      success: true,
      message: `Auto-scraper initialized successfully. Tracking ${seenProductIds.size} products from the last 7 days.`,
      seenIds: Array.from(seenProductIds),
    }
  } catch (error) {
    console.error("Error initializing auto-scraper:", error)
    return {
      success: false,
      message: `Failed to initialize auto-scraper: ${error.message}`,
    }
  }
}

// Update the checkForNewProducts function to ensure we're saving the exact website URL
export async function checkForNewProducts(webhookUrl: string): Promise<{
  success: boolean
  newProducts: Product[]
  message: string
  seenIds?: string[]
}> {
  // Prevent concurrent runs
  if (isRunning) {
    console.log("Skipping check - another scraping operation is already in progress")
    return {
      success: false,
      newProducts: [],
      message: "Another scraping operation is already in progress",
    }
  }

  // Implement rate limiting to prevent too frequent calls
  const now = Date.now()
  const timeSinceLastRun = now - lastRunTime
  const MIN_INTERVAL = 30000 // 30 seconds minimum between runs (reduced from 60s)

  if (timeSinceLastRun < MIN_INTERVAL) {
    console.log(`Rate limiting - last run was ${timeSinceLastRun}ms ago, minimum interval is ${MIN_INTERVAL}ms`)
    return {
      success: false,
      newProducts: [],
      message: `Please wait ${Math.ceil((MIN_INTERVAL - timeSinceLastRun) / 1000)} seconds before checking again`,
    }
  }

  try {
    console.log("Starting check for new products...")
    isRunning = true
    lastRunTime = now

    // Fetch the latest products with more retries
    let data
    let retryCount = 0
    const MAX_RETRIES = 3

    while (retryCount < MAX_RETRIES) {
      try {
        console.log(`Fetch attempt ${retryCount + 1} for new products`)
        data = await fetchProducts({
          daysBack: 1,
          sortBy: "newest",
          limit: 20,
        })

        if (data?.posts?.edges) {
          console.log(`Successfully fetched ${data.posts.edges.length} products on attempt ${retryCount + 1}`)
          break // Success, exit the retry loop
        }
      } catch (fetchError) {
        console.error(`Fetch attempt ${retryCount + 1} failed:`, fetchError)

        // If this isn't our last retry, wait before trying again
        if (retryCount < MAX_RETRIES - 1) {
          const backoffTime = 5000 * (retryCount + 1)
          console.log(`Waiting ${backoffTime}ms before retry ${retryCount + 2}`)
          await new Promise((resolve) => setTimeout(resolve, backoffTime))
        }
      }

      retryCount++
    }

    if (!data?.posts?.edges) {
      console.error("Failed to fetch products after all retry attempts")
      isRunning = false
      return {
        success: false,
        newProducts: [],
        message: "Failed to fetch products from Product Hunt API after multiple attempts",
      }
    }

    // Find new products that we haven't seen before
    const newProducts: Product[] = []
    console.log(`Checking ${data.posts.edges.length} products against ${seenProductIds.size} known products`)

    for (const edge of data.posts.edges) {
      const product = edge.node

      if (!seenProductIds.has(product.id)) {
        console.log(`Found new product: ${product.name} (${product.id})`)
        newProducts.push(product)
        seenProductIds.add(product.id)
      }
    }

    // If we have new products, extract contact information and send notifications
    if (newProducts.length > 0) {
      console.log(`Found ${newProducts.length} new products. Extracting contact information...`)

      // Process products in batches to extract contact information
      let productsWithContacts: Product[] = []

      try {
        // Make sure we're actually extracting contact info for all new products
        console.log("Starting contact extraction for new products...")
        productsWithContacts = await extractContactInfo(newProducts, newProducts.length)
        console.log(`Successfully extracted contact info for ${productsWithContacts.length} products`)

        // Ensure we're using the exact website URL, not redirected ones
        productsWithContacts = productsWithContacts.map((product) => {
          if (product.website && product.exactWebsiteUrl) {
            return {
              ...product,
              website: product.exactWebsiteUrl,
            }
          }
          return product
        })
      } catch (extractError) {
        console.error("Error extracting contact info, continuing with basic product data:", extractError)
        productsWithContacts = newProducts // Fall back to basic product data
      }

      // Send Discord notification for each new product with contact info
      let notificationsSent = 0

      console.log(`Attempting to send ${productsWithContacts.length} notifications to Discord...`)
      for (const product of productsWithContacts) {
        if (webhookUrl) {
          try {
            console.log(`Sending notification for product: ${product.name}`)
            const sent = await sendDiscordNotification(product, webhookUrl)
            if (sent) {
              notificationsSent++
              console.log(`Successfully sent notification for ${product.name}`)
            } else {
              console.error(`Failed to send notification for ${product.name}`)
            }

            // Add a small delay between notifications to avoid rate limiting
            await new Promise((resolve) => setTimeout(resolve, 1000))
          } catch (notifyError) {
            console.error(`Error sending notification for product ${product.id}:`, notifyError)
            // Continue with next product even if this one fails
          }
        }
      }

      console.log(`Sent ${notificationsSent} notifications to Discord`)
    } else {
      console.log("No new products found in this check")
    }

    // Limit the size of seenProductIds to prevent memory issues
    if (seenProductIds.size > 1000) {
      // Convert to array, keep only the most recent 500
      const productIdsArray = Array.from(seenProductIds)
      seenProductIds = new Set(productIdsArray.slice(productIdsArray.length - 500))
      console.log(`Trimmed seenProductIds to ${seenProductIds.size} entries to prevent memory issues`)
    }

    console.log("Check for new products completed successfully")
    isRunning = false
    return {
      success: true,
      newProducts,
      message:
        newProducts.length > 0
          ? `Found ${newProducts.length} new products with contact information`
          : "No new products found",
      seenIds: Array.from(seenProductIds), // Return the updated list of seen IDs
    }
  } catch (error) {
    console.error("Error checking for new products:", error)
    isRunning = false
    return {
      success: false,
      newProducts: [],
      message: `Error checking for new products: ${error.message}`,
    }
  }
}

