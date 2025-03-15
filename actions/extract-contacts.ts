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

// Improved email extraction regex to be more accurate and strict
function extractEmails(text: string): string[] {
  // More strict email regex that follows RFC 5322 more closely
  const emailPattern =
    /(?:[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*|"(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21\x23-\x5b\x5d-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])*")@(?:(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?|\[(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?|[a-z0-9-]*[a-z0-9]:(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21-\x5a\x53-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])+)\])/gi

  // Extract all potential emails
  const emails = text.match(emailPattern) || []

  // Filter out common false positives and add more patterns to exclude
  return emails.filter((email) => {
    // Convert to lowercase for comparison
    const lowerEmail = email.toLowerCase()

    // Check domain part
    const domainPart = lowerEmail.split("@")[1]

    // Minimum requirements for a valid email
    if (!domainPart || domainPart.length < 4 || !domainPart.includes(".")) {
      return false
    }

    // Filter out common placeholder and example emails
    const invalidDomains = [
      "example.com",
      "domain.com",
      "yourdomain.com",
      "email.com",
      "yourcompany.com",
      "company.com",
      "acme.com",
      "test.com",
      "sample.com",
      "website.com",
      "mail.com",
      "gmail.example",
      "example.org",
      "example.net",
    ]

    if (invalidDomains.some((domain) => domainPart.includes(domain))) {
      return false
    }

    // Filter out common placeholder usernames
    const userPart = lowerEmail.split("@")[0]
    const invalidUsernames = [
      "name",
      "user",
      "username",
      "email",
      "your",
      "info@example",
      "john.doe",
      "jane.doe",
      "admin",
      "test",
      "example",
      "hello",
      "contact@example",
      "support@example",
      "noreply",
      "no-reply",
      "donotreply",
    ]

    if (invalidUsernames.some((name) => userPart === name)) {
      return false
    }

    // Check for emails that are likely real
    const likelyRealDomains = [".com", ".org", ".net", ".io", ".co", ".us", ".uk", ".ca", ".au", ".de", ".fr"]
    const hasLikelyRealDomain = likelyRealDomains.some((domain) => domainPart.endsWith(domain))

    // Additional validation for common email patterns
    const isCommonEmailPattern = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(email)

    return isCommonEmailPattern && hasLikelyRealDomain
  })
}

// Enhanced social media extraction to find multiple platforms with strict validation
function extractSocialMedia($: cheerio.CheerioAPI): {
  twitter: string[]
  facebook: string[]
  instagram: string[]
  linkedin: string[]
} {
  const socialMedia = {
    twitter: [] as string[],
    facebook: [] as string[],
    instagram: [] as string[],
    linkedin: [] as string[],
  }

  try {
    // Look for social media links with comprehensive selectors
    $(
      "a[href*='twitter.com'], a[href*='x.com'], a[href*='t.co'], a[href*='facebook.com'], a[href*='fb.com'], a[href*='instagram.com'], a[href*='linkedin.com'], [class*='social'], [id*='social'], footer a, .footer a",
    ).each((_, element) => {
      try {
        const href = $(element).attr("href") || ""
        const text = $(element).text() || ""
        const classes = $(element).attr("class") || ""

        // Only process if we have a valid href
        if (!href || href === "#" || href === "/" || href.startsWith("javascript:")) {
          return
        }

        // Check for Twitter
        if (href.includes("twitter.com/") || href.includes("x.com/") || href.includes("t.co/")) {
          // Extract handle from URL
          let handle = ""

          // Parse the URL to extract the handle
          try {
            const url = new URL(href.startsWith("http") ? href : `https:${href}`)
            const pathParts = url.pathname.split("/").filter(Boolean)

            // Validate the path has a username component
            if (pathParts.length > 0) {
              handle = pathParts[0]

              // Skip known non-username paths
              if (
                [
                  "share",
                  "intent",
                  "home",
                  "hashtag",
                  "compose",
                  "search",
                  "explore",
                  "notifications",
                  "messages",
                  "settings",
                ].includes(handle.toLowerCase())
              ) {
                return
              }

              // Clean up the handle
              handle = handle.replace(/[?#].*$/, "").trim()

              // Add @ if it's missing
              if (handle && !handle.startsWith("@")) {
                handle = `@${handle}`
              }

              if (handle && handle.length > 1) {
                socialMedia.twitter.push(handle)
              }
            }
          } catch (e) {
            // If URL parsing fails, try regex extraction
            const twitterHandleRegex = /twitter\.com\/([A-Za-z0-9_]+)/i
            const match = href.match(twitterHandleRegex)
            if (match && match[1]) {
              handle = `@${match[1]}`
              socialMedia.twitter.push(handle)
            }
          }
        }

        // Check for Facebook
        if (href.includes("facebook.com/") || href.includes("fb.com/")) {
          try {
            // Normalize the URL
            let fbUrl = href
            if (!fbUrl.startsWith("http")) {
              fbUrl = `https:${fbUrl.startsWith("//") ? fbUrl : `//${fbUrl}`}`
            }

            // Parse the URL
            const url = new URL(fbUrl)

            // Skip sharing and dialog URLs
            if (url.pathname.includes("/sharer") || url.pathname.includes("/dialog")) {
              return
            }

            // Clean up the URL
            const cleanUrl = `${url.origin}${url.pathname.split("?")[0]}`

            // Only add if it's likely a profile or page
            if (cleanUrl.length > 25 && !cleanUrl.endsWith("facebook.com/") && !cleanUrl.endsWith("fb.com/")) {
              socialMedia.facebook.push(cleanUrl)
            }
          } catch (e) {
            // If URL parsing fails, just use the original href if it looks valid
            if (href.includes("facebook.com/") && href.length > 25) {
              socialMedia.facebook.push(href)
            }
          }
        }

        // Check for Instagram
        if (href.includes("instagram.com/")) {
          try {
            // Normalize the URL
            let igUrl = href
            if (!igUrl.startsWith("http")) {
              igUrl = `https:${igUrl.startsWith("//") ? igUrl : `//${igUrl}`}`
            }

            // Parse the URL
            const url = new URL(igUrl)
            const pathParts = url.pathname.split("/").filter(Boolean)

            // Skip non-profile URLs
            if (pathParts.length === 0 || ["p", "explore", "direct", "stories"].includes(pathParts[0])) {
              return
            }

            // Clean up the URL
            const cleanUrl = `${url.origin}/${pathParts[0]}`

            // Only add if it looks like a profile
            if (cleanUrl.length > 25 && !cleanUrl.endsWith("instagram.com/")) {
              socialMedia.instagram.push(cleanUrl)
            }
          } catch (e) {
            // If URL parsing fails, just use the original href if it looks valid
            if (href.includes("instagram.com/") && href.length > 25 && !href.includes("instagram.com/p/")) {
              socialMedia.instagram.push(href)
            }
          }
        }

        // Check for LinkedIn
        if (href.includes("linkedin.com/")) {
          try {
            // Normalize the URL
            let liUrl = href
            if (!liUrl.startsWith("http")) {
              liUrl = `https:${liUrl.startsWith("//") ? liUrl : `//${liUrl}`}`
            }

            // Parse the URL
            const url = new URL(liUrl)

            // Skip sharing URLs
            if (url.pathname.includes("/share") || url.pathname.includes("/shareArticle")) {
              return
            }

            // Clean up the URL
            const cleanUrl = `${url.origin}${url.pathname.split("?")[0]}`

            // Only add if it's likely a profile or company page
            if (
              cleanUrl.length > 25 &&
              (cleanUrl.includes("/in/") || cleanUrl.includes("/company/") || cleanUrl.includes("/school/"))
            ) {
              socialMedia.linkedin.push(cleanUrl)
            }
          } catch (e) {
            // If URL parsing fails, just use the original href if it looks valid
            if (
              href.includes("linkedin.com/") &&
              href.length > 25 &&
              (href.includes("/in/") || href.includes("/company/") || href.includes("/school/"))
            ) {
              socialMedia.linkedin.push(href)
            }
          }
        }
      } catch (error) {
        // Skip this element and continue
      }
    })
  } catch (error) {
    console.error("Error extracting social media:", error)
  }

  // Remove duplicates and normalize
  return {
    twitter: [...new Set(socialMedia.twitter)],
    facebook: [...new Set(socialMedia.facebook)],
    instagram: [...new Set(socialMedia.instagram)],
    linkedin: [...new Set(socialMedia.linkedin)],
  }
}

// Enhanced URL validation
function isValidUrl(urlString: string): boolean {
  if (!urlString || typeof urlString !== "string" || urlString.trim() === "") {
    return false
  }

  try {
    const url = new URL(urlString)
    // Check for valid protocol
    return url.protocol === "http:" || url.protocol === "https:"
  } catch (error) {
    return false
  }
}

// Normalize URL to ensure consistency
function normalizeUrl(url: string): string {
  if (!url) return ""

  try {
    // Add protocol if missing
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      url = "https://" + url
    }

    // Parse the URL
    const urlObj = new URL(url)

    // Remove trailing slash
    let normalized = urlObj.origin + urlObj.pathname.replace(/\/$/, "")

    // Keep query parameters for certain URLs where they're important
    if (urlObj.search && (url.includes("product") || url.includes("item") || url.includes("page"))) {
      normalized += urlObj.search
    }

    return normalized
  } catch (e) {
    return url
  }
}

// Check if a URL is a Product Hunt redirect URL
function isProductHuntRedirectUrl(url: string): boolean {
  return url.includes("producthunt.com/r/") || url.includes("ph.co/")
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

    // First, try to find the canonical URL
    const canonicalLink = $('link[rel="canonical"]').attr("href")
    if (canonicalLink && !canonicalLink.includes("producthunt.com")) {
      websiteUrl = canonicalLink
    }

    // If not found, try meta tags
    if (!websiteUrl) {
      $("meta").each((_, element) => {
        const property = $(element).attr("property") || $(element).attr("name")
        if (property === "og:url" || property === "twitter:url") {
          const content = $(element).attr("content")
          if (content && !content.includes("producthunt.com")) {
            websiteUrl = content
          }
        }
      })
    }

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

    // Look specifically for the "Visit" or "Website" button
    if (!websiteUrl) {
      $("a").each((_, element) => {
        const text = $(element).text().toLowerCase()
        const href = $(element).attr("href")

        if (
          href &&
          !href.includes("producthunt.com") &&
          href.startsWith("http") &&
          (text.includes("visit") || text.includes("website") || text.includes("home"))
        ) {
          websiteUrl = href
          return false // break the loop
        }
      })
    }

    // If we found a website URL, return it
    if (websiteUrl) {
      console.log(`Found website URL from Product Hunt page: ${websiteUrl}`)
      return normalizeUrl(websiteUrl)
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
        return normalizeUrl(urlParam)
      }
    } catch (error) {
      console.error(`Error parsing URL: ${url}`, error)
    }

    // If that fails, try to extract from the Product Hunt page
    const extractedUrl = await extractUrlFromProductHuntPage(url)
    return extractedUrl ? normalizeUrl(extractedUrl) : null
  } catch (error) {
    console.error(`Error resolving Product Hunt redirect: ${url}`, error)
    return null
  }
}

