"use server"

import type { ProductsFilter, ProductsResponse } from "@/types/product"

// Update the API key rotation system to be more resilient

// Modify the API_KEYS array to ensure all keys are used properly
const API_KEYS = [
  process.env.PH_TOKEN, // Primary API key
  "jfbexJgsR826-S39rRq7iSgGKU0pH4xrhu8c2F6FY4M", // Secondary API key
  "jBhOwMOxr_g0AjHnInCHFOw31pP_pAIieXggHOB1KBA", // Third reserve API key
].filter(Boolean) // Filter out any undefined or empty keys

// Improve the rate limit tracking with more information
const keyRateLimitStatus = API_KEYS.map(() => ({
  isRateLimited: false,
  resetTime: 0,
  consecutiveFailures: 0,
  lastSuccess: Date.now(),
}))

// Track which API key is currently being used
let currentKeyIndex = 0

// Replace the entire fetchProducts function with this version that bypasses caching
export const fetchProducts = async (
  filter: ProductsFilter = { daysBack: 7, sortBy: "newest", limit: 20 },
  cursor?: string,
) => {
  try {
    console.log(`Fetching products with filter:`, filter, `cursor: ${cursor || "none"}`)

    // Calculate date range
    const endDate = new Date()
    const startDate = new Date()
    startDate.setDate(endDate.getDate() - filter.daysBack)

    console.log(`Date range: ${startDate.toISOString()} to ${endDate.toISOString()}`)
    console.log(`Requested limit: ${filter.limit}`) // Log the requested limit

    // GraphQL query - updated to include thumbnail and website fields
    const query = `
    query GetPosts($postedAfter: DateTime!, $postedBefore: DateTime!, $first: Int!, $after: String) {
      posts(postedAfter: $postedAfter, postedBefore: $postedBefore, first: $first, after: $after) {
        edges {
          node {
            id
            name
            tagline
            description
            url
            votesCount
            website
            thumbnail {
              url
            }
            createdAt
            makers {
              id
              name
              username
              headline
              twitterUsername
            }
          }
        }
        pageInfo {
          endCursor
          hasNextPage
        }
      }
    }
  `

    // Variables for the query - ensure limit is passed as a number
    const variables = {
      postedAfter: startDate.toISOString(),
      postedBefore: endDate.toISOString(),
      first: Number.parseInt(String(filter.limit), 10), // Ensure it's a number
      ...(cursor && { after: cursor }),
    }

    console.log(`GraphQL variables:`, variables) // Log the GraphQL variables

    // Check if we have valid API keys
    if (!API_KEYS[0]) {
      console.error("No valid API keys configured")
      throw new Error("Product Hunt API token is not configured")
    }

    // Try to make the API request with key rotation for rate limiting
    const data = await fetchWithKeyRotation("https://api.producthunt.com/v2/api/graphql", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "User-Agent": "Product Hunt Scraper",
        Origin: "https://www.producthunt.com",
        Referer: "https://www.producthunt.com/",
      },
      body: JSON.stringify({
        query,
        variables,
      }),
      cache: "no-store", // Disable caching
    })

    // Check if the response has the expected structure
    if (!data.data || !data.data.posts) {
      console.error("Unexpected API response structure:", data)
      throw new Error("Unexpected API response structure")
    }

    // Process the response to add imageUrl from thumbnail
    if (data.data.posts.edges) {
      data.data.posts.edges = data.data.posts.edges.map((edge) => {
        if (edge.node.thumbnail && edge.node.thumbnail.url) {
          edge.node.imageUrl = edge.node.thumbnail.url
        }
        return edge
      })
    }

    // Log the number of products found
    const edges = data.data.posts.edges || []
    console.log(`Found ${edges.length} products`)

    return data.data as ProductsResponse
  } catch (error) {
    console.error("Error fetching products:", error)

    // Return empty response structure instead of throwing
    if (error.message && error.message.includes("429")) {
      console.log("Rate limit exceeded, returning empty response")
      return {
        posts: {
          edges: [],
          pageInfo: {
            endCursor: "",
            hasNextPage: false,
          },
        },
      } as ProductsResponse
    }

    throw error
  }
}

