"use server"

import type { ProductsFilter, ProductsResponse } from "@/types/product"
import { cache } from "react"

// Cache the fetch products function to avoid duplicate requests
export const fetchProducts = cache(
  async (filter: ProductsFilter = { daysBack: 7, sortBy: "newest", limit: 20 }, cursor?: string) => {
    try {
      console.log(`Fetching products with filter:`, filter, `cursor: ${cursor || "none"}`)

      // Calculate date range
      const endDate = new Date()
      const startDate = new Date()
      startDate.setDate(endDate.getDate() - filter.daysBack)

      console.log(`Date range: ${startDate.toISOString()} to ${endDate.toISOString()}`)

      // Create a cache key based on the filter parameters
      const cacheKey = `products-${filter.daysBack}-${filter.sortBy}-${filter.limit}-${cursor || "none"}`

      // Check if we have this data in the cache
      const cachedData = await getCachedData(cacheKey)
      if (cachedData) {
        console.log(`Using cached data for ${cacheKey}`)
        return cachedData as ProductsResponse
      }

      // GraphQL query - updated to include thumbnail and website fields
      const query = `
      query GetPosts($postedAfter: DateTime!, $postedBefore: DateTime!, $first: Int, $after: String) {
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

      // Variables for the query
      const variables = {
        postedAfter: startDate.toISOString(),
        postedBefore: endDate.toISOString(),
        first: filter.limit,
        ...(cursor && { after: cursor }),
      }

      // Check if API token exists
      if (!process.env.PH_TOKEN) {
        console.error("PH_TOKEN environment variable is not set")
        throw new Error("Product Hunt API token is not configured")
      }

      // Make the API request with retry logic for rate limiting
      const data = await fetchWithRetry("https://api.producthunt.com/v2/api/graphql", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.PH_TOKEN}`,
          Accept: "application/json",
          "User-Agent": "Product Hunt Scraper",
          Origin: "https://www.producthunt.com",
          Referer: "https://www.producthunt.com/",
        },
        body: JSON.stringify({
          query,
          variables,
        }),
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

      // Cache the data for future requests
      await setCachedData(cacheKey, data.data, 60 * 15) // Cache for 15 minutes

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
  },
)

// Helper function to fetch with retry logic for rate limiting
async function fetchWithRetry(url: string, options: RequestInit, retries = 3, backoff = 1000) {
  try {
    const response = await fetch(url, {
      ...options,
      next: { revalidate: 60 }, // Cache for 60 seconds
    })

    // If rate limited, wait and retry
    if (response.status === 429) {
      if (retries > 0) {
        console.log(`Rate limited, retrying in ${backoff}ms... (${retries} retries left)`)
        await new Promise((resolve) => setTimeout(resolve, backoff))
        return fetchWithRetry(url, options, retries - 1, backoff * 2)
      } else {
        throw new Error(`API request failed with status 429 (Rate limit exceeded)`)
      }
    }

    if (!response.ok) {
      throw new Error(`API request failed with status ${response.status}`)
    }

    return await response.json()
  } catch (error) {
    if (error.message && error.message.includes("429") && retries > 0) {
      console.log(`Rate limited, retrying in ${backoff}ms... (${retries} retries left)`)
      await new Promise((resolve) => setTimeout(resolve, backoff))
      return fetchWithRetry(url, options, retries - 1, backoff * 2)
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