// Find canonical URL to get the exact website URL
async function findCanonicalUrl(url: string): Promise<string> {
  try {
    console.log(`Finding canonical URL for: ${url}`)

    const response = await fetchWithTimeout(
      url,
      {
        headers: {
          "User-Agent": getRandomUserAgent(),
          Accept: "text/html",
        },
        cache: "no-store",
        redirect: "follow", // Follow redirects
      },
      8000,
    ).catch((error) => {
      console.error(`Error fetching ${url} for canonical URL:`, error.message)
      return null
    })

    if (!response || !response.ok) {
      console.log(`Failed to fetch ${url} for canonical URL check`)
      return url // Return original URL if we can't fetch
    }

    // Get the final URL after redirects
    const finalUrl = response.url

    // Get the HTML to check for canonical link
    const html = await response.text().catch((error) => {
      console.error(`Error getting text from ${url}:`, error)
      return ""
    })

    if (!html) {
      return finalUrl // Return the final URL after redirects
    }

    // Parse the HTML to look for canonical link
    const $ = cheerio.load(html)
    const canonicalLink = $('link[rel="canonical"]').attr("href")

    if (canonicalLink && isValidUrl(canonicalLink)) {
      console.log(`Found canonical URL: ${canonicalLink}`)
      return normalizeUrl(canonicalLink)
    }

    // If no canonical link, return the final URL after redirects
    return normalizeUrl(finalUrl)
  } catch (error) {
    console.error(`Error finding canonical URL for ${url}:`, error)
    return url // Return original URL on error
  }
}

