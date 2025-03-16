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

// Update the checkForNewProducts function to focus only on new products and check more products
// export async function checkForNewProducts(
//   webhookUrl: string,
//   limit = 100,
// ): Promise<{
//   success: boolean
//   newProducts: Product[]
//   message: string
//   seenIds?: string[]
// }> {
//   // Prevent concurrent runs
//   if (isRunning) {
//     console.log("Skipping check - another scraping operation is already in progress")
//     return {
//       success: false,
//       newProducts: [],
//       message: "Another scraping operation is already in progress",
//     }
//   }

//   // Implement rate limiting to prevent too frequent calls
//   const now = Date.now()
//   const timeSinceLastRun = now - lastRunTime
//   const MIN_INTERVAL = 30000 // 30 seconds minimum between runs

//   if (timeSinceLastRun < MIN_INTERVAL) {
//     console.log(`Rate limiting - last run was ${timeSinceLastRun}ms ago, minimum interval is ${MIN_INTERVAL}ms`)
//     return {
//       success: false,
//       newProducts: [],
//       message: `Please wait ${Math.ceil((MIN_INTERVAL - timeSinceLastRun) / 1000)} seconds before checking again`,
//     }
//   }

//   try {
//     console.log(`Starting check for new products with limit: ${limit}...`)
//     isRunning = true
//     lastRunTime = now

//     // Fetch the latest products with more retries
//     let data
//     let retryCount = 0
//     const MAX_RETRIES = 3

//     while (retryCount < MAX_RETRIES) {
//       try {
//         console.log(`Fetch attempt ${retryCount + 1} for new products (limit: ${limit})`)
//         data = await fetchProducts({
//           daysBack: 1, // Only look at the last day for truly new products
//           sortBy: "newest",
//           limit: limit, // Use the provided limit parameter
//         })

//         if (data?.posts?.edges) {
//           console.log(`Successfully fetched ${data.posts.edges.length} products on attempt ${retryCount + 1}`)
//           break // Success, exit the retry loop
//         }
//       } catch (fetchError) {
//         console.error(`Fetch attempt ${retryCount + 1} failed:`, fetchError)

//         // If this isn't our last retry, wait before trying again
//         if (retryCount < MAX_RETRIES - 1) {
//           const backoffTime = 5000 * (retryCount + 1)
//           console.log(`Waiting ${backoffTime}ms before retry ${retryCount + 2}`)
//           await new Promise((resolve) => setTimeout(resolve, backoffTime))
//         }
//       }

//       retryCount++
//     }

//     if (!data?.posts?.edges) {
//       console.error("Failed to fetch products after all retry attempts")
//       isRunning = false
//       return {
//         success: false,
//         newProducts: [],
//         message: "Failed to fetch products from Product Hunt API after multiple attempts",
//       }
//     }

//     // Find new products that we haven't seen before
//     const newProducts: Product[] = []
//     console.log(`Checking ${data.posts.edges.length} products against ${seenProductIds.size} known products`)

//     for (const edge of data.posts.edges) {
//       const product = edge.node

//       if (!seenProductIds.has(product.id)) {
//         console.log(`Found new product: ${product.name} (${product.id})`)
//         newProducts.push(product)
//         seenProductIds.add(product.id)
//       }
//     }

//     // If we have new products, extract contact information and send notifications
//     if (newProducts.length > 0) {
//       console.log(`Found ${newProducts.length} new products. Immediately extracting contact information...`)

//       try {
//         // Extract contact info for all new products at once
//         console.log("Starting immediate contact extraction for new products...")
//         const productsWithContacts = await extractContactInfo(newProducts, newProducts.length)
//         console.log(`Successfully extracted contact info for ${productsWithContacts.length} new products`)

//         // Ensure we're using the exact website URL, not redirected ones
//         const optimizedProducts = productsWithContacts.map((product) => {
//           if (product.website && product.exactWebsiteUrl) {
//             return {
//               ...product,
//               website: product.exactWebsiteUrl,
//             }
//           }
//           return product
//         })

//         // Send Discord notifications immediately
//         console.log(`Immediately sending ${optimizedProducts.length} notifications to Discord...`)