// Replace the fetchWithKeyRotation function with this improved version
async function fetchWithKeyRotation(url: string, options: RequestInit, retries = 5, backoff = 1000) {
  // Try each API key until we get a successful response or exhaust all keys
  const now = Date.now()

  // First, check if any rate-limited keys have reset
  keyRateLimitStatus.forEach((status, index) => {
    if (status.isRateLimited && now > status.resetTime) {
      console.log(`API key ${index + 1} rate limit has reset, marking as available`)
      status.isRateLimited = false
      status.consecutiveFailures = 0
    }
  })

  // Find all non-rate-limited keys
  const availableKeyIndices = keyRateLimitStatus
    .map((status, index) => ({ status, index }))
    .filter((item) => !item.status.isRateLimited)
    .map((item) => item.index)

  // If we have available keys, use the one that was successful most recently
  let availableKeyIndex = -1

  if (availableKeyIndices.length > 0) {
    // Sort by last success time (most recent first)
    availableKeyIndex = availableKeyIndices.sort(
      (a, b) => keyRateLimitStatus[b].lastSuccess - keyRateLimitStatus[a].lastSuccess,
    )[0]
  } else {
    // If all keys are rate limited, find the one that will reset first
    availableKeyIndex = keyRateLimitStatus.reduce(
      (minIndex, status, index, arr) => (status.resetTime < arr[minIndex].resetTime ? index : minIndex),
      0,
    )

    // If the earliest reset time is in the future, wait for it
    if (keyRateLimitStatus[availableKeyIndex].resetTime > now) {
      const waitTime = keyRateLimitStatus[availableKeyIndex].resetTime - now
      console.log(`All API keys are rate limited. Waiting ${waitTime}ms for reset of key ${availableKeyIndex + 1}...`)

      // Wait for the key to reset
      await new Promise((resolve) => setTimeout(resolve, waitTime + 2000)) // Add 2 second buffer

      // Mark the key as available
      keyRateLimitStatus[availableKeyIndex].isRateLimited = false
      keyRateLimitStatus[availableKeyIndex].consecutiveFailures = 0
      console.log(`Key ${availableKeyIndex + 1} should now be available after waiting`)
    }
  }

  // Set the current key index to the available key
  currentKeyIndex = availableKeyIndex

  // Try the request with the current key
  try {
    console.log(`Trying request with API key ${currentKeyIndex + 1} (${retries} retries left)`)

    // Add the Authorization header with the current API key
    const requestOptions = {
      ...options,
      headers: {
        ...options.headers,
        Authorization: `Bearer ${API_KEYS[currentKeyIndex]}`,
      },
    }

    const response = await fetch(url, {
      ...requestOptions,
      cache: "no-store", // Disable caching
    })

    // If rate limited, mark this key as rate limited and try another key
    if (response.status === 429) {
      console.log(`API key ${currentKeyIndex + 1} hit rate limit`)

      // Get the Retry-After header or default to 60 seconds
      const retryAfter = Number.parseInt(response.headers.get("Retry-After") || "60", 10)
      const resetTime = now + retryAfter * 1000

      // Mark this key as rate limited
      keyRateLimitStatus[currentKeyIndex] = {
        ...keyRateLimitStatus[currentKeyIndex],
        isRateLimited: true,
        resetTime,
        consecutiveFailures: keyRateLimitStatus[currentKeyIndex].consecutiveFailures + 1,
      }

      // Check if we have other non-rate-limited keys
      const nextAvailableKeyIndices = keyRateLimitStatus
        .map((status, index) => ({ status, index }))
        .filter((item) => !item.status.isRateLimited && item.index !== currentKeyIndex)
        .map((item) => item.index)

      if (nextAvailableKeyIndices.length > 0) {
        // We have another key available, retry immediately with that key
        // Choose the key with the fewest consecutive failures
        const nextKeyIndex = nextAvailableKeyIndices.sort(
          (a, b) => keyRateLimitStatus[a].consecutiveFailures - keyRateLimitStatus[b].consecutiveFailures,
        )[0]

        currentKeyIndex = nextKeyIndex
        console.log(`Switching to API key ${currentKeyIndex + 1} after rate limit`)
        return fetchWithKeyRotation(url, options, retries, backoff)
      } else if (retries > 0) {
        // All keys are rate limited, wait and retry with exponential backoff
        const adjustedBackoff = Math.min(backoff * 1.5, 30000) // Cap at 30 seconds
        console.log(`All API keys are rate limited. Retrying in ${adjustedBackoff}ms... (${retries} retries left)`)
        await new Promise((resolve) => setTimeout(resolve, adjustedBackoff))
        return fetchWithKeyRotation(url, options, retries - 1, adjustedBackoff)
      } else {
        throw new Error(`API request failed with status 429 (Rate limit exceeded for all API keys)`)
      }
    }

    if (!response.ok) {
      // For other errors, increment consecutive failures but don't mark as rate limited
      keyRateLimitStatus[currentKeyIndex].consecutiveFailures += 1
      throw new Error(`API request failed with status ${response.status}`)
    }

    // Success! Update the status for this key
    keyRateLimitStatus[currentKeyIndex] = {
      ...keyRateLimitStatus[currentKeyIndex],
      lastSuccess: Date.now(),
      consecutiveFailures: 0,
    }

    return await response.json()
  } catch (error) {
    if (error.message && error.message.includes("429") && retries > 0) {
      // Try to switch to another key if available
      const nextAvailableKeyIndices = keyRateLimitStatus
        .map((status, index) => ({ status, index }))
        .filter((item) => !item.status.isRateLimited && item.index !== currentKeyIndex)
        .map((item) => item.index)

      if (nextAvailableKeyIndices.length > 0) {
        // Choose the key with the fewest consecutive failures
        const nextKeyIndex = nextAvailableKeyIndices.sort(
          (a, b) => keyRateLimitStatus[a].consecutiveFailures - keyRateLimitStatus[b].consecutiveFailures,
        )[0]

        currentKeyIndex = nextKeyIndex
        console.log(`Switching to API key ${currentKeyIndex + 1} after error`)
        return fetchWithKeyRotation(url, options, retries, backoff)
      }

      // Otherwise wait and retry with exponential backoff
      const adjustedBackoff = Math.min(backoff * 1.5, 30000) // Cap at 30 seconds
      console.log(`Rate limited, retrying in ${adjustedBackoff}ms... (${retries} retries left)`)
      await new Promise((resolve) => setTimeout(resolve, adjustedBackoff))
      return fetchWithKeyRotation(url, options, retries - 1, adjustedBackoff)
    }

    // For non-rate-limit errors, try a different key if available
    if (retries > 0) {
      const nextAvailableKeyIndices = keyRateLimitStatus
        .map((status, index) => ({ status, index }))
        .filter((item) => !item.status.isRateLimited && item.index !== currentKeyIndex)
        .map((item) => item.index)

      if (nextAvailableKeyIndices.length > 0) {
        const nextKeyIndex = nextAvailableKeyIndices[0]
        currentKeyIndex = nextKeyIndex
        console.log(`Switching to API key ${currentKeyIndex + 1} after general error`)
        return fetchWithKeyRotation(url, options, retries - 1, backoff)
      }
    }

    throw error
  }
}

// Simple in-memory cache implementation
const dataCache = new Map<string, { data: any; expiry: number }>()

async function getCachedData(key: string) {
  const cached = dataCache.get(key)
  if (cached && cached.expiry > Date.now()) {
    return cached.data
  }
  return null
}

async function setCachedData(key: string, data: any, ttlSeconds: number) {
  dataCache.set(key, {
    data,
    expiry: Date.now() + ttlSeconds * 1000,
  })
}

