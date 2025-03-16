"use server"

import type { Product } from "@/types/product"
import * as cheerio from "cheerio"

// User agent strings to rotate through
const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Safari/605.1.15",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:90.0) Gecko/20100101 Firefox/90.0",
]

// List of domains to bypass
const BYPASS_DOMAINS = [
  "facebook.com",
  "fb.com",
  "apple.com",
  "google.com",
  "microsoft.com",
  "amazon.com",
  "twitter.com",
  "x.com",
  "instagram.com",
  "linkedin.com",
  "youtube.com",
  "github.com",
  "netflix.com",
  "spotify.com",
  "adobe.com",
  "salesforce.com",
  "oracle.com",
  "ibm.com",
  "intel.com",
  "cisco.com",
  "samsung.com",
  "meta.com",
  "alphabet.com",
  "openai.com",
  "anthropic.com",
  "gemini.com",
  "bard.google.com",
]

// Get a random user agent
function getRandomUserAgent() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)]
}

// Helper function to check if domain should be bypassed
function shouldBypassDomain(url: string): boolean {
  try {
    const urlObj = new URL(url)
    const domain = urlObj.hostname.toLowerCase()
    return BYPASS_DOMAINS.some((bypassDomain) => domain === bypassDomain || domain.endsWith(`.${bypassDomain}`))
  } catch (error) {
    console.error(`Error parsing URL ${url}:`, error)
    return false
  }
}

// Enhance the extractEmails function to be more aggressive in finding emails
function extractEmails(text: string): string[] {
  // More aggressive email regex that catches more patterns while still being RFC compliant
  const emailPattern =
    /(?:[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*|"(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21\x23-\x5b\x5d-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])*")@(?:(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?|\[(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?|[a-z0-9-]*[a-z0-9]:(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21-\x5a\x53-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])+)\])/gi

  // Also try a simpler pattern to catch more emails that might be missed
  const simpleEmailPattern = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g

  // Also look for obfuscated emails (common anti-scraping technique)
  const obfuscatedPattern = /([a-zA-Z0-9._-]+)\s*[[$$]at[\]$$]\s*([a-zA-Z0-9.-]+)\s*[[$$]dot[\]$$]\s*([a-zA-Z]{2,})/g

  // Extract all potential emails using both patterns
  const strictEmails = text.match(emailPattern) || []
  const simpleEmails = text.match(simpleEmailPattern) || []

  // Process obfuscated emails
  const obfuscatedEmails: string[] = []
  let match
  while ((match = obfuscatedPattern.exec(text)) !== null) {
    obfuscatedEmails.push(`${match[1]}@${match[2]}.${match[3]}`)
  }

  // Also look for emails with [at] and [dot] instead of @ and .
  const atDotPattern =
    /([a-zA-Z0-9._-]+)\s*(?:\[at\]|$$at$$|\s+at\s+)\s*([a-zA-Z0-9.-]+)\s*(?:\[dot\]|$$dot$$|\s+dot\s+)\s*([a-zA-Z]{2,})/g
  while ((match = atDotPattern.exec(text)) !== null) {
    obfuscatedEmails.push(`${match[1]}@${match[2]}.${match[3]}`)
  }

  // Combine and deduplicate
  const allEmails = [...new Set([...strictEmails, ...simpleEmails, ...obfuscatedEmails])]

  // Filter out common false positives and add more patterns to exclude
  return allEmails.filter((email) => {
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
      "localhost",
    ]

    // Check if the domain is in our blacklist
    if (invalidDomains.some((domain) => domainPart.includes(domain))) {
      return false
    }

    return true
  })
}

// Helper functions to extract emails from various sources
function extractEmailsFromUrlParameters(url: string): string[] {
  const emails: string[] = []

  try {
    const urlObj = new URL(url)

    // Check all URL parameters for emails
    urlObj.searchParams.forEach((value, key) => {
      if (
        (key.includes("email") || key.includes("contact") || key.includes("mail")) &&
        value.includes("@") &&
        value.includes(".")
      ) {
        const extractedEmails = extractEmails(value)
        emails.push(...extractedEmails)
      } else if (value.includes("@") && value.includes(".")) {
        // Check all parameter values for potential emails
        const extractedEmails = extractEmails(value)
        emails.push(...extractedEmails)
      }
    })

    // Check URL path for emails (some sites encode emails in the path)
    const path = urlObj.pathname
    if (path.includes("@") && path.includes(".")) {
      const extractedEmails = extractEmails(decodeURIComponent(path))
      emails.push(...extractedEmails)
    }
  } catch (error) {
    console.error("Error extracting emails from URL parameters:", error)
  }

  return [...new Set(emails)]
}