//         const notificationPromises = optimizedProducts.map(async (product, index) => {
//           if (webhookUrl) {
//             try {
//               // Minimal staggering to avoid Discord rate limits
//               if (index > 0) {
//                 await new Promise((resolve) => setTimeout(resolve, 200))
//               }

//               console.log(`Sending notification for new product: ${product.name}`)
//               return await sendDiscordNotification(product, webhookUrl)
//             } catch (notifyError) {
//               console.error(`Error sending notification for new product ${product.id}:`, notifyError)
//               return false
//             }
//           }
//           return false
//         })

//         // Wait for all notifications to complete
//         const notificationResults = await Promise.all(notificationPromises)
//         const notificationsSent = notificationResults.filter(Boolean).length

//         console.log(`Sent ${notificationsSent} notifications for new products to Discord`)
//       } catch (extractError) {
//         console.error("Error during contact extraction for new products:", extractError)

//         // Even if extraction fails, try to send basic notifications
//         console.log("Falling back to basic product data for notifications...")

//         const fallbackPromises = newProducts.map(async (product, index) => {
//           if (webhookUrl) {
//             try {
//               if (index > 0) {
//                 await new Promise((resolve) => setTimeout(resolve, 200))
//               }
//               return await sendDiscordNotification(product, webhookUrl)
//             } catch (notifyError) {
//               console.error(`Error sending fallback notification for new product ${product.id}:`, notifyError)
//               return false
//             }
//           }
//           return false
//         })

//         const fallbackResults = await Promise.all(fallbackPromises)
//         const fallbackNotificationsSent = fallbackResults.filter(Boolean).length

//         console.log(`Sent ${fallbackNotificationsSent} fallback notifications for new products to Discord`)
//       }
//     } else {
//       console.log("No new products found in this check")
//     }

//     // Limit the size of seenProductIds to prevent memory issues
//     if (seenProductIds.size > 1000) {
//       // Convert to array, keep only the most recent 500
//       const productIdsArray = Array.from(seenProductIds)
//       seenProductIds = new Set(productIdsArray.slice(productIdsArray.length - 500))
//       console.log(`Trimmed seenProductIds to ${seenProductIds.size} entries to prevent memory issues`)
//     }

//     console.log("Check for new products completed successfully")
//     isRunning = false
//     return {
//       success: true,
//       newProducts,
//       message:
//         newProducts.length > 0
//           ? `Found and scraped ${newProducts.length} new products with contact information`
//           : "No new products found",
//       seenIds: Array.from(seenProductIds), // Return the updated list of seen IDs
//     }
//   } catch (error) {
//     console.error("Error checking for new products:", error)
//     isRunning = false
//     return {
//       success: false,
//       newProducts: [],
//       message: `Error checking for new products: ${error.message}`,
//     }
//   }
// }

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

  // Fetch newest products
  const products = await fetchNewProducts(limit)
  console.log(`Fetched ${products.length} products`)

  // Filter out products we've already seen
  const newProducts = products.filter((product) => !scrapedProductIds.has(product.id))
  console.log(`Found ${newProducts.length} new products (${products.length - newProducts.length} already seen)`)

  // Process the new products to extract contact information
  const productsWithContacts = await extractContactInfo(newProducts, newProducts.length)

  // Update our set of scraped product IDs
  productsWithContacts.forEach((product) => {
    scrapedProductIds.add(product.id)
  })

  // Send Discord notifications if enabled
  if (notifyDiscord && productsWithContacts.length > 0 && webhookUrl) {
    try {
      await sendDiscordNotification(
        productsWithContacts.filter(
          (p) => (p.emails && p.emails.length > 0) || (p.twitterHandles && p.twitterHandles.length > 0),
        ),
        webhookUrl,
      )
    } catch (error) {
      console.error("Error sending Discord notification:", error)
    }
  }

  return {
    newProducts: productsWithContacts,
    alreadyScrapedCount: products.length - newProducts.length,
    totalChecked: products.length,
  }
}

export function resetScrapedProducts(): void {
  const previousCount = scrapedProductIds.size
  scrapedProductIds = new Set<string>()
  console.log(`Reset scraped products cache. Cleared ${previousCount} product IDs.`)
}

