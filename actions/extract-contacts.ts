"use server"

import type { Product } from "@/types/product"
import * as cheerio from "cheerio"

// User agent strings to rotate through
const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Safari/605.1.15",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:90.0) Gecko/20100101 Firefox/90.0",
]

// Get a random user agent
function getRandomUserAgent() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)]
}

// Improve the email extraction regex to be more accurate and comprehensive
function extractEmails(text: string): string[] {
  // More comprehensive email regex that balances accuracy and performance
  const emailPattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g
  const emails = text.match(emailPattern) || []

  // Filter out common false positives and add more patterns to exclude
  return emails.filter((email) => {
    // Convert to lowercase for comparison
    const lowerEmail = email.toLowerCase()

    // Filter out common placeholder and example emails
    return (
      !lowerEmail.includes("@example.com") &&
      !lowerEmail.includes("@domain.com") &&
      !lowerEmail.includes("@yourdomain.com") &&
      !lowerEmail.includes("@email.com") &&
      !lowerEmail.includes("@yourcompany") &&
      !lowerEmail.includes("@company.com") &&
      !lowerEmail.includes("@acme.com") &&
      !lowerEmail.includes("name@") &&
      !lowerEmail.includes("user@") &&
      !lowerEmail.includes("username@") &&
      !lowerEmail.includes("email@") &&
      !lowerEmail.includes("your@") &&
      !lowerEmail.includes("info@example") &&
      !lowerEmail.includes("john.doe@") &&
      !lowerEmail.includes("jane.doe@") &&
      // Exclude very short domains that are likely not valid
      !(lowerEmail.split("@")[1] && lowerEmail.split("@")[1].length < 4)
    )
  })
}

// Enhance the Twitter handle extraction to be more comprehensive
function extractTwitterHandles($: cheerio.CheerioAPI): string[] {
  const twitterHandles: string[] = []

  // Look for Twitter links with more comprehensive selectors
  $(
    "a[href*='twitter.com'], a[href*='x.com'], a[href*='t.co'], [class*='twitter'], [class*='tweet'], [id*='twitter']",
  ).each((_, element) => {
    try {
      const href = $(element).attr("href") || ""
      const text = $(element).text() || ""

      // Extract from href
      if (href.includes("twitter.com/") || href.includes("x.com/") || href.includes("t.co/")) {
        const parts = href.split("/")
        if (parts.length > 3) {
          const handle = parts[parts.length - 1].split("?")[0] // Remove query parameters
          if (
            handle &&
            ![
              "share",
              "intent",
              "home",
              "hashtag",
              "compose",
              "search",
              "explore",
              "notifications",
              "messages",
            ].includes(handle.toLowerCase())
          ) {
            // Add @ if it's missing
            const formattedHandle = handle.startsWith("@") ? handle : `@${handle}`
            twitterHandles.push(formattedHandle)
          }
        }
      }

      // Also try to extract Twitter handles from text content
      const twitterRegex = /@([A-Za-z0-9_]+)/g
      const matches = text.match(twitterRegex)
      if (matches) {
        twitterHandles.push(...matches)
      }
    } catch (error) {
      // Skip this element and continue
    }
  })

  return [...new Set(twitterHandles)]
}

// Validate URL
function isValidUrl(urlString: string): boolean {
  if (!urlString || typeof urlString !== "string" || urlString.trim() === "") {
    return false
  }

  try {
    new URL(urlString)
    return true
  } catch (error) {
    return false
  }
}

// Check if a URL is a Product Hunt redirect URL
function isProductHuntRedirectUrl(url: string): boolean {
  return url.includes("producthunt.com/r/")
}