function extractEmailsFromStyles($: cheerio.CheerioAPI): string[] {
  const emails: string[] = []

  try {
    // Check inline style attributes
    $("[style]").each((_, element) => {
      const style = $(element).attr("style") || ""

      // Some sites hide emails in CSS content properties
      if (style.includes("content") && (style.includes("@") || style.includes("\\0040"))) {
        // Try to decode CSS escape sequences
        const decoded = style
          .replace(/\\0040/g, "@")
          .replace(/\\002e/g, ".")
          .replace(/\\002f/g, "/")

        const extractedEmails = extractEmails(decoded)
        emails.push(...extractedEmails)
      }
    })

    // Check style tags
    $("style").each((_, element) => {
      const css = $(element).html() || ""

      // Look for content properties with email addresses
      if (css.includes("content") && (css.includes("@") || css.includes("\\0040"))) {
        // Try to decode CSS escape sequences
        const decoded = css
          .replace(/\\0040/g, "@")
          .replace(/\\002e/g, ".")
          .replace(/\\002f/g, "/")

        const extractedEmails = extractEmails(decoded)
        emails.push(...extractedEmails)
      }
    })
  } catch (error) {
    console.error("Error extracting emails from styles:", error)
  }

  return [...new Set(emails)]
}

function extractEmailsFromDataAttributes($: cheerio.CheerioAPI): string[] {
  const emails: string[] = []

  try {
    // Look for all elements with data attributes
    $("*").each((_, element) => {
      const attribs = $(element).attr() || {}

      // Check all data attributes
      Object.keys(attribs).forEach((attr) => {
        if (attr.startsWith("data-") && typeof attribs[attr] === "string") {
          const value = attribs[attr]

          if (value.includes("@") && value.includes(".")) {
            const extractedEmails = extractEmails(value)
            emails.push(...extractedEmails)
          }

          // Check for encoded emails
          if (attr.includes("email") || attr.includes("contact") || attr.includes("mail")) {
            try {
              // Try to decode as base64
              const decoded = Buffer.from(value, "base64").toString("utf-8")
              if (decoded.includes("@") && decoded.includes(".")) {
                const extractedEmails = extractEmails(decoded)
                emails.push(...extractedEmails)
              }
            } catch (e) {
              // Not base64, continue
            }

            // Try to decode URL encoded values
            try {
              const decoded = decodeURIComponent(value)
              if (decoded.includes("@") && decoded.includes(".")) {
                const extractedEmails = extractEmails(decoded)
                emails.push(...extractedEmails)
              }
            } catch (e) {
              // Not URL encoded, continue
            }
          }
        }
      })
    })
  } catch (error) {
    console.error("Error extracting emails from data attributes:", error)
  }

  return [...new Set(emails)]
}

function extractEmailsFromHiddenContent($: cheerio.CheerioAPI): string[] {
  const emails: string[] = []

  try {
    // Look for HTML comments
    const html = $.html()
    const commentRegex = /<!--([\s\S]*?)-->/g
    let match

    while ((match = commentRegex.exec(html)) !== null) {
      if (match[1] && (match[1].includes("@") || match[1].includes(" at "))) {
        const extractedEmails = extractEmails(match[1])
        emails.push(...extractedEmails)
      }
    }

    // Look for hidden elements that might contain emails
    $(
      '[style*="display:none"], [style*="display: none"], [style*="visibility:hidden"], [style*="visibility: hidden"], [hidden], .hidden',
    ).each((_, element) => {
      const text = $(element).text()
      if (text.includes("@") || text.includes(" at ")) {
        const extractedEmails = extractEmails(text)
        emails.push(...extractedEmails)
      }
    })

    // Look for noscript tags
    $("noscript").each((_, element) => {
      const content = $(element).html() || ""
      if (content.includes("@") || content.includes(" at ")) {
        const extractedEmails = extractEmails(content)
        emails.push(...extractedEmails)
      }
    })
  } catch (error) {
    console.error("Error extracting emails from hidden content:", error)
  }

  return [...new Set(emails)]
}

