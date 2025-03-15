"use server"

import type { ProductsFilter, ProductsResponse } from "@/types/product"

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

// Update the fetchWithRetry function to disable caching
async function fetchWithRetry(url: string, options: RequestInit, retries = 3, backoff = 1000) {
  try {
    const response = await fetch(url, {
      ...options,
      cache: "no-store", // Disable caching
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