// Extract real URL from Product Hunt redirect URL by fetching the page and looking for meta tags
async function extractUrlFromProductHuntPage(url: string): Promise<string | null> {
  try {
    console.log(`Fetching Product Hunt page to extract website URL: ${url}`)

    // Fetch the Product Hunt page
    const response = await fetchWithTimeout(
      url,
      {
        headers: {
          "User-Agent": getRandomUserAgent(),
          Accept: "text/html",
        },
        cache: "no-store",
      },
      8000, // 8 second timeout
    )

    if (!response.ok) {
      console.log(`Failed to fetch Product Hunt page: ${url}`)
      return null
    }

    const html = await response.text()
    const $ = cheerio.load(html)

    // Look for the website URL in meta tags
    let websiteUrl = null

    // Try to find the website URL in meta tags
    $("meta").each((_, element) => {
      const property = $(element).attr("property") || $(element).attr("name")
      if (property === "og:url" || property === "twitter:url") {
        const content = $(element).attr("content")
        if (content && !content.includes("producthunt.com")) {
          websiteUrl = content
        }
      }
    })

    // If not found in meta tags, look for links with rel="nofollow" that point outside Product Hunt
    if (!websiteUrl) {
      $('a[rel="nofollow"]').each((_, element) => {
        const href = $(element).attr("href")
        if (href && !href.includes("producthunt.com") && href.startsWith("http")) {
          websiteUrl = href
          return false // break the loop
        }
      })
    }

    // If still not found, look for any link that might be the website
    if (!websiteUrl) {
      // Look for a link that says "Website" or similar
      $("a").each((_, element) => {
        const text = $(element).text().toLowerCase()
        const href = $(element).attr("href")
        if (
          href &&
          !href.includes("producthunt.com") &&
          href.startsWith("http") &&
          (text.includes("website") || text.includes("visit") || text.includes("home"))
        ) {
          websiteUrl = href
          return false // break the loop
        }
      })
    }

    // If we found a website URL, return it
    if (websiteUrl) {
      console.log(`Found website URL from Product Hunt page: ${websiteUrl}`)
      return websiteUrl
    }

    console.log(`Could not find website URL in Product Hunt page: ${url}`)
    return null
  } catch (error) {
    console.error(`Error extracting website URL from Product Hunt page: ${url}`, error)
    return null
  }
}

// Add a timeout function to prevent hanging requests
function fetchWithTimeout(url: string, options: RequestInit = {}, timeout = 10000) {
  const controller = new AbortController()
  const { signal } = controller

  const timeoutId = setTimeout(() => controller.abort(), timeout)

  return fetch(url, { ...options, signal })
    .then((response) => {
      clearTimeout(timeoutId)
      return response
    })
    .catch((error) => {
      clearTimeout(timeoutId)
      throw error
    })
}

// Resolve a Product Hunt redirect URL to get the actual website URL
async function resolveProductHuntRedirect(url: string): Promise<string | null> {
  if (!isValidUrl(url)) {
    console.error(`Cannot resolve redirect: Invalid URL: ${url}`)
    return null
  }

  try {
    console.log(`Resolving Product Hunt redirect: ${url}`)

    // First, try to extract from the URL itself
    try {
      const urlObj = new URL(url)
      // Check for 'url' parameter in the query string
      const urlParam = urlObj.searchParams.get("url")
      if (urlParam && isValidUrl(urlParam)) {
        console.log(`Found URL in query parameter: ${urlParam}`)
        return urlParam
      }
    } catch (error) {
      console.error(`Error parsing URL: ${url}`, error)
    }

    // If that fails, try to extract from the Product Hunt page
    return await extractUrlFromProductHuntPage(url)
  } catch (error) {
    console.error(`Error resolving Product Hunt redirect: ${url}`, error)
    return null
  }
}

