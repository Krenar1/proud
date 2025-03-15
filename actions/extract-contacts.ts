"use server"

import type { Product } from "@/types/product"
import * as cheerio from "cheerio"

// User agent strings to rotate through
const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Safari/605.1.15",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:90.0) Gecko/20100101 Firefox/90.0",
]

// Add this list of domains to bypass near the top of the file, after the USER_AGENTS array:

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

// Add this helper function after the BYPASS_DOMAINS array:

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

// Replace the extractEmails function with this more aggressive version
function extractEmails(text: string): string[] {
  // More aggressive email regex that catches more patterns while still being RFC compliant
  const emailPattern =
    /(?:[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*|"(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21\x23-\x5b\x5d-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])*")@(?:(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?|\[(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?|[a-z0-9-]*[a-z0-9]:(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21-\x5a\x53-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])+)\])/gi

  // Also try a simpler pattern to catch more emails that might be missed
  const simpleEmailPattern = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g

  // Extract all potential emails using both patterns
  const strictEmails = text.match(emailPattern) || []
  const simpleEmails = text.match(simpleEmailPattern) || []

  // Combine and deduplicate
  const allEmails = [...new Set([...strictEmails, ...simpleEmails])]

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
      "test.local",
      "demo.com",
      "placeholder.com",
      "yoursite.com",
      "site.com",
      "user.com",
      "username.com",
      "mydomain.com",
      "mysite.com",
      "mycompany.com",
      "myemail.com",
      "emailaddress.com",
      "mailaddress.com",
      "mailbox.com",
      "mailme.com",
      "emailme.com",
      "contactme.com",
      "contactus.com",
      "info.example",
      "support.example",
      "contact.example",
      "hello.example",
      "admin.example",
      "webmaster.example",
      "postmaster.example",
      "hostmaster.example",
      "sales.example",
      "marketing.example",
      "billing.example",
      "help.example",
      "service.example",
      "feedback.example",
      "enquiry.example",
      "inquiry.example",
      "noreply.example",
      "no-reply.example",
      "donotreply.example",
      "do-not-reply.example",
    ]

    // Check if the domain is in our blacklist
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
      "do-not-reply",
      "webmaster",
      "postmaster",
      "hostmaster",
      "sales",
      "marketing",
      "billing",
      "help",
      "service",
      "feedback",
      "enquiry",
      "inquiry",
      "info",
      "support",
      "contact",
      "admin",
      "webmaster",
      "postmaster",
      "hostmaster",
      "sales",
      "marketing",
      "billing",
      "help",
      "service",
      "feedback",
      "enquiry",
      "inquiry",
    ]

    // Check if the username is in our blacklist
    if (invalidUsernames.some((name) => userPart === name)) {
      return false
    }

    // Check for emails that are likely real
    const likelyRealDomains = [
      ".com",
      ".org",
      ".net",
      ".io",
      ".co",
      ".us",
      ".uk",
      ".ca",
      ".au",
      ".de",
      ".fr",
      ".es",
      ".it",
      ".nl",
      ".ru",
      ".jp",
      ".cn",
      ".in",
      ".br",
      ".mx",
      ".se",
      ".no",
      ".dk",
      ".fi",
      ".pl",
      ".ch",
      ".at",
      ".be",
      ".ie",
      ".nz",
    ]
    const hasLikelyRealDomain = likelyRealDomains.some((domain) => domainPart.endsWith(domain))

    // Additional validation for common email patterns
    const isCommonEmailPattern = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(email)

    // Ensure email doesn't contain suspicious characters
    const hasSuspiciousChars = /[<>{}()[\]\\/]/.test(email)

    // For real domains, be more lenient with validation
    if (hasLikelyRealDomain) {
      return !hasSuspiciousChars
    }

    // For other domains, be more strict
    return isCommonEmailPattern && !hasSuspiciousChars
  })
}

// Add this function to extract emails from URL parameters
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

// Add this function to extract emails from inline CSS and style attributes
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

// Add this function to extract emails from data attributes
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