// Enhance the contact page checking to look for more contact information
async function checkContactPage(
  baseUrl: string,
  $: cheerio.CheerioAPI,
): Promise<{
  emails: string[]
  socialMedia: {
    twitter: string[]
    facebook: string[]
    instagram: string[]
    linkedin: string[]
  }
  contactUrl: string | null
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
          return {
            emails: [],
            socialMedia: { twitter: [], facebook: [], instagram: [], linkedin: [] },
            contactUrl: contactLinks[0], // Still return the contact URL even if we couldn't fetch it
          }
        }

        const html = await response.text().catch((error) => {
          console.error(`Error getting text from contact page ${contactLinks[0]}:`, error)
          return "" // Return empty string instead of throwing
        })

        if (!html) {
          return {
            emails: [],
            socialMedia: { twitter: [], facebook: [], instagram: [], linkedin: [] },
            contactUrl: contactLinks[0],
          }
        }

        const contactPageEmails = extractEmails(html)

        // Parse the contact page HTML
        let contactPageSocialMedia = { twitter: [], facebook: [], instagram: [], linkedin: [] }
        try {
          const $contact = cheerio.load(html)
          contactPageSocialMedia = extractSocialMedia($contact)

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

          // Look for email addresses in text content
          $contact("p, div, span, address").each((_, element) => {
            const text = $contact(element).text()
            if (text.includes("@") && text.includes(".")) {
              const emails = extractEmails(text)
              if (emails.length > 0) {
                contactPageEmails.push(...emails)
              }
            }
          })
        } catch (parseError) {
          console.error(`Error parsing contact page ${contactLinks[0]}:`, parseError)
          // Continue with empty social media
        }

        return {
          emails: contactPageEmails,
          socialMedia: contactPageSocialMedia,
          contactUrl: contactLinks[0],
        }
      } catch (error) {
        console.error(`Error checking contact page ${contactLinks[0]}:`, error)
        return {
          emails: [],
          socialMedia: { twitter: [], facebook: [], instagram: [], linkedin: [] },
          contactUrl: contactLinks[0],
        }
      }
    }

    return {
      emails: [],
      socialMedia: { twitter: [], facebook: [], instagram: [], linkedin: [] },
      contactUrl: null,
    }
  } catch (error) {
    console.error("Error in checkContactPage:", error)
    return {
      emails: [],
      socialMedia: { twitter: [], facebook: [], instagram: [], linkedin: [] },
      contactUrl: null,
    }
  }
}