function extractEmailsFromMetaTags($: cheerio.CheerioAPI): string[] {
  const emails: string[] = []

  try {
    // Check meta tags for emails
    $("meta").each((_, element) => {
      const content = $(element).attr("content") || ""
      if (content.includes("@") && content.includes(".")) {
        const extractedEmails = extractEmails(content)
        emails.push(...extractedEmails)
      }
    })

    // Check OpenGraph and other structured data
    $('meta[property^="og:"], meta[name^="twitter:"], meta[itemprop]').each((_, element) => {
      const content = $(element).attr("content") || ""
      if (content.includes("@") && content.includes(".")) {
        const extractedEmails = extractEmails(content)
        emails.push(...extractedEmails)
      }
    })
  } catch (error) {
    console.error("Error extracting emails from meta tags:", error)
  }

  return [...new Set(emails)]
}

function extractEmailsFromStructuredData($: cheerio.CheerioAPI): string[] {
  const emails: string[] = []

  try {
    // Look for JSON-LD scripts
    $('script[type="application/ld+json"]').each((_, element) => {
      const content = $(element).html() || ""

      try {
        // Try to parse as JSON
        const data = JSON.parse(content)

        // Convert to string to search for emails
        const jsonString = JSON.stringify(data)

        // Extract emails from the JSON string
        if (jsonString.includes("@") && jsonString.includes(".")) {
          const extractedEmails = extractEmails(jsonString)
          emails.push(...extractedEmails)
        }

        // Specifically look for email properties in structured data
        const findEmailsInObject = (obj: any) => {
          if (!obj || typeof obj !== "object") return

          // Check for common email properties
          const emailProps = ["email", "emailAddress", "contactPoint", "contactEmail", "authorEmail"]

          for (const key in obj) {
            // Check if this property might contain an email
            if (emailProps.includes(key.toLowerCase()) && typeof obj[key] === "string") {
              if (obj[key].includes("@") && obj[key].includes(".")) {
                const extractedEmails = extractEmails(obj[key])
                emails.push(...extractedEmails)
              }
            }

            // Recursively check nested objects and arrays
            if (typeof obj[key] === "object" && obj[key] !== null) {
              findEmailsInObject(obj[key])
            }
          }
        }

        findEmailsInObject(data)
      } catch (e) {
        // If JSON parsing fails, try regex extraction
        if (content.includes("@") && content.includes(".")) {
          const extractedEmails = extractEmails(content)
          emails.push(...extractedEmails)
        }
      }
    })
  } catch (error) {
    console.error("Error extracting emails from structured data:", error)
  }

  return [...new Set(emails)]
}

