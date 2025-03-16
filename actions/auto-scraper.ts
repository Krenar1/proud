"use server"

import { fetchProducts } from "./fetch-products"
import { sendDiscordNotification } from "./discord-webhook"
import { extractContactInfo } from "./extract-contacts"
import type { Product } from "@/types/product"

// In-memory storage for tracking seen products
// This will be synced with localStorage on the client side
let seenProductIds = new Set<string>()
const lastRunTime = 0
const isRunning = false

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

import { fetchNewProducts } from "./fetch-products"

let scrapedProductIds = new Set<string>()

export async function checkForNewProducts(
  limit = 100, // Increased default limit to 100
  notifyDiscord = true,
  webhookUrl?: string,
): Promise<{
  newProducts: Product[]
  alreadyScrapedCount: number
  totalChecked: number
}> {
  console.log(`Checking for new products with limit: ${limit}`)

  try {
    // Fetch newest products
    const products = await fetchNewProducts(limit)
    console.log(`Fetched ${products.length} products`)

    // Filter out products we've already seen
    const newProducts = products.filter((product) => !scrapedProductIds.has(product.id))
    console.log(`Found ${newProducts.length} new products (${products.length - newProducts.length} already seen)`)

    // Process the new products to extract contact information
    let productsWithContacts: Product[] = []

    try {
      // Process in smaller batches to avoid overwhelming the system
      const BATCH_SIZE = 5
      const batches = []

      for (let i = 0; i < newProducts.length; i += BATCH_SIZE) {
        batches.push(newProducts.slice(i, i + BATCH_SIZE))
      }

      console.log(`Processing ${batches.length} batches of products`)

      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i]
        console.log(`Processing batch ${i + 1}/${batches.length} with ${batch.length} products`)

        try {
          const batchResults = await extractContactInfo(batch, batch.length)
          productsWithContacts = [...productsWithContacts, ...batchResults]

          // Update our set of scraped product IDs for this batch
          batch.forEach((product) => {
            scrapedProductIds.add(product.id)
          })

          // Add a delay between batches to avoid overwhelming the system
          if (i < batches.length - 1) {
            await new Promise((resolve) => setTimeout(resolve, 2000))
          }
        } catch (batchError) {
          console.error(`Error processing batch ${i + 1}:`, batchError)
          // Continue with next batch even if this one failed
          // Still mark these products as processed to avoid retrying immediately
          batch.forEach((product) => {
            scrapedProductIds.add(product.id)
          })
        }
      }
    } catch (error) {
      console.error("Error extracting contact information:", error)
      // Even if extraction fails, mark products as seen to avoid infinite retries
      newProducts.forEach((product) => {
        scrapedProductIds.add(product.id)
      })
      // Return the products without contact info
      productsWithContacts = newProducts
    }

    // Send Discord notifications if enabled
    if (notifyDiscord && productsWithContacts.length > 0 && webhookUrl) {
      try {
        // Only send notifications for products with contact info
        const productsWithContactInfo = productsWithContacts.filter(
          (p) => (p.emails && p.emails.length > 0) || (p.twitterHandles && p.twitterHandles.length > 0),
        )

        if (productsWithContactInfo.length > 0) {
          console.log(`Sending Discord notifications for ${productsWithContactInfo.length} products`)

          // Send notifications one at a time to avoid rate limits
          for (const product of productsWithContactInfo) {
            try {
              await sendDiscordNotification(product, webhookUrl)
              // Small delay between notifications
              await new Promise((resolve) => setTimeout(resolve, 1000))
            } catch (notifyError) {
              console.error(`Error sending notification for product ${product.name}:`, notifyError)
              // Continue with next product
            }
          }
        }
      } catch (error) {
        console.error("Error sending Discord notifications:", error)
      }
    }

    return {
      newProducts: productsWithContacts,
      alreadyScrapedCount: products.length - newProducts.length,
      totalChecked: products.length,
    }
  } catch (error) {
    console.error("Error checking for new products:", error)
    // Return empty result on error
    return {
      newProducts: [],
      alreadyScrapedCount: 0,
      totalChecked: 0,
    }
  }
}

export async function resetScrapedProducts(): Promise<void> {
  const previousCount = scrapedProductIds.size
  scrapedProductIds = new Set<string>()
  console.log(`Reset scraped products cache. Cleared ${previousCount} product IDs.`)
}