// Extract content from footer section
function extractFromFooter($: cheerio.CheerioAPI): {
  emails: string[]
  socialMedia: {
    twitter: string[]
    facebook: string[]
    instagram: string[]
    linkedin: string[]
  }
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

    // Extract social media from footer elements
    const footerSocialMedia = { twitter: [], facebook: [], instagram: [], linkedin: [] }

    try {
      // Process each footer selector individually
      footerSelectors.forEach((selector) => {
        try {
          // Create a new cheerio instance for just this selector
          const footerElements = $(selector)

          if (footerElements.length > 0) {
            // Extract social links from these elements
            const socialLinks = extractSocialMedia($)
            footerSocialMedia.twitter.push(...socialLinks.twitter)
            footerSocialMedia.facebook.push(...socialLinks.facebook)
            footerSocialMedia.instagram.push(...socialLinks.instagram)
            footerSocialMedia.linkedin.push(...socialLinks.linkedin)
          }
        } catch (error) {
          // Skip this selector and continue
        }
      })
    } catch (socialError) {
      console.error("Error extracting social media from footer:", socialError)
    }

    return {
      emails: footerEmails,
      socialMedia: {
        twitter: [...new Set(footerSocialMedia.twitter)],
        facebook: [...new Set(footerSocialMedia.facebook)],
        instagram: [...new Set(footerSocialMedia.instagram)],
        linkedin: [...new Set(footerSocialMedia.linkedin)],
      },
    }
  } catch (error) {
    console.error("Error extracting from footer:", error)
    return {
      emails: [],
      socialMedia: { twitter: [], facebook: [], instagram: [], linkedin: [] },
    }
  }
}