function extractObfuscatedEmails($: cheerio.CheerioAPI): string[] {
  const emails: string[] = []

  try {
    // Look for common email obfuscation patterns

    // 1. Look for elements with data-email attributes
    $("[data-email]").each((_, element) => {
      const encodedEmail = $(element).attr("data-email")
      if (encodedEmail) {
        try {
          // Some sites use base64 encoding
          const decodedEmail = Buffer.from(encodedEmail, "base64").toString("utf-8")
          if (decodedEmail.includes("@") && decodedEmail.includes(".")) {
            emails.push(decodedEmail)
          }
        } catch (e) {
          // If not base64, just use as is
          if (encodedEmail.includes("@") && encodedEmail.includes(".")) {
            emails.push(encodedEmail)
          }
        }
      }
    })

    // 2. Look for JavaScript email obfuscation
    $("script").each((_, element) => {
      const scriptContent = $(element).html() || ""

      // Look for common patterns like "x@y.z".replace(/x/, "email")
      const emailRegex = /"([^"@]+@[^"]+\.[^"]+)"/g
      let match
      while ((match = emailRegex.exec(scriptContent)) !== null) {
        if (match[1] && match[1].includes("@") && match[1].includes(".")) {
          emails.push(match[1])
        }
      }

      // Look for email parts being concatenated
      const concatRegex = /['"]([^'"]+@[^'"]+|[^'"]+\.[^'"]{2,})['"][\s]*\+[\s]*['"]/g
      while ((match = concatRegex.exec(scriptContent)) !== null) {
        if (match[1]) {
          // This is just a part, but we'll check surrounding content
          const context = scriptContent.substring(Math.max(0, match.index - 50), match.index + match[0].length + 50)
          const extractedEmails = extractEmails(context)
          emails.push(...extractedEmails)
        }
      }
    })

    // 3. Look for HTML entities encoded emails
    $("body")
      .find("*")
      .each((_, element) => {
        const html = $(element).html() || ""
        if (html.includes("&#") && (html.includes("@") || html.includes("&#64;"))) {
          try {
            // Decode HTML entities
            const decoded = html.replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(dec))
            const extractedEmails = extractEmails(decoded)
            emails.push(...extractedEmails)
          } catch (e) {
            // Continue if decoding fails
          }
        }
      })

    // 4. Look for emails with [at] and [dot] instead of @ and .
    $("body")
      .find("*")
      .each((_, element) => {
        const text = $(element).text()
        if (
          (text.includes("[at]") || text.includes("(at)") || text.includes(" at ")) &&
          (text.includes("[dot]") || text.includes("(dot)") || text.includes(" dot "))
        ) {
          // Replace common obfuscation patterns and check for emails
          const deobfuscated = text
            .replace(/\[at\]/gi, "@")
            .replace(/$$at$$/gi, "@")
            .replace(/\s+at\s+/gi, "@")
            .replace(/\[dot\]/gi, ".")
            .replace(/$$dot$$/gi, ".")
            .replace(/\s+dot\s+/gi, ".")

          const extractedEmails = extractEmails(deobfuscated)
          emails.push(...extractedEmails)
        }
      })
  } catch (error) {
    console.error("Error extracting obfuscated emails:", error)
  }

  return [...new Set(emails)]
}

function extractEmailsFromAccessibilityAttributes($: cheerio.CheerioAPI): string[] {
  const emails: string[] = []

  try {
    // Check alt text on images
    $("img[alt]").each((_, element) => {
      const altText = $(element).attr("alt") || ""
      if (altText.includes("@") && altText.includes(".")) {
        const extractedEmails = extractEmails(altText)
        emails.push(...extractedEmails)
      }
    })

    // Check aria-label attributes
    $("[aria-label]").each((_, element) => {
      const ariaLabel = $(element).attr("aria-label") || ""
      if (ariaLabel.includes("@") && ariaLabel.includes(".")) {
        const extractedEmails = extractEmails(ariaLabel)
        emails.push(...extractedEmails)
      }
    })

    // Check title attributes
    $("[title]").each((_, element) => {
      const title = $(element).attr("title") || ""
      if (title.includes("@") && title.includes(".")) {
        const extractedEmails = extractEmails(title)
        emails.push(...extractedEmails)
      }
    })
  } catch (error) {
    console.error("Error extracting emails from accessibility attributes:", error)
  }

  return [...new Set(emails)]
}