// Enhance the contact page checking to look for more contact information
async function checkContactPage(
  baseUrl: string,
  $: cheerio.CheerioAPI,
): Promise<{
  emails: string[]
  twitterHandles: string[]
}> {
  try {
    // Look for contact page links with more comprehensive selectors
    const contactLinks: string[] = []

    try {
      $("a").each((_, element) => {
        try {
          const href = $(element).attr("href") || ""
          const text = $(element).text().toLowerCase()

          if (
            text.includes("contact") ||
            href.includes("contact") ||
            text.includes("get in touch") ||
            text.includes("reach out") ||
            text.includes("email us") ||
            text.includes("support") ||
            href.includes("support") ||
            href.startsWith("mailto:")
          ) {
            let contactUrl = href

            // Handle relative URLs
            if (contactUrl && !contactUrl.startsWith("http") && !contactUrl.startsWith("mailto:")) {
              // Handle different relative URL formats
              if (contactUrl.startsWith("/")) {
                try {
                  const urlObj = new URL(baseUrl)
                  contactUrl = `${urlObj.protocol}//${urlObj.host}${contactUrl}`
                } catch (urlError) {
                  console.error(`Error creating URL for ${baseUrl}${contactUrl}:`, urlError)
                  return // Skip this URL
                }
              } else {
                // Ensure baseUrl ends with a slash for proper joining
                const baseWithSlash = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`
                contactUrl = `${baseWithSlash}${contactUrl}`
              }
            }

            if (contactUrl && (isValidUrl(contactUrl) || contactUrl.startsWith("mailto:"))) {
              // If it's a mailto link, extract the email directly
              if (contactUrl.startsWith("mailto:")) {
                // Don't add to contactLinks, but we'll extract the email later
              } else {
                contactLinks.push(contactUrl)
              }
            }
          }
        } catch (elementError) {
          // Skip this element and continue
        }
      })
    } catch (selectorError) {
      console.error(`Error selecting contact links for ${baseUrl}:`, selectorError)
      // Continue with empty contact links
    }

    // If we found contact links, check the first one
    if (contactLinks.length > 0) {
      console.log(`Found contact page: ${contactLinks[0]}`)

      try {
        const response = await fetchWithTimeout(
          contactLinks[0],
          {
            headers: {
              "User-Agent": getRandomUserAgent(),
              Accept: "text/html",
            },
            cache: "no-store",
          },
          5000, // 5 second timeout
        ).catch((error) => {
          console.error(`Fetch error for contact page ${contactLinks[0]}:`, error.message)
          return null // Return null instead of throwing
        })

        if (!response || !response.ok) {
          console.log(`Failed to fetch contact page: ${contactLinks[0]}`)
          return { emails: [], twitterHandles: [] }
        }

        const html = await response.text().catch((error) => {
          console.error(`Error getting text from contact page ${contactLinks[0]}:`, error)
          return "" // Return empty string instead of throwing
        })

        if (!html) {
          return { emails: [], twitterHandles: [] }
        }

        const contactPageEmails = extractEmails(html)

        // Parse the contact page HTML
        let contactPageTwitterHandles: string[] = []
        try {
          const $contact = cheerio.load(html)
          contactPageTwitterHandles = extractTwitterHandles($contact)

          // Look for contact form elements which might have email placeholders
          $contact('input[type="email"], input[name*="email"], input[placeholder*="email"]').each((_, element) => {
            const placeholder = $contact(element).attr("placeholder") || ""
            const value = $contact(element).attr("value") || ""

            if (placeholder.includes("@") && placeholder.includes(".")) {
              const emails = extractEmails(placeholder)
              if (emails.length > 0) {
                contactPageEmails.push(...emails)
              }
            }

            if (value.includes("@") && value.includes(".")) {
              const emails = extractEmails(value)
              if (emails.length > 0) {
                contactPageEmails.push(...emails)
              }
            }
          })
        } catch (parseError) {
          console.error(`Error parsing contact page ${contactLinks[0]}:`, parseError)
          // Continue with empty Twitter handles
        }

        return {
          emails: contactPageEmails,
          twitterHandles: contactPageTwitterHandles,
        }
      } catch (error) {
        console.error(`Error checking contact page ${contactLinks[0]}:`, error)
        return { emails: [], twitterHandles: [] }
      }
    }

    return { emails: [], twitterHandles: [] }
  } catch (error) {
    console.error("Error in checkContactPage:", error)
    return { emails: [], twitterHandles: [] }
  }
}

// Extract content from footer section
function extractFromFooter($: cheerio.CheerioAPI): {
  emails: string[]
  twitterHandles: string[]
} {
  try {
    // Target footer elements
    const footerSelectors = [
      "footer",
      ".footer",
      "#footer",
      '[class*="footer"]',
      ".bottom",
      ".bottom-bar",
      ".copyright",
      ".site-info",
    ]

    let footerHtml = ""

    // Extract HTML from all potential footer elements
    footerSelectors.forEach((selector) => {
      try {
        $(selector).each((_, element) => {
          try {
            footerHtml += $(element).html() || ""
          } catch (elementError) {
            // Skip this element and continue
          }
        })
      } catch (selectorError) {
        // Skip this selector and continue
      }
    })

    // Extract emails from footer HTML
    const footerEmails = extractEmails(footerHtml)

    // Extract Twitter handles from footer elements
    const footerTwitterHandles: string[] = []
    footerSelectors.forEach((selector) => {
      try {
        $(selector)
          .find('a[href*="twitter.com"], a[href*="x.com"]')
          .each((_, element) => {
            try {
              const href = $(element).attr("href") || ""

              // Extract the handle from the URL
              if (href.includes("twitter.com/") || href.includes("x.com/")) {
                const parts = href.split("/")
                if (parts.length > 3) {
                  const handle = parts[parts.length - 1].split("?")[0] // Remove query parameters
                  if (
                    handle &&
                    ![
                      "share",
                      "intent",
                      "home",
                      "hashtag",
                      "compose",
                      "search",
                      "explore",
                      "notifications",
                      "messages",
                    ].includes(handle)
                  ) {
                    footerTwitterHandles.push(`@${handle}`)
                  }
                }
              }
            } catch (elementError) {
              // Skip this element and continue
            }
          })
      } catch (selectorError) {
        // Skip this selector and continue
      }
    })

    return {
      emails: footerEmails,
      twitterHandles: [...new Set(footerTwitterHandles)],
    }
  } catch (error) {
    console.error("Error extracting from footer:", error)
    return { emails: [], twitterHandles: [] }
  }
}

// Add a new function to check about pages for contact information
async function checkAboutPage(
  baseUrl: string,
  $: cheerio.CheerioAPI,
): Promise<{
  emails: string[]
  twitterHandles: string[]
}> {
  try {
    // Look for about page links
    const aboutLinks: string[] = []

    try {
      $("a").each((_, element) => {
        try {
          const href = $(element).attr("href") || ""
          const text = $(element).text().toLowerCase()

          if (
            text.includes("about") ||
            href.includes("about") ||
            text.includes("team") ||
            href.includes("team") ||
            text.includes("company") ||
            href.includes("company")
          ) {
            let aboutUrl = href

            // Handle relative URLs
            if (aboutUrl && !aboutUrl.startsWith("http")) {
              // Handle different relative URL formats
              if (aboutUrl.startsWith("/")) {
                try {
                  const urlObj = new URL(baseUrl)
                  aboutUrl = `${urlObj.protocol}//${urlObj.host}${aboutUrl}`
                } catch (urlError) {
                  console.error(`Error creating URL for ${baseUrl}${aboutUrl}:`, urlError)
                  return // Skip this URL
                }
              } else {
                // Ensure baseUrl ends with a slash for proper joining
                const baseWithSlash = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`
                aboutUrl = `${baseWithSlash}${aboutUrl}`
              }
            }

            if (aboutUrl && isValidUrl(aboutUrl)) {
              aboutLinks.push(aboutUrl)
            }
          }
        } catch (elementError) {
          // Skip this element and continue
        }
      })
    } catch (selectorError) {
      console.error(`Error selecting about links for ${baseUrl}:`, selectorError)
      // Continue with empty about links
    }

    // If we found about links, check the first one
    if (aboutLinks.length > 0) {
      console.log(`Found about page: ${aboutLinks[0]}`)

      try {
        const response = await fetchWithTimeout(
          aboutLinks[0],
          {
            headers: {
              "User-Agent": getRandomUserAgent(),
              Accept: "text/html",
            },
            cache: "no-store",
          },
          5000, // 5 second timeout
        ).catch((error) => {
          console.error(`Fetch error for about page ${aboutLinks[0]}:`, error.message)
          return null // Return null instead of throwing
        })

        if (!response || !response.ok) {
          console.log(`Failed to fetch about page: ${aboutLinks[0]}`)
          return { emails: [], twitterHandles: [] }
        }

        const html = await response.text().catch((error) => {
          console.error(`Error getting text from about page ${aboutLinks[0]}:`, error)
          return "" // Return empty string instead of throwing
        })

        if (!html) {
          return { emails: [], twitterHandles: [] }
        }

        const aboutPageEmails = extractEmails(html)

        // Parse the about page HTML
        let aboutPageTwitterHandles: string[] = []
        try {
          const $about = cheerio.load(html)
          aboutPageTwitterHandles = extractTwitterHandles($about)
        } catch (parseError) {
          console.error(`Error parsing about page ${aboutLinks[0]}:`, parseError)
          // Continue with empty Twitter handles
        }

        return {
          emails: aboutPageEmails,
          twitterHandles: aboutPageTwitterHandles,
        }
      } catch (error) {
        console.error(`Error checking about page ${aboutLinks[0]}:`, error)
        return { emails: [], twitterHandles: [] }
      }
    }

    return { emails: [], twitterHandles: [] }
  } catch (error) {
    console.error("Error in checkAboutPage:", error)
    return { emails: [], twitterHandles: [] }
  }
}

// Process products in smaller batches to avoid timeouts
export async function processBatches(products: Product[], batchSize = 5): Promise<Product[]> {
  console.log(`Processing ${products.length} products in batches of ${batchSize}`)

  // Create a copy of the products array
  const allProducts = [...products]
  const updatedProducts: Product[] = []

  // Process in batches
  for (let i = 0; i < allProducts.length; i += batchSize) {
    const batch = allProducts.slice(i, i + batchSize)
    console.log(`Processing batch ${Math.floor(i / batchSize) + 1} of ${Math.ceil(allProducts.length / batchSize)}`)

    try {
      // Process this batch
      const batchResults = await extractContactInfo(batch, batch.length)

      // Merge the results with the updated products
      batchResults.forEach((product) => {
        const existingIndex = updatedProducts.findIndex((p) => p.id === product.id)
        if (existingIndex >= 0) {
          updatedProducts[existingIndex] = product
        } else {
          updatedProducts.push(product)
        }
      })

      // Small delay between batches
      if (i + batchSize < allProducts.length) {
        await new Promise((resolve) => setTimeout(resolve, 1000))
      }
    } catch (error) {
      console.error(`Error processing batch ${Math.floor(i / batchSize) + 1}:`, error)
      // Continue with next batch even if this one failed
    }
  }

  // Ensure we return products in the same order as the input
  return allProducts.map((originalProduct) => {
    const updated = updatedProducts.find((p) => p.id === originalProduct.id)
    return updated || originalProduct
  })
}

// Enhance the scrapeWebsite function to check more locations and be more thorough
export async function scrapeWebsite(url: string): Promise<{
  emails: string[]
  twitterHandles: string[]
  contactLinks: string[]
  externalLinks: string[]
}> {
  // Default empty response
  const emptyResult = {
    emails: [],
    twitterHandles: [],
    contactLinks: [],
    externalLinks: [],
  }

  // Validate URL before proceeding
  if (!url || typeof url !== "string" || url.trim() === "") {
    console.error(`Invalid URL provided: "${url}"`)
    return emptyResult
  }

  // Make sure URL has a protocol
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    url = "https://" + url
  }

  // Validate URL format
  if (!isValidUrl(url)) {
    console.error(`Invalid URL format: ${url}`)
    return emptyResult
  }

  // Skip if it's a Product Hunt URL (we should have resolved these earlier)
  if (url.includes("producthunt.com")) {
    console.log(`Skipping Product Hunt URL: ${url}`)
    return emptyResult
  }

  try {
    console.log(`Checking main page: ${url}`)

    // Use a longer timeout for the main page fetch
    const response = await fetchWithTimeout(
      url,
      {
        headers: {
          "User-Agent": getRandomUserAgent(),
          Accept: "text/html",
        },
        cache: "no-store", // Disable caching
      },
      8000, // 8 second timeout for main page
    ).catch((error) => {
      console.error(`Fetch error for ${url}:`, error.message)
      return null // Return null instead of throwing
    })

    if (!response || !response.ok) {
      console.log(`Failed to fetch ${url}: ${response ? `Status ${response.status}` : "Request failed"}`)
      return emptyResult
    }

    // Use text() with a timeout to prevent hanging on large responses
    const textPromise = response.text()
    const timeoutPromise = new Promise<string>((_, reject) => {
      setTimeout(() => reject(new Error("Text extraction timed out")), 5000) // Increased timeout
    })

    const html = await Promise.race([textPromise, timeoutPromise]).catch((error) => {
      console.error(`Error extracting text from ${url}:`, error)
      return "" // Return empty string on error
    })

    if (!html) {
      return emptyResult
    }

    console.log(`Successfully fetched ${url}, HTML length: ${html.length}`)

    // Use a timeout for parsing to prevent hanging on complex HTML
    try {
      const parsePromise = new Promise<{
        emails: string[]
        twitterHandles: string[]
        contactLinks: string[]
        externalLinks: string[]
      }>(async (resolve) => {
        try {
          // Extract emails directly from HTML
          const emails = extractEmails(html)

          // Use cheerio for parsing
          const $ = cheerio.load(html)
          const twitterHandles = extractTwitterHandles($)

          // Look for emails in specific elements that often contain contact info
          const contactElements = [
            'a[href^="mailto:"]',
            ".contact",
            ".contact-info",
            ".email",
            ".email-address",
            "#contact",
            "#email",
            '[class*="contact"]',
            '[class*="email"]',
            '[id*="contact"]',
            '[id*="email"]',
          ]

          let elementEmails: string[] = []
          contactElements.forEach((selector) => {
            try {
              $(selector).each((_, element) => {
                // Check element text
                const text = $(element).text()
                const foundEmails = extractEmails(text)
                elementEmails = [...elementEmails, ...foundEmails]

                // Check href for mailto links
                const href = $(element).attr("href") || ""
                if (href.startsWith("mailto:")) {
                  const email = href.replace("mailto:", "").split("?")[0].trim()
                  if (email && email.includes("@") && !email.includes(" ")) {
                    elementEmails.push(email)
                  }
                }
              })
            } catch (err) {
              // Continue with next selector
            }
          })

          // Extract from footer
          let footerResults = { emails: [], twitterHandles: [] }
          try {
            footerResults = extractFromFooter($)
          } catch (footerError) {
            console.error(`Error extracting from footer for ${url}:`, footerError)
            // Continue with empty footer results
          }

          // Check contact page
          let contactPageResults = { emails: [], twitterHandles: [] }
          try {
            contactPageResults = await checkContactPage(url, $)
          } catch (contactPageError) {
            console.error(`Error checking contact page for ${url}:`, contactPageError)
            // Continue with empty contact page results
          }

          // Also check about page, which often contains contact info
          let aboutPageResults = { emails: [], twitterHandles: [] }
          try {
            aboutPageResults = await checkAboutPage(url, $)
          } catch (aboutPageError) {
            console.error(`Error checking about page for ${url}:`, aboutPageError)
            // Continue with empty about page results
          }

          // Find contact links
          const contactLinks: string[] = []
          try {
            $("a").each((_, element) => {
              try {
                const href = $(element).attr("href") || ""
                const text = $(element).text().toLowerCase()

                if (
                  text.includes("contact") ||
                  href.includes("contact") ||
                  text.includes("get in touch") ||
                  text.includes("reach out") ||
                  text.includes("email us") ||
                  text.includes("support") ||
                  href.includes("support") ||
                  href.startsWith("mailto:")
                ) {
                  let contactUrl = href

                  // Handle relative URLs
                  if (contactUrl && !contactUrl.startsWith("http") && !contactUrl.startsWith("mailto:")) {
                    if (contactUrl.startsWith("/")) {
                      const urlObj = new URL(url)
                      contactUrl = `${urlObj.protocol}//${urlObj.host}${contactUrl}`
                    } else {
                      const baseWithSlash = url.endsWith("/") ? url : `${url}/`
                      contactUrl = `${baseWithSlash}${contactUrl}`
                    }
                  }

                  if (contactUrl && (isValidUrl(contactUrl) || contactUrl.startsWith("mailto:"))) {
                    contactLinks.push(contactUrl)
                  }
                }
              } catch (linkError) {
                // Skip this link and continue
              }
            })
          } catch (contactLinksError) {
            console.error(`Error finding contact links for ${url}:`, contactLinksError)
            // Continue with empty contact links
          }

          // Combine all results, removing duplicates
          resolve({
            emails: [
              ...new Set([
                ...emails,
                ...elementEmails,
                ...footerResults.emails,
                ...contactPageResults.emails,
                ...aboutPageResults.emails,
              ]),
            ],
            twitterHandles: [
              ...new Set([
                ...twitterHandles,
                ...footerResults.twitterHandles,
                ...contactPageResults.twitterHandles,
                ...aboutPageResults.twitterHandles,
              ]),
            ],
            contactLinks: [...new Set(contactLinks)],
            externalLinks: [], // Skip external links to save time
          })
        } catch (parseError) {
          console.error(`Error in parse promise for ${url}:`, parseError)
          resolve(emptyResult) // Resolve with empty result instead of rejecting
        }
      })

      const parseTimeoutPromise = new Promise<{
        emails: string[]
        twitterHandles: string[]
        contactLinks: string[]
        externalLinks: string[]
      }>((_, reject) => {
        setTimeout(() => reject(new Error("Parsing timed out")), 8000) // Increased timeout for more thorough parsing
      })

      return await Promise.race([parsePromise, parseTimeoutPromise]).catch((error) => {
        console.error(`Error parsing HTML from ${url}:`, error)
        return emptyResult
      })
    } catch (error) {
      console.error(`Error in HTML parsing for ${url}:`, error)
      return emptyResult
    }
  } catch (error) {
    console.error(`Error scraping ${url}:`, error)
    return emptyResult
  }
}