// Add a new function to check about pages for contact information
async function checkAboutPage(
  baseUrl: string,
  $: cheerio.CheerioAPI,
): Promise<{
  emails: string[]
  socialMedia: {
    twitter: string[]
    facebook: string[]
    instagram: string[]
    linkedin: string[]
  }
  aboutUrl: string | null
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
          return {
            emails: [],
            socialMedia: { twitter: [], facebook: [], instagram: [], linkedin: [] },
            aboutUrl: aboutLinks[0],
          }
        }

        const html = await response.text().catch((error) => {
          console.error(`Error getting text from about page ${aboutLinks[0]}:`, error)
          return "" // Return empty string instead of throwing
        })

        if (!html) {
          return {
            emails: [],
            socialMedia: { twitter: [], facebook: [], instagram: [], linkedin: [] },
            aboutUrl: aboutLinks[0],
          }
        }

        const aboutPageEmails = extractEmails(html)

        // Parse the about page HTML
        let aboutPageSocialMedia = { twitter: [], facebook: [], instagram: [], linkedin: [] }
        try {
          const $about = cheerio.load(html)
          aboutPageSocialMedia = extractSocialMedia($about)

          // Look for team member sections which often contain emails
          $about('.team, .team-member, .member, .employee, [class*="team"], [class*="member"]').each((_, element) => {
            const text = $about(element).text()
            if (text.includes("@") && text.includes(".")) {
              const emails = extractEmails(text)
              if (emails.length > 0) {
                aboutPageEmails.push(...emails)
              }
            }
          })
        } catch (parseError) {
          console.error(`Error parsing about page ${aboutLinks[0]}:`, parseError)
          // Continue with empty social media
        }

        return {
          emails: aboutPageEmails,
          socialMedia: aboutPageSocialMedia,
          aboutUrl: aboutLinks[0],
        }
      } catch (error) {
        console.error(`Error checking about page ${aboutLinks[0]}:`, error)
        return {
          emails: [],
          socialMedia: { twitter: [], facebook: [], instagram: [], linkedin: [] },
          aboutUrl: aboutLinks[0],
        }
      }
    }

    return {
      emails: [],
      socialMedia: { twitter: [], facebook: [], instagram: [], linkedin: [] },
      aboutUrl: null,
    }
  } catch (error) {
    console.error("Error in checkAboutPage:", error)
    return {
      emails: [],
      socialMedia: { twitter: [], facebook: [], instagram: [], linkedin: [] },
      aboutUrl: null,
    }
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
  socialMedia: {
    twitter: string[]
    facebook: string[]
    instagram: string[]
    linkedin: string[]
  }
  contactUrl: string | null
  aboutUrl: string | null
  exactWebsiteUrl: string
  externalLinks?: string[]
}> {
  // Default empty response
  const emptyResult = {
    emails: [],
    socialMedia: {
      twitter: [],
      facebook: [],
      instagram: [],
      linkedin: [],
    },
    contactUrl: null,
    aboutUrl: null,
    exactWebsiteUrl: url,
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
    // First, try to get the canonical URL
    const exactWebsiteUrl = await findCanonicalUrl(url)
    console.log(`Canonical URL: ${exactWebsiteUrl}`)

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
      return { ...emptyResult, exactWebsiteUrl }
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
      return { ...emptyResult, exactWebsiteUrl }
    }

    console.log(`Successfully fetched ${url}, HTML length: ${html.length}`)

    // Use a timeout for parsing to prevent hanging on complex HTML
    try {
      const parsePromise = new Promise<{
        emails: string[]
        socialMedia: {
          twitter: string[]
          facebook: string[]
          instagram: string[]
          linkedin: string[]
        }
        contactUrl: string | null
        aboutUrl: string | null
        exactWebsiteUrl: string
        externalLinks: string[]
      }>(async (resolve) => {
        try {
          // Extract emails directly from HTML
          const emails = extractEmails(html)

          // Use cheerio for parsing
          const $ = cheerio.load(html)
          const socialMedia = extractSocialMedia($)

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
          let footerResults = {
            emails: [],
            socialMedia: { twitter: [], facebook: [], instagram: [], linkedin: [] },
          }
          try {
            footerResults = extractFromFooter($)
          } catch (footerError) {
            console.error(`Error extracting from footer for ${url}:`, footerError)
            // Continue with empty footer results
          }

          // Check contact page
          let contactPageResults = {
            emails: [],
            socialMedia: { twitter: [], facebook: [], instagram: [], linkedin: [] },
            contactUrl: null,
          }
          try {
            contactPageResults = await checkContactPage(url, $)
          } catch (contactPageError) {
            console.error(`Error checking contact page for ${url}:`, contactPageError)
            // Continue with empty contact page results
          }

          // Also check about page, which often contains contact info
          let aboutPageResults = {
            emails: [],
            socialMedia: { twitter: [], facebook: [], instagram: [], linkedin: [] },
            aboutUrl: null,
          }
          try {
            aboutPageResults = await checkAboutPage(url, $)
          } catch (aboutPageError) {
            console.error(`Error checking about page for ${url}:`, aboutPageError)
            // Continue with empty about page results
          }

          // Extract external links (limited to 10)
          const externalLinks: string[] = []
          try {
            $("a[href^='http']").each((_, element) => {
              if (externalLinks.length >= 10) return false // Limit to 10 links

              const href = $(element).attr("href") || ""
              if (
                href &&
                !href.includes(new URL(url).hostname) &&
                !href.includes("producthunt.com") &&
                isValidUrl(href)
              ) {
                externalLinks.push(href)
              }
            })
          } catch (linksError) {
            console.error(`Error extracting external links for ${url}:`, linksError)
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
            socialMedia: {
              twitter: [
                ...new Set([
                  ...socialMedia.twitter,
                  ...footerResults.socialMedia.twitter,
                  ...contactPageResults.socialMedia.twitter,
                  ...aboutPageResults.socialMedia.twitter,
                ]),
              ],
              facebook: [
                ...new Set([
                  ...socialMedia.facebook,
                  ...footerResults.socialMedia.facebook,
                  ...contactPageResults.socialMedia.facebook,
                  ...aboutPageResults.socialMedia.facebook,
                ]),
              ],
              instagram: [
                ...new Set([
                  ...socialMedia.instagram,
                  ...footerResults.socialMedia.instagram,
                  ...contactPageResults.socialMedia.instagram,
                  ...aboutPageResults.socialMedia.instagram,
                ]),
              ],
              linkedin: [
                ...new Set([
                  ...socialMedia.linkedin,
                  ...footerResults.socialMedia.linkedin,
                  ...contactPageResults.socialMedia.linkedin,
                  ...aboutPageResults.socialMedia.linkedin,
                ]),
              ],
            },
            contactUrl: contactPageResults.contactUrl,
            aboutUrl: aboutPageResults.aboutUrl,
            exactWebsiteUrl,
            externalLinks: [...new Set(externalLinks)],
          })
        } catch (parseError) {
          console.error(`Error in parse promise for ${url}:`, parseError)
          resolve({ ...emptyResult, exactWebsiteUrl }) // Resolve with empty result instead of rejecting
        }
      })

      const parseTimeoutPromise = new Promise<{
        emails: string[]
        socialMedia: {
          twitter: string[]
          facebook: string[]
          instagram: string[]
          linkedin: string[]
        }
        contactUrl: string | null
        aboutUrl: string | null
        exactWebsiteUrl: string
        externalLinks: string[]
      }>((_, reject) => {
        setTimeout(() => reject(new Error("Parsing timed out")), 8000) // Increased timeout for more thorough parsing
      })

      return await Promise.race([parsePromise, parseTimeoutPromise]).catch((error) => {
        console.error(`Error parsing HTML from ${url}:`, error)
        return { ...emptyResult, exactWebsiteUrl }
      })
    } catch (error) {
      console.error(`Error in HTML parsing for ${url}:`, error)
      return { ...emptyResult, exactWebsiteUrl }
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
          socialMedia: {
            twitter: string[]
            facebook: string[]
            instagram: string[]
            linkedin: string[]
          }
          contactUrl: string | null
          aboutUrl: string | null
          exactWebsiteUrl: string
          externalLinks?: string[]
        }>((_, reject) => {
          setTimeout(() => reject(new Error(`Processing timed out for ${product.name}`)), 15000) // Increased timeout for more thorough processing
        })

        const contactInfo = await Promise.race([processPromise, timeoutPromise]).catch((error) => {
          console.error(`Error or timeout processing ${product.name}:`, error)
          return {
            emails: [],
            socialMedia: {
              twitter: [],
              facebook: [],
              instagram: [],
              linkedin: [],
            },
            contactUrl: null,
            aboutUrl: null,
            exactWebsiteUrl: website,
            externalLinks: [],
          }
        })

        // Update the product in the array
        const index = allUpdatedProducts.findIndex((p) => p.id === product.id)
        if (index !== -1) {
          allUpdatedProducts[index] = {
            ...allUpdatedProducts[index], // Keep existing properties
            website: contactInfo.exactWebsiteUrl || website, // Use the exact website URL we found
            emails: contactInfo.emails || [],
            twitterHandles: contactInfo.socialMedia.twitter || [],
            facebookLinks: contactInfo.socialMedia.facebook || [],
            instagramLinks: contactInfo.socialMedia.instagram || [],
            linkedinLinks: contactInfo.socialMedia.linkedin || [],
            contactLinks: contactInfo.contactUrl ? [contactInfo.contactUrl] : [],
            aboutLinks: contactInfo.aboutUrl ? [contactInfo.aboutUrl] : [],
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