function extractEmailsFromContactForms($: cheerio.CheerioAPI): string[] {
  const emails: string[] = []

  try {
    // Look for forms with contact or email in their attributes
    $(
      'form[action*="contact"], form[action*="email"], form[id*="contact"], form[class*="contact"], form[id*="email"], form[class*="email"]',
    ).each((_, form) => {
      // Check for hidden fields that might contain emails
      $(form)
        .find('input[type="hidden"]')
        .each((_, input) => {
          const value = $(input).attr("value") || ""
          if (value.includes("@") && value.includes(".")) {
            const extractedEmails = extractEmails(value)
            emails.push(...extractedEmails)
          }
        })

      // Check for default values in visible fields
      $(form)
        .find('input[type="text"], input[type="email"]')
        .each((_, input) => {
          const value = $(input).attr("value") || ""
          const placeholder = $(input).attr("placeholder") || ""

          if (value.includes("@") && value.includes(".")) {
            const extractedEmails = extractEmails(value)
            emails.push(...extractedEmails)
          }

          if (placeholder.includes("@") && placeholder.includes(".")) {
            const extractedEmails = extractEmails(placeholder)
            emails.push(...extractedEmails)
          }
        })
    })
  } catch (error) {
    console.error("Error extracting emails from contact forms:", error)
  }

  return [...new Set(emails)]
}

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
    // First, look specifically for Twitter handles in text content
    $("body")
      .find("*")
      .each((_, element) => {
        try {
          const text = $(element).text()

          // Look for Twitter handles in text (starting with @ followed by alphanumeric chars)
          const twitterHandleRegex = /(?:^|\s)(@[A-Za-z0-9_]{1,15})(?:\s|$)/g
          let match
          while ((match = twitterHandleRegex.exec(text)) !== null) {
            if (match[1] && match[1].length > 1) {
              socialMedia.twitter.push(match[1])
            }
          }
        } catch (error) {
          // Skip this element and continue
        }
      })

    // Look for Twitter icons and links
    $(
      'a[href*="twitter.com"], a[href*="x.com"], a[href*="t.co"], [class*="twitter"], [class*="social"], [id*="social"], footer a, .footer a',
    ).each((_, element) => {
      try {
        const href = $(element).attr("href") || ""
        const classes = $(element).attr("class") || ""
        const id = $(element).attr("id") || ""
        const ariaLabel = $(element).attr("aria-label") || ""
        const title = $(element).attr("title") || ""

        // Check for Twitter in various attributes
        if (
          href.includes("twitter.com/") ||
          href.includes("x.com/") ||
          classes.toLowerCase().includes("twitter") ||
          id.toLowerCase().includes("twitter") ||
          ariaLabel.toLowerCase().includes("twitter") ||
          title.toLowerCase().includes("twitter")
        ) {
          // Try to extract the handle from the URL
          if (href) {
            try {
              const url = new URL(href.startsWith("http") ? href : `https:${href}`)
              const pathParts = url.pathname.split("/").filter(Boolean)

              if (pathParts.length > 0) {
                const handle = pathParts[0]

                // Skip known non-username paths
                if (!["share", "intent", "home", "search", "explore"].includes(handle.toLowerCase())) {
                  // Add @ if it's missing
                  const formattedHandle = handle.startsWith("@") ? handle : `@${handle}`
                  if (formattedHandle.length > 1 && formattedHandle.length <= 16) {
                    socialMedia.twitter.push(formattedHandle)
                  }
                }
              }
            } catch (e) {
              // If URL parsing fails, try regex extraction
              const twitterHandleRegex = /twitter\.com\/([A-Za-z0-9_]+)/i
              const match = href.match(twitterHandleRegex)
              if (match && match[1]) {
                const handle = `@${match[1]}`
                if (handle.length <= 16) {
                  socialMedia.twitter.push(handle)
                }
              }
            }
          }

          // Also check for Twitter handles in the element's text content
          const text = $(element).text()
          if (text) {
            const twitterHandleRegex = /(?:^|\s)(@[A-Za-z0-9_]{1,15})(?:\s|$)/g
            let match
            while ((match = twitterHandleRegex.exec(text)) !== null) {
              if (match[1] && match[1].length > 1) {
                socialMedia.twitter.push(match[1])
              }
            }
          }
        }

        // Similar checks for other social media platforms...
        if (href.includes("facebook.com/") || href.includes("fb.com/")) {
          socialMedia.facebook.push(href)
        }

        if (href.includes("instagram.com/")) {
          socialMedia.instagram.push(href)
        }

        if (href.includes("linkedin.com/")) {
          socialMedia.linkedin.push(href)
        }
      } catch (error) {
        // Skip this element and continue
      }
    })

    // Look for SVG icons that might be Twitter icons
    $('svg, [class*="icon"]').each((_, element) => {
      try {
        const html = $(element).html() || ""
        const classes = $(element).attr("class") || ""
        const parent = $(element).parent()
        const parentHref = parent.attr("href") || ""

        if (
          html.includes("twitter") ||
          classes.includes("twitter") ||
          parentHref.includes("twitter.com") ||
          parentHref.includes("x.com")
        ) {
          // Check if the parent or grandparent is a link
          if (parentHref) {
            try {
              const url = new URL(parentHref.startsWith("http") ? parentHref : `https:${parentHref}`)
              const pathParts = url.pathname.split("/").filter(Boolean)

              if (pathParts.length > 0) {
                const handle = pathParts[0]

                // Skip known non-username paths
                if (!["share", "intent", "home", "search", "explore"].includes(handle.toLowerCase())) {
                  // Add @ if it's missing
                  const formattedHandle = handle.startsWith("@") ? handle : `@${handle}`
                  if (formattedHandle.length > 1 && formattedHandle.length <= 16) {
                    socialMedia.twitter.push(formattedHandle)
                  }
                }
              }
            } catch (e) {
              // If URL parsing fails, continue
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

// Enhance the findCanonicalUrl function to get the exact website URL
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

    // Get the final URL after redirects - this is the real URL
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

// Add this function to extract emails from JavaScript code
function extractEmailsFromJavaScript($: cheerio.CheerioAPI): string[] {
  const emails: string[] = []

  try {
    // Look for script tags
    $("script").each((_, element) => {
      const scriptContent = $(element).html() || ""

      // Extract potential emails from the script content
      const extractedEmails = extractEmails(scriptContent)
      emails.push(...extractedEmails)

      // Look for common patterns like email obfuscation
      const obfuscatedPatterns = [
        /['"]([^'"]+@[^'"]+\.[^'"]{2,})['"]/, // Simple email in quotes
        /['"]([^'"]+)['"][\s]*\+[\s]*['"]@['"][\s]*\+[\s]*['"]([^'"]+\.[^'"]{2,})['"]/, // Split email parts
        /String\.fromCharCode$$([^)]+)$$/g, // Character code obfuscation
      ]

      obfuscatedPatterns.forEach((pattern) => {
        let match
        while ((match = pattern.exec(scriptContent)) !== null) {
          if (pattern.source.includes("fromCharCode")) {
            // Handle character code obfuscation
            try {
              const charCodes = match[1].split(",").map((code) => Number.parseInt(code.trim()))
              const deobfuscated = String.fromCharCode(...charCodes)
              const extractedFromChars = extractEmails(deobfuscated)
              emails.push(...extractedFromChars)
            } catch (e) {
              // Skip if parsing fails
            }
          } else if (pattern.source.includes("\\+")) {
            // Handle split email parts
            try {
              const combinedEmail = `${match[1]}@${match[2]}`
              if (combinedEmail.includes("@") && combinedEmail.includes(".")) {
                emails.push(combinedEmail)
              }
            } catch (e) {
              // Skip if combining fails
            }
          } else if (match[1] && match[1].includes("@") && match[1].includes(".")) {
            // Simple email in quotes
            emails.push(match[1])
          }
        }
      })
    })
  } catch (error) {
    console.error("Error extracting emails from JavaScript:", error)
  }

  return [...new Set(emails)]
}

// Add this function to extract emails from CSS
function extractEmailsFromCSS($: cheerio.CheerioAPI): string[] {
  const emails: string[] = []

  try {
    // Look for style tags
    $("style").each((_, element) => {
      const cssContent = $(element).html() || ""

      // Extract potential emails from the CSS content
      const extractedEmails = extractEmails(cssContent)
      emails.push(...extractedEmails)

      // Look for content properties that might contain emails
      const contentPattern = /content\s*:\s*['"]([^'"]*@[^'"]*\.[^'"]{2,})['"]|content\s*:\s*attr$$([^$$]+)\)/g
      let match
      while ((match = contentPattern.exec(cssContent)) !== null) {
        if (match[1]) {
          // Direct content value
          emails.push(match[1])
        } else if (match[2]) {
          // attr() function - check if it's a data attribute that might contain an email
          const attrName = match[2].trim()
          if (attrName.startsWith("data-")) {
            $(`[${attrName}]`).each((_, el) => {
              const attrValue = $(el).attr(attrName) || ""
              if (attrValue.includes("@") && attrValue.includes(".")) {
                emails.push(attrValue)
              }
            })
          }
        }
      }
    })

    // Also check inline styles
    $("[style]").each((_, element) => {
      const styleAttr = $(element).attr("style") || ""
      if (styleAttr.includes("content") && (styleAttr.includes("@") || styleAttr.includes("\\0040"))) {
        // Try to decode CSS escape sequences
        const decoded = styleAttr.replace(/\\0040/g, "@").replace(/\\002e/g, ".")

        const extractedEmails = extractEmails(decoded)
        emails.push(...extractedEmails)
      }
    })
  } catch (error) {
    console.error("Error extracting emails from CSS:", error)
  }

  return [...new Set(emails)]
}

// Extract from footer function
async function extractFromFooter($: cheerio.CheerioAPI): Promise<{
  emails: string[]
  socialMedia: {
    twitter: string[]
    facebook: string[]
    instagram: string[]
    linkedin: string[]
  }
}> {
  const emails: string[] = []
  const socialMedia = {
    twitter: [] as string[],
    facebook: [] as string[],
    instagram: [] as string[],
    linkedin: [] as string[],
  }

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

    // Check for emails in footer elements
    footerSelectors.forEach((selector) => {
      $(selector).each((_, element) => {
        const text = $(element).text()
        if (text.includes("@") && text.includes(".")) {
          const foundEmails = extractEmails(text)
          emails.push(...foundEmails)
        }
      })
    })

    // Check for social media links in footer
    footerSelectors.forEach((selector) => {
      $(selector)
        .find("a[href]")
        .each((_, link) => {
          const href = $(link).attr("href") || ""

          if (href.includes("twitter.com") || href.includes("x.com")) {
            try {
              const url = new URL(href.startsWith("http") ? href : `https:${href}`)
              const pathParts = url.pathname.split("/").filter(Boolean)

              if (pathParts.length > 0) {
                const handle = pathParts[0]
                if (!["share", "intent", "home", "search"].includes(handle.toLowerCase())) {
                  const formattedHandle = handle.startsWith("@") ? handle : `@${handle}`
                  socialMedia.twitter.push(formattedHandle)
                }
              }
            } catch (e) {
              // If parsing fails, continue
            }
          } else if (href.includes("facebook.com")) {
            socialMedia.facebook.push(href)
          } else if (href.includes("instagram.com")) {
            socialMedia.instagram.push(href)
          } else if (href.includes("linkedin.com")) {
            socialMedia.linkedin.push(href)
          }
        })
    })
  } catch (error) {
    console.error("Error extracting from footer:", error)
  }

  return {
    emails: [...new Set(emails)],
    socialMedia: {
      twitter: [...new Set(socialMedia.twitter)],
      facebook: [...new Set(socialMedia.facebook)],
      instagram: [...new Set(socialMedia.instagram)],
      linkedin: [...new Set(socialMedia.linkedin)],
    },
  }
}

// Check contact page function
async function checkContactPage(
  url: string,
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
  const emails: string[] = []
  const socialMedia = {
    twitter: [] as string[],
    facebook: [] as string[],
    instagram: [] as string[],
    linkedin: [] as string[],
  }
  let contactUrl: string | null = null

  try {
    // Find contact page links
    const contactPatterns = [
      'a[href*="contact"]',
      'a[href*="support"]',
      'a[href^="mailto:"]',
      'a:contains("Contact")',
      'a:contains("Get in touch")',
      'a:contains("Support")',
    ]

    for (const pattern of contactPatterns) {
      $(pattern).each((_, element) => {
        const href = $(element).attr("href")
        if (href) {
          if (href.startsWith("mailto:")) {
            // Extract email directly from mailto link
            const email = href.replace("mailto:", "").split("?")[0].trim()
            if (email.includes("@") && email.includes(".")) {
              emails.push(email)
            }
          } else {
            // Store contact URL for potential analysis
            try {
              let fullUrl = href
              if (!href.startsWith("http")) {
                const baseUrlObj = new URL(url)
                if (href.startsWith("/")) {
                  fullUrl = `${baseUrlObj.origin}${href}`
                } else {
                  fullUrl = `${baseUrlObj.origin}/${href}`
                }
              }
              contactUrl = fullUrl
            } catch (e) {
              // Skip if URL construction fails
            }
          }
        }
      })

      if (contactUrl) break
    }
  } catch (error) {
    console.error("Error checking contact page:", error)
  }

  return {
    emails,
    socialMedia,
    contactUrl,
  }
}

// Check about page function
async function checkAboutPage(
  url: string,
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
  const emails: string[] = []
  const socialMedia = {
    twitter: [] as string[],
    facebook: [] as string[],
    instagram: [] as string[],
    linkedin: [] as string[],
  }
  let aboutUrl: string | null = null

  try {
    // Find about page links
    const aboutPatterns = [
      'a[href*="about"]',
      'a[href*="team"]',
      'a[href*="company"]',
      'a:contains("About")',
      'a:contains("Team")',
      'a:contains("Company")',
    ]

    for (const pattern of aboutPatterns) {
      $(pattern).each((_, element) => {
        const href = $(element).attr("href")
        if (href && !href.includes("mailto:")) {
          try {
            let fullUrl = href
            if (!href.startsWith("http")) {
              const baseUrlObj = new URL(url)
              if (href.startsWith("/")) {
                fullUrl = `${baseUrlObj.origin}${href}`
              } else {
                fullUrl = `${baseUrlObj.origin}/${href}`
              }
            }
            aboutUrl = fullUrl
          } catch (e) {
            // Skip if URL construction fails
          }
        }
      })

      if (aboutUrl) break
    }
  } catch (error) {
    console.error("Error checking about page:", error)
  }

  return {
    emails,
    socialMedia,
    aboutUrl,
  }
}

// Main scraping function for websites
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

  try {
    // First, try to get the canonical URL - this is the exact website URL
    const exactWebsiteUrl = await findCanonicalUrl(url)
    console.log(`Canonical/Exact URL: ${exactWebsiteUrl}`)

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
          const $ = cheerio.load(html)
          const socialMedia = extractSocialMedia($)
          const footerResults = await extractFromFooter($)
          const contactPageResults = await checkContactPage(url, $)
          const aboutPageResults = await checkAboutPage(url, $)

          // Extract all external links
          const externalLinks: string[] = []
          $("a[href]").each((_, element) => {
            const href = $(element).attr("href") || ""
            if (href.startsWith("http") && !href.includes(new URL(url).hostname)) {
              externalLinks.push(href)
            }
          })

          // Extract emails directly from HTML
          const emails = extractEmails(html)

          // Extract emails from JavaScript code
          const jsEmails = extractEmailsFromJavaScript($)

          // Extract emails from CSS
          const cssEmails = extractEmailsFromCSS($)

          // Extract emails from data attributes
          const dataEmails: string[] = []
          $("[data-email], [data-mail], [data-contact]").each((_, element) => {
            const dataEmail =
              $(element).attr("data-email") || $(element).attr("data-mail") || $(element).attr("data-contact") || ""
            if (dataEmail.includes("@") || dataEmail.includes("[at]") || dataEmail.includes("(at)")) {
              const extractedEmails = extractEmails(dataEmail)
              dataEmails.push(...extractedEmails)
            }
          })

          // Look for mailto links
          const mailtoEmails: string[] = []
          $('a[href^="mailto:"]').each((_, element) => {
            const href = $(element).attr("href") || ""
            const email = href.replace("mailto:", "").split("?")[0].trim()
            if (email && email.includes("@") && !email.includes(" ")) {
              mailtoEmails.push(email)
            }
          })

          // Check for obfuscated emails
          const obfuscatedEmails = extractObfuscatedEmails($)

          // Combine all results, removing duplicates
          resolve({
            emails: [
              ...new Set([
                ...emails,
                ...jsEmails,
                ...cssEmails,
                ...dataEmails,
                ...mailtoEmails,
                ...obfuscatedEmails,
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

// Function to process products in batches to avoid timeouts
export async function processBatches(products: Product[], batchSize = 10): Promise<Product[]> {
  const updatedProducts: Product[] = []
  const totalProducts = products.length
  let processedCount = 0

  for (let i = 0; i < totalProducts; i += batchSize) {
    const batch = products.slice(i, i + batchSize)
    console.log(`Processing batch ${Math.floor(i / batchSize) + 1} of ${Math.ceil(totalProducts / batchSize)}`)

    try {
      const batchResults = await extractContactInfo(batch, batchSize)
      updatedProducts.push(...batchResults)
      processedCount += batch.length
      console.log(`Processed ${processedCount}/${totalProducts} products`)

      // Add a delay between batches to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 1000))
    } catch (error) {
      console.error("Error processing batch:", error)
      // Collect partial results and continue
      updatedProducts.push(...batch)
    }
  }

  console.log(`Batch processing complete. Total updated products: ${updatedProducts.length}`)
  return updatedProducts
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
            website: contactInfo.exactWebsiteUrl || website, // Use  // Keep existing properties
            website: contactInfo.exactWebsiteUrl || website, // Use the exact website URL we found
            exactWebsiteUrl: contactInfo.exactWebsiteUrl || website, // Store the exact URL separately
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