// Add this new function to scan for emails in comments and hidden elements
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

// Add this function to extract emails from meta tags
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

// Add this function to extract emails from JSON-LD and structured data
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

// Add this new function to extract emails from obfuscated content
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

// Add this function to extract emails from image alt text and aria labels
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

// Add this function to look for contact forms that might contain email hints
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

// Enhance social media extraction to find Twitter handles more accurately
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
                  "i",
                  "status",
                  "statuses",
                  "tweet",
                  "retweet",
                  "like",
                  "reply",
                  "follow",
                  "unfollow",
                  "block",
                  "mute",
                  "report",
                  "lists",
                  "moments",
                  "topics",
                  "bookmarks",
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

              if (handle && handle.length > 1 && handle.length <= 16) {
                // Twitter handles are max 15 chars + @
                socialMedia.twitter.push(handle)
              }
            }
          } catch (e) {
            // If URL parsing fails, try regex extraction
            const twitterHandleRegex = /twitter\.com\/([A-Za-z0-9_]+)/i
            const match = href.match(twitterHandleRegex)
            if (match && match[1]) {
              handle = `@${match[1]}`
              if (handle.length <= 16) {
                // Twitter handles are max 15 chars + @
                socialMedia.twitter.push(handle)
              }
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

// Add this function to extract emails from image URLs
function extractEmailsFromImageUrls($: cheerio.CheerioAPI): string[] {
  const emails: string[] = []

  try {
    // Some sites put email addresses in image URLs (e.g., for tracking or as a CAPTCHA prevention)
    $("img").each((_, element) => {
      const src = $(element).attr("src") || ""

      if (src.includes("@") && src.includes(".")) {
        // Try to extract emails from the URL
        try {
          const decoded = decodeURIComponent(src)
          const extractedEmails = extractEmails(decoded)
          emails.push(...extractedEmails)
        } catch (e) {
          // If decoding fails, try with the original
          const extractedEmails = extractEmails(src)
          emails.push(...extractedEmails)
        }
      }
    })
  } catch (error) {
    console.error("Error extracting emails from image URLs:", error)
  }

  return [...new Set(emails)]
}

// Add this function to extract emails from JavaScript event handlers
function extractEmailsFromEventHandlers($: cheerio.CheerioAPI): string[] {
  const emails: string[] = []

  try {
    // Check for inline event handlers that might contain emails
    const eventAttributes = [
      "onclick",
      "onmouseover",
      "onmouseout",
      "onload",
      "onchange",
      "onfocus",
      "onblur",
      "onsubmit",
      "onreset",
      "onselect",
    ]

    eventAttributes.forEach((attr) => {
      $(`[${attr}]`).each((_, element) => {
        const handler = $(element).attr(attr) || ""

        if (handler.includes("@") || handler.includes("mail") || handler.includes("contact")) {
          // Extract potential emails from the handler
          const extractedEmails = extractEmails(handler)
          emails.push(...extractedEmails)

          // Look for common patterns like "mailto:" or "email="
          if (handler.includes("mailto:") || handler.includes("email=")) {
            const mailtoRegex = /mailto:([^'")\s]+)/i
            const emailParamRegex = /email=([^&'")\s]+)/i

            const mailtoMatch = handler.match(mailtoRegex)
            if (mailtoMatch && mailtoMatch[1]) {
              try {
                const decoded = decodeURIComponent(mailtoMatch[1])
                if (decoded.includes("@") && decoded.includes(".")) {
                  emails.push(decoded)
                }
              } catch (e) {
                // If decoding fails, use as is
                if (mailtoMatch[1].includes("@") && mailtoMatch[1].includes(".")) {
                  emails.push(mailtoMatch[1])
                }
              }
            }

            const emailParamMatch = handler.match(emailParamRegex)
            if (emailParamMatch && emailParamMatch[1]) {
              try {
                const decoded = decodeURIComponent(emailParamMatch[1])
                if (decoded.includes("@") && decoded.includes(".")) {
                  emails.push(decoded)
                }
              } catch (e) {
                // If decoding fails, use as is
                if (emailParamMatch[1].includes("@") && emailParamMatch[1].includes(".")) {
                  emails.push(emailParamMatch[1])
                }
              }
            }
          }
        }
      })
    })
  } catch (error) {
    console.error("Error extracting emails from event handlers:", error)
  }

  return [...new Set(emails)]
}

// Add this function to extract emails from SVG content
function extractEmailsFromSvg($: cheerio.CheerioAPI): string[] {
  const emails: string[] = []

  try {
    // Check SVG elements and their attributes
    $("svg, svg *").each((_, element) => {
      // Check text content in SVG
      const text = $(element).text()
      if (text.includes("@") && text.includes(".")) {
        const extractedEmails = extractEmails(text)
        emails.push(...extractedEmails)
      }

      // Check SVG-specific attributes that might contain text
      const textAttrs = ["text", "tspan", "textPath"]
      if (textAttrs.includes(element.name)) {
        const content = $(element).html() || ""
        if (content.includes("@") && content.includes(".")) {
          const extractedEmails = extractEmails(content)
          emails.push(...extractedEmails)
        }
      }
    })
  } catch (error) {
    console.error("Error extracting emails from SVG content:", error)
  }

  return [...new Set(emails)]
}

// Enhance the scrapeWebsite function to extract exact URLs and better email/Twitter data
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

  // After the URL validation checks but before the main try/catch block, add:

  // Check if this is a major tech company domain we should bypass
  if (shouldBypassDomain(url)) {
    console.log(`Bypassing scraping for major tech domain: ${url}`)
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
      exactWebsiteUrl: url,
      externalLinks: [],
    }
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
          const footerResults = extractFromFooter($)
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

          // Update the scrapeWebsite function to use these new email extraction methods
          // Find the parsePromise section in scrapeWebsite and update the email extraction part:

          // Inside the parsePromise function in scrapeWebsite, replace the email extraction code with:
          // Extract emails directly from HTML
          const emails = extractEmails(html)

          // Extract obfuscated emails
          const obfuscatedEmails = extractObfuscatedEmails($)

          // Extract emails from accessibility attributes
          const accessibilityEmails = extractEmailsFromAccessibilityAttributes($)

          // Extract emails from contact forms
          const contactFormEmails = extractEmailsFromContactForms($)

          // Extract emails from hidden content
          const hiddenContentEmails = extractEmailsFromHiddenContent($)

          // Extract emails from meta tags
          const metaTagEmails = extractEmailsFromMetaTags($)

          // Extract emails from structured data
          const structuredDataEmails = extractEmailsFromStructuredData($)

          // Extract emails from URL parameters
          const urlParameterEmails = extractEmailsFromUrlParameters(url)

          // Extract emails from styles
          const styleEmails = extractEmailsFromStyles($)

          // Extract emails from data attributes
          const dataAttributeEmails = extractEmailsFromDataAttributes($)

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
            // Add more specific selectors
            ".vcard",
            ".hcard",
            ".author",
            ".byline",
            ".signature",
            ".bio",
            ".profile",
            ".about-author",
            ".team-member",
            ".staff",
            ".employee",
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

          // Extract emails from image URLs
          const imageUrlEmails = extractEmailsFromImageUrls($)

          // Extract emails from event handlers
          const eventHandlerEmails = extractEmailsFromEventHandlers($)

          // Extract emails from SVG content
          const svgEmails = extractEmailsFromSvg($)

          // Then, when combining all results, update to include the new sources:
          // Combine all results, removing duplicates
          resolve({
            emails: [
              ...new Set([
                ...emails,
                ...obfuscatedEmails,
                ...accessibilityEmails,
                ...contactFormEmails,
                ...hiddenContentEmails,
                ...metaTagEmails,
                ...structuredDataEmails,
                ...urlParameterEmails,
                ...styleEmails,
                ...dataAttributeEmails,
                ...imageUrlEmails,
                ...eventHandlerEmails,
                ...svgEmails,
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