// Process products one at a time to avoid timeouts
export async function extractContactInfo(products: Product[], maxToProcess = 10): Promise<Product[]> {
  console.log(`extractContactInfo called with ${products.length} products, max to process: ${maxToProcess}`)

  // Create a copy of the original products array to maintain order
  const allUpdatedProducts = [...products]

  // Filter out products without websites
  const productsWithWebsites = products
    .filter((product) => product.website && typeof product.website === "string" && product.website.trim() !== "")
    .slice(0, maxToProcess) // Limit to maxToProcess

  console.log(`Found ${productsWithWebsites.length} products with websites (limited to ${maxToProcess})`)

  if (productsWithWebsites.length === 0) {
    console.log("No products with websites to process")
    return allUpdatedProducts
  }

  // Track consecutive failures for circuit breaker pattern
  let consecutiveFailures = 0
  const MAX_CONSECUTIVE_FAILURES = 3

  // Process each product sequentially with a short timeout
  for (let i = 0; i < productsWithWebsites.length; i++) {
    // Circuit breaker pattern - stop if too many consecutive failures
    if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
      console.log(`Circuit breaker triggered after ${consecutiveFailures} consecutive failures. Stopping processing.`)
      break
    }

    const product = productsWithWebsites[i]
    let success = false

    try {
      console.log(`Processing product ${i + 1}/${productsWithWebsites.length}: ${product.name}`)

      if (!product.website) {
        console.log(`No website for product ${product.name}, skipping`)
        continue
      }

      // Add protocol if missing
      let website = product.website
      if (!website.startsWith("http://") && !website.startsWith("https://")) {
        website = "https://" + website
      }

      // If it's a Product Hunt redirect URL, try to resolve it
      if (isProductHuntRedirectUrl(website)) {
        try {
          const resolvedUrl = await resolveProductHuntRedirect(website)

          if (!resolvedUrl) {
            console.log(`Could not resolve Product Hunt redirect: ${website}, continuing with original URL`)
            // Continue with the original URL instead of skipping
          } else {
            website = resolvedUrl
            console.log(`Successfully resolved redirect to: ${website}`)

            // Update the product's website with the resolved URL
            const index = allUpdatedProducts.findIndex((p) => p.id === product.id)
            if (index !== -1) {
              allUpdatedProducts[index].website = website
            }
          }
        } catch (redirectError) {
          console.error(`Error resolving redirect for ${product.name}:`, redirectError)
          // Continue with the original URL instead of skipping
        }
      }

      // Skip if it's still a Product Hunt URL
      if (website.includes("producthunt.com")) {
        console.log(`Skipping Product Hunt URL: ${website}`)
        continue
      }

      // Process with timeout and better error handling
      try {
        const processPromise = scrapeWebsite(website)
        const timeoutPromise = new Promise<{
          emails: string[]
          twitterHandles: string[]
          contactLinks: string[]
          externalLinks: string[]
        }>((_, reject) => {
          setTimeout(() => reject(new Error(`Processing timed out for ${product.name}`)), 10000) // Increased timeout for more thorough processing
        })

        const contactInfo = await Promise.race([processPromise, timeoutPromise]).catch((error) => {
          console.error(`Error or timeout processing ${product.name}:`, error)
          return {
            emails: [],
            twitterHandles: [],
            contactLinks: [],
            externalLinks: [],
          }
        })

        // Update the product in the array
        const index = allUpdatedProducts.findIndex((p) => p.id === product.id)
        if (index !== -1) {
          allUpdatedProducts[index] = {
            ...allUpdatedProducts[index], // Keep existing properties
            website: website, // Ensure we save the resolved website URL
            emails: contactInfo.emails || [],
            twitterHandles: contactInfo.twitterHandles || [],
            contactLinks: contactInfo.contactLinks || [],
            externalLinks: contactInfo.externalLinks || [],
          }
        }

        success = true
        consecutiveFailures = 0 // Reset consecutive failures on success
      } catch (processError) {
        console.error(`Error processing website for ${product.name}:`, processError)
        // Don't throw, just continue to the next product
        consecutiveFailures++
      }

      // Add a small delay between products
      await new Promise((resolve) => setTimeout(resolve, 500))
    } catch (error) {
      console.error(`Unexpected error processing product ${product.name}:`, error)
      // Continue with next product
      if (!success) {
        consecutiveFailures++
      }
    }
  }

  console.log(`Processed ${productsWithWebsites.length} products with websites`)
  return allUpdatedProducts
}

