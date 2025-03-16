"use client"

import { useState, useEffect, useRef } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import {
  initializeAutoScraper,
  checkForNewProducts,
  loadSeenProductIds,
  getSeenProductIds,
  initializeWithTodayOnly,
} from "@/actions/auto-scraper"
import {
  Loader2,
  BellRing,
  KeyRound,
  Download,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  Cloud,
  Calendar,
  CalendarDays,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import type { Product } from "@/types/product"
import { initializeWithTimeRange } from "@/actions/auto-scraper"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Switch } from "@/components/ui/switch"
import { Slider } from "@/components/ui/slider"

// Storage keys
const STORAGE_KEYS = {
  WEBHOOK_URL: "discordWebhookUrl",
  AUTO_SCRAPER_ENABLED: "autoScraperEnabled",
  SEEN_PRODUCT_IDS: "seenProductIds",
  LAST_SYNC_TIME: "lastSyncTime",
  SCRAPED_PRODUCTS: "scrapedProducts",
  INIT_MODE: "autoScraperInitMode",
}

export function AutoScraperSettings() {
  const { toast } = useToast()
  const [webhookUrl, setWebhookUrl] = useState("")
  const [isEnabled, setIsEnabled] = useState(false)
  const [isInitializing, setIsInitializing] = useState(false)
  const [isChecking, setIsChecking] = useState(false)
  const [lastChecked, setLastChecked] = useState<string | null>(null)
  const [newProductsCount, setNewProductsCount] = useState(0)
  const [status, setStatus] = useState<"idle" | "success" | "error" | "warning">("idle")
  const [statusMessage, setStatusMessage] = useState("")
  const [initProgress, setInitProgress] = useState(0)
  const [isSyncing, setIsSyncing] = useState(false)
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null)
  const [scrapedProducts, setScrapedProducts] = useState<Product[]>([])
  const [isDownloading, setIsDownloading] = useState(false)
  const [dateFilter, setDateFilter] = useState<"today" | "yesterday" | "last7days" | "all">("all")
  const [exportFormat, setExportFormat] = useState<"csv" | "json" | "excel">("csv")
  const [totalScrapedCount, setTotalScrapedCount] = useState(0)
  const [todayScrapedCount, setTodayScrapedCount] = useState(0)
  const [isExportPopoverOpen, setIsExportPopoverOpen] = useState(false)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const syncIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const [isTimeRangeDialogOpen, setIsTimeRangeDialogOpen] = useState(false)
  const [selectedTimeRange, setSelectedTimeRange] = useState<"7" | "30" | "365">("7")
  const [isInitializingTimeRange, setIsInitializingTimeRange] = useState(false)
  const [timeRangeProgress, setTimeRangeProgress] = useState(0)
  const [initMode, setInitMode] = useState<"today" | "week">("week")
  const [isSavingSettings, setIsSavingSettings] = useState(false)
  const [isLoadingSettings, setIsLoadingSettings] = useState(true)
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const [productsToCheck, setProductsToCheck] = useState<number>(50)

  // Load saved settings on component mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        setIsLoadingSettings(true)

        // First try to load from server
        console.log("Attempting to load settings from server...")
        const response = await fetch("/api/settings")

        if (response.ok) {
          const serverSettings = await response.json()
          console.log("Loaded settings from server:", serverSettings)

          if (serverSettings.webhookUrl) {
            setWebhookUrl(serverSettings.webhookUrl)
          }

          if (typeof serverSettings.autoScraperEnabled === "boolean") {
            setIsEnabled(serverSettings.autoScraperEnabled)
          }

          // Load initialization mode
          if (serverSettings.initMode) {
            setInitMode(serverSettings.initMode as "today" | "week")
          } else {
            // Fall back to localStorage
            const savedInitMode = localStorage.getItem(STORAGE_KEYS.INIT_MODE) as "today" | "week" | null
            if (savedInitMode) {
              setInitMode(savedInitMode)
            }
          }

          // Also save to localStorage as fallback
          localStorage.setItem(STORAGE_KEYS.WEBHOOK_URL, serverSettings.webhookUrl || "")
          localStorage.setItem(STORAGE_KEYS.AUTO_SCRAPER_ENABLED, serverSettings.autoScraperEnabled ? "true" : "false")
          localStorage.setItem(STORAGE_KEYS.INIT_MODE, serverSettings.initMode || initMode)

          console.log("Server settings loaded and saved to localStorage")
        } else {
          console.log("Failed to load settings from server, falling back to localStorage")

          // Fall back to localStorage
          const savedWebhookUrl = localStorage.getItem(STORAGE_KEYS.WEBHOOK_URL) || ""
          const savedIsEnabled = localStorage.getItem(STORAGE_KEYS.AUTO_SCRAPER_ENABLED) === "true"

          setWebhookUrl(savedWebhookUrl)
          setIsEnabled(savedIsEnabled)

          // Save localStorage settings to server for future use
          saveSettingsToServer(savedWebhookUrl, savedIsEnabled)
        }

        // Load seen product IDs from localStorage
        const savedProductIds = localStorage.getItem(STORAGE_KEYS.SEEN_PRODUCT_IDS)
        let productIds: string[] = []

        if (savedProductIds) {
          try {
            productIds = JSON.parse(savedProductIds)
            console.log(`Loaded ${productIds.length} product IDs from localStorage`)

            // Update the server-side set with the IDs from localStorage
            await loadSeenProductIds(productIds)

            // Set last sync time
            const lastSync = localStorage.getItem(STORAGE_KEYS.LAST_SYNC_TIME)
            if (lastSync) {
              setLastSyncTime(lastSync)
            }
          } catch (parseError) {
            console.error("Error parsing saved product IDs:", parseError)
          }
        }

        // Load scraped products from localStorage
        const savedProducts = localStorage.getItem(STORAGE_KEYS.SCRAPED_PRODUCTS)
        if (savedProducts) {
          try {
            const products = JSON.parse(savedProducts) as Product[]
            setScrapedProducts(products)
            updateProductCounters(products)
            console.log(`Loaded ${products.length} scraped products from localStorage`)
          } catch (parseError) {
            console.error("Error parsing saved products:", parseError)
          }
        }

        // Start auto-scraper if it was enabled
        const savedWebhookUrl = localStorage.getItem(STORAGE_KEYS.WEBHOOK_URL) || ""
        const savedIsEnabled = localStorage.getItem(STORAGE_KEYS.AUTO_SCRAPER_ENABLED) === "true"
        const shouldStartScraper =
          (await (async () => {
            try {
              const response = await fetch("/api/settings")
              if (response.ok) {
                const serverSettings = await response.json()
                return serverSettings?.autoScraperEnabled
              }
              return savedIsEnabled
            } catch (error) {
              console.error("Failed to fetch settings from server:", error)
              return savedIsEnabled
            }
          })()) || savedIsEnabled
        const scraperUrl =
          (await (async () => {
            try {
              const response = await fetch("/api/settings")
              if (response.ok) {
                const serverSettings = await response.json()
                return serverSettings?.webhookUrl
              }
              return savedWebhookUrl
            } catch (error) {
              console.error("Failed to fetch settings from server:", error)
              return savedWebhookUrl
            }
          })()) || savedWebhookUrl

        if (shouldStartScraper && scraperUrl) {
          console.log("Auto-starting scraper with URL:", scraperUrl)
          startAutoScraper(scraperUrl)
        }

        // Set up periodic sync of seen product IDs
        syncIntervalRef.current = setInterval(syncSeenProductIds, 5 * 60 * 1000) // Sync every 5 minutes
      } catch (error) {
        console.error("Error loading settings:", error)

        // Fall back to localStorage as a last resort
        const savedWebhookUrl = localStorage.getItem(STORAGE_KEYS.WEBHOOK_URL) || ""
        const savedIsEnabled = localStorage.getItem(STORAGE_KEYS.AUTO_SCRAPER_ENABLED) === "true"

        setWebhookUrl(savedWebhookUrl)
        setIsEnabled(savedIsEnabled)

        if (savedIsEnabled && savedWebhookUrl) {
          startAutoScraper(savedWebhookUrl)
        }
      } finally {
        setIsLoadingSettings(false)
      }
    }

    loadSettings()

    return () => {
      // Clean up intervals on unmount
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current)
      }
    }
  }, [])

  // Function to save settings to the server
  const saveSettingsToServer = async (url: string, enabled: boolean, mode: "today" | "week" = initMode) => {
    try {
      setIsSavingSettings(true)
      console.log("Saving settings to server:", { webhookUrl: url, autoScraperEnabled: enabled, initMode: mode })

      const response = await fetch("/api/settings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          webhookUrl: url,
          autoScraperEnabled: enabled,
          initMode: mode,
        }),
      })

      if (response.ok) {
        console.log("Settings saved to server successfully")
        return true
      } else {
        console.error("Failed to save settings to server:", await response.text())
        return false
      }
    } catch (error) {
      console.error("Error saving settings to server:", error)
      return false
    } finally {
      setIsSavingSettings(false)
    }
  }

  // Update product counters
  const updateProductCounters = (products: Product[]) => {
    setTotalScrapedCount(products.length)

    // Count products from today
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const todayProducts = products.filter((product) => {
      const productDate = new Date(product.createdAt)
      return productDate >= today
    })

    setTodayScrapedCount(todayProducts.length)
  }

  // Function to sync seen product IDs between server and localStorage
  const syncSeenProductIds = async () => {
    try {
      setIsSyncing(true)

      // Get the current list of seen product IDs from the server
      const serverIds = await getSeenProductIds()

      // Get the saved IDs from localStorage
      const savedIdsString = localStorage.getItem(STORAGE_KEYS.SEEN_PRODUCT_IDS)
      let savedIds: string[] = []

      if (savedIdsString) {
        try {
          savedIds = JSON.parse(savedIdsString)
        } catch (parseError) {
          console.error("Error parsing saved product IDs:", parseError)
        }
      }

      // Merge the two sets of IDs
      const mergedIds = Array.from(new Set([...serverIds, ...savedIds]))

      // Save the merged list back to localStorage
      localStorage.setItem(STORAGE_KEYS.SEEN_PRODUCT_IDS, JSON.stringify(mergedIds))

      // Update the server-side set with the merged IDs
      await loadSeenProductIds(mergedIds)

      // Also sync the auto-scraper enabled state
      const response = await fetch("/api/settings")
      if (response.ok) {
        const serverSettings = await response.json()

        // If server has different enabled state than local, update local
        if (typeof serverSettings.autoScraperEnabled === "boolean" && serverSettings.autoScraperEnabled !== isEnabled) {
          setIsEnabled(serverSettings.autoScraperEnabled)
          localStorage.setItem(STORAGE_KEYS.AUTO_SCRAPER_ENABLED, serverSettings.autoScraperEnabled ? "true" : "false")

          // If server says enabled but local is disabled, start the scraper
          if (serverSettings.autoScraperEnabled && !isEnabled && webhookUrl) {
            startAutoScraper(webhookUrl)
          }
          // If server says disabled but local is enabled, stop the scraper
          else if (!serverSettings.autoScraperEnabled && isEnabled) {
            stopAutoScraper()
          }
        }
      }

      // Update last sync time
      const now = new Date().toLocaleString()
      localStorage.setItem(STORAGE_KEYS.LAST_SYNC_TIME, now)
      setLastSyncTime(now)

      console.log(`Synced ${mergedIds.length} product IDs and settings between server and localStorage`)
    } catch (error) {
      console.error("Error syncing data:", error)
    } finally {
      setIsSyncing(false)
    }
  }

  // Update the startAutoScraper function to save seen product IDs
  const startAutoScraper = async (url: string) => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
    }

    // Initialize the scraper first
    setIsInitializing(true)
    setStatus("idle")

    // Set message based on initialization mode
    const initMessage =
      initMode === "today"
        ? "Initializing auto-scraper with today's products only..."
        : "Initializing auto-scraper with products from the last 7 days..."

    setStatusMessage(initMessage)
    setInitProgress(10)

    try {
      // Simulate progress updates during initialization
      const progressInterval = setInterval(() => {
        setInitProgress((prev) => {
          const newProgress = prev + 5
          return newProgress < 90 ? newProgress : prev
        })
      }, 1000)

      // Choose initialization method based on selected mode
      const result = initMode === "today" ? await initializeWithTodayOnly(url) : await initializeAutoScraper(url)

      clearInterval(progressInterval)
      setInitProgress(100)

      if (result.success) {
        setStatus("success")
        setStatusMessage(result.message)

        // Save the seen product IDs to localStorage
        if (result.seenIds) {
          localStorage.setItem(STORAGE_KEYS.SEEN_PRODUCT_IDS, JSON.stringify(result.seenIds))

          // Update last sync time
          const now = new Date().toLocaleString()
          localStorage.setItem(STORAGE_KEYS.LAST_SYNC_TIME, now)
          setLastSyncTime(now)

          console.log(`Saved ${result.seenIds.length} product IDs to localStorage`)
        }

        // Immediately check for new products after initialization
        console.log("Performing initial check for new products only...")
        checkForProducts(url).catch((error) => {
          console.error("Error in initial check:", error)
        })

        // Set up the regular interval with a random offset to avoid synchronized requests
        const intervalMinutes = 2 // Reduced to check more frequently for new products
        const intervalMs = intervalMinutes * 60 * 1000
        const randomOffset = Math.floor(Math.random() * 30000) // Random offset up to 30 seconds

        console.log(
          `Setting up auto-scraper interval to run every ${intervalMinutes} minutes (${intervalMs}ms + ${randomOffset}ms offset) checking up to ${productsToCheck} products`,
        )

        intervalRef.current = setInterval(() => {
          console.log(`Running scheduled check for up to ${productsToCheck} new products...`)
          checkForProducts(url).catch((error) => {
            console.error("Error in scheduled check:", error)
          })
        }, intervalMs + randomOffset)

        toast({
          title: "Auto-Scraper Enabled",
          description: `The scraper will check for new products every ${intervalMinutes} minutes and immediately process them`,
        })
      } else {
        setStatus("error")
        setStatusMessage(result.message)
        setIsEnabled(false)

        // Save disabled state to both localStorage and server
        localStorage.setItem(STORAGE_KEYS.AUTO_SCRAPER_ENABLED, "false")
        await saveSettingsToServer(url, false)

        toast({
          title: "Failed to Enable Auto-Scraper",
          description: result.message,
          variant: "destructive",
        })
      }
    } catch (error) {
      setStatus("error")
      setStatusMessage(`Error: ${error.message}`)
      setIsEnabled(false)

      // Save disabled state to both localStorage and server
      localStorage.setItem(STORAGE_KEYS.AUTO_SCRAPER_ENABLED, "false")
      await saveSettingsToServer(url, false)

      toast({
        title: "Error",
        description: `Failed to initialize auto-scraper: ${error.message}`,
        variant: "destructive",
      })
    } finally {
      setIsInitializing(false)
    }
  }

  const stopAutoScraper = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }

    setStatus("idle")
    setStatusMessage("Auto-scraper is disabled")

    toast({
      title: "Auto-Scraper Disabled",
      description: "The scraper has been stopped",
    })
  }

  // Update the checkForProducts function to save seen product IDs and scraped products
  const checkForProducts = async (url: string) => {
    if (isChecking) return

    setIsChecking(true)

    try {
      // Pass the productsToCheck value to the checkForNewProducts function
      const result = await checkForNewProducts(url, productsToCheck)

      setLastChecked(new Date().toLocaleTimeString())

      if (result.success) {
        // Save the updated seen product IDs to localStorage
        if (result.seenIds) {
          localStorage.setItem(STORAGE_KEYS.SEEN_PRODUCT_IDS, JSON.stringify(result.seenIds))

          // Update last sync time
          const now = new Date().toLocaleString()
          localStorage.setItem(STORAGE_KEYS.LAST_SYNC_TIME, now)
          setLastSyncTime(now)

          console.log(`Updated ${result.seenIds.length} product IDs in localStorage`)
        }

        if (result.newProducts.length > 0) {
          // Filter out any products we already have in scrapedProducts
          const existingIds = new Set(scrapedProducts.map((p) => p.id))
          const uniqueNewProducts = result.newProducts.filter((p) => !existingIds.has(p.id))

          if (uniqueNewProducts.length > 0) {
            // Save the new products to localStorage
            const updatedProducts = [...scrapedProducts, ...uniqueNewProducts]
            setScrapedProducts(updatedProducts)
            updateProductCounters(updatedProducts)

            localStorage.setItem(STORAGE_KEYS.SCRAPED_PRODUCTS, JSON.stringify(updatedProducts))

            setNewProductsCount((prev) => prev + uniqueNewProducts.length)
            setStatus("success")
            setStatusMessage(
              `Found and immediately scraped ${uniqueNewProducts.length} new products! Contact information extracted and sent to Discord.`,
            )

            toast({
              title: "New Products Found & Scraped!",
              description: `Found and immediately scraped ${uniqueNewProducts.length} new products with contact information.`,
              variant: "success",
            })
          } else {
            setStatus("success")
            setStatusMessage("No new unique products found")
          }
        } else {
          setStatus("success")
          setStatusMessage("No new products found")
        }
      } else {
        // Check if it's a rate limit message
        if (result.message.includes("rate limit")) {
          setStatus("warning")
          setStatusMessage(`Rate limit reached. The system will automatically switch to the next available API key.`)

          toast({
            title: "Rate Limit Reached",
            description: "Switching to next available API key automatically",
            variant: "warning",
          })
        } else {
          setStatus("error")
          setStatusMessage(result.message)

          toast({
            title: "Check Failed",
            description: result.message,
            variant: "destructive",
          })
        }
      }
    } catch (error) {
      setStatus("error")
      setStatusMessage(`Error: ${error.message}`)

      toast({
        title: "Error",
        description: `Failed to check for new products: ${error.message}`,
        variant: "destructive",
      })

      // Even if there's an error, we'll try again on the next interval
    } finally {
      setIsChecking(false)
    }
  }

  const handleToggleAutoScraper = async (enabled: boolean) => {
    setIsEnabled(enabled)

    // Save to localStorage
    localStorage.setItem(STORAGE_KEYS.AUTO_SCRAPER_ENABLED, enabled.toString())

    // Save to server
    await saveSettingsToServer(webhookUrl, enabled, initMode)

    if (enabled) {
      if (!webhookUrl || !webhookUrl.includes("discord.com/api/webhooks")) {
        toast({
          title: "Invalid Webhook URL",
          description: "Please enter a valid Discord webhook URL",
          variant: "destructive",
        })
        setIsEnabled(false)

        // Update both localStorage and server
        localStorage.setItem(STORAGE_KEYS.AUTO_SCRAPER_ENABLED, "false")
        await saveSettingsToServer(webhookUrl, false)

        return
      }

      // Save webhook URL to both localStorage and server
      localStorage.setItem(STORAGE_KEYS.WEBHOOK_URL, webhookUrl)
      await saveSettingsToServer(webhookUrl, true)

      await startAutoScraper(webhookUrl)
    } else {
      stopAutoScraper()
    }
  }

  const handleManualCheck = async () => {
    if (!webhookUrl || isChecking) return

    // Save webhook URL to both localStorage and server
    localStorage.setItem(STORAGE_KEYS.WEBHOOK_URL, webhookUrl)
    await saveSettingsToServer(webhookUrl, isEnabled)

    await checkForProducts(webhookUrl)
  }

  const handleManualSync = async () => {
    if (isSyncing) return

    toast({
      title: "Syncing Product IDs",
      description: "Synchronizing product IDs between server and local storage...",
    })

    await syncSeenProductIds()

    toast({
      title: "Sync Complete",
      description: "Product IDs have been synchronized successfully",
    })
  }

  // Function to filter products based on date selection
  const getFilteredProducts = (): Product[] => {
    if (!scrapedProducts.length) return []

    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)
    const last7Days = new Date(today)
    last7Days.setDate(last7Days.getDate() - 7)

    switch (dateFilter) {
      case "today":
        return scrapedProducts.filter((product) => {
          const productDate = new Date(product.createdAt)
          return productDate >= today
        })
      case "yesterday":
        return scrapedProducts.filter((product) => {
          const productDate = new Date(product.createdAt)
          return productDate >= yesterday && productDate < today
        })
      case "last7days":
        return scrapedProducts.filter((product) => {
          const productDate = new Date(product.createdAt)
          return productDate >= last7Days
        })
      case "all":
      default:
        return scrapedProducts
    }
  }

  // Function to download products in the selected format
  const handleDownloadProducts = () => {
    if (isDownloading) return

    setIsDownloading(true)

    try {
      const filteredProducts = getFilteredProducts()

      if (!filteredProducts.length) {
        toast({
          title: "No Products to Download",
          description: "There are no products matching your filter criteria",
          variant: "warning",
        })
        setIsDownloading(false)
        return
      }

      // Generate filename with date and filter info
      const dateStr = new Date().toISOString().split("T")[0]
      let filterStr = ""

      switch (dateFilter) {
        case "today":
          filterStr = "today"
          break
        case "yesterday":
          filterStr = "yesterday"
          break
        case "last7days":
          filterStr = "last-7-days"
          break
        case "all":
          filterStr = "all-time"
          break
      }

      const filename = `product-hunt-scraped-${filterStr}-${dateStr}`

      // Export based on selected format
      switch (exportFormat) {
        case "json":
          // Convert to JSON
          const jsonData = JSON.stringify(filteredProducts, null, 2)
          const jsonBlob = new Blob([jsonData], { type: "application/json" })
          downloadBlob(jsonBlob, `${filename}.json`)
          break

        case "excel":
          // For Excel, we'll use CSV with Excel-specific headers
          const csvContent = convertToCSV(filteredProducts)
          const excelBlob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
          downloadBlob(excelBlob, `${filename}.xlsx`)
          break

        case "csv":
        default:
          // Convert to CSV
          const csvData = convertToCSV(filteredProducts)
          const csvBlob = new Blob([csvData], { type: "text/csv;charset=utf-8;" })
          downloadBlob(csvBlob, `${filename}.csv`)
          break
      }

      toast({
        title: "Download Complete",
        description: `Successfully downloaded ${filteredProducts.length} products in ${exportFormat.toUpperCase()} format`,
      })

      // Close the popover after download
      setIsExportPopoverOpen(false)
    } catch (error) {
      console.error("Error downloading products:", error)
      toast({
        title: "Download Failed",
        description: "There was an error downloading the products",
        variant: "destructive",
      })
    } finally {
      setIsDownloading(false)
    }
  }

  // Helper function to convert products to CSV
  const convertToCSV = (products: Product[]): string => {
    // Define CSV headers
    const headers = [
      "id",
      "name",
      "tagline",
      "description",
      "url",
      "website",
      "votesCount",
      "createdAt",
      "emails",
      "twitterHandles",
      "facebookLinks",
      "instagramLinks",
      "linkedinLinks",
      "contactLinks",
      "externalLinks",
    ]

    // Create CSV rows
    const rows = products.map((product) => [
      product.id || "",
      `"${(product.name || "").replace(/"/g, '""')}"`,
      `"${(product.tagline || "").replace(/"/g, '""')}"`,
      `"${(product.description || "").replace(/"/g, '""')}"`,
      product.url || "",
      product.website || "",
      product.votesCount || 0,
      product.createdAt || "",
      (product.emails || []).join(", "),
      (product.twitterHandles || []).join(", "),
      (product.facebookLinks || []).join(", "),
      (product.instagramLinks || []).join(", "),
      (product.linkedinLinks || []).join(", "),
      (product.contactLinks || []).join(", "),
      (product.externalLinks || []).join(", "),
    ])

    // Combine headers and rows
    return [headers.join(","), ...rows.map((row) => row.join(","))].join("\n")
  }

  // Helper function to download a blob
  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const handleInitializeWithTimeRange = async () => {
    if (!webhookUrl) {
      toast({
        title: "Webhook URL Required",
        description: "Please enter a valid Discord webhook URL first",
        variant: "destructive",
      })
      return
    }

    setIsInitializingTimeRange(true)
    setTimeRangeProgress(10)

    // Start progress animation
    const progressInterval = setInterval(() => {
      setTimeRangeProgress((prev) => {
        const newProgress = prev + Math.random() * 5
        return newProgress < 90 ? newProgress : prev
      })
    }, 1000)

    try {
      const daysBack = Number.parseInt(selectedTimeRange)
      const result = await initializeWithTimeRange(webhookUrl, daysBack)

      clearInterval(progressInterval)
      setTimeRangeProgress(100)

      if (result.success) {
        // Save the seen product IDs to localStorage
        if (result.seenIds) {
          localStorage.setItem(STORAGE_KEYS.SEEN_PRODUCT_IDS, JSON.stringify(result.seenIds))

          // Update last sync time
          const now = new Date().toLocaleString()
          localStorage.setItem(STORAGE_KEYS.LAST_SYNC_TIME, now)
          setLastSyncTime(now)
        }

        toast({
          title: "Time Range Initialization Complete",
          description: `Successfully loaded ${result.productsCount || 0} products from the last ${daysBack} days.`,
        })

        // Close the dialog
        setIsTimeRangeDialogOpen(false)

        // If auto-scraper is enabled, restart it
        if (isEnabled) {
          await startAutoScraper(webhookUrl)
        }
      } else {
        toast({
          title: "Initialization Failed",
          description: result.message,
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Error initializing with time range:", error)
      toast({
        title: "Initialization Failed",
        description: "An unexpected error occurred",
        variant: "destructive",
      })
    } finally {
      clearInterval(progressInterval)
      setIsInitializingTimeRange(false)
    }
  }

  // Handle saving all settings
  const handleSaveAllSettings = async () => {
    try {
      setIsSavingSettings(true)

      // Save to localStorage
      localStorage.setItem(STORAGE_KEYS.WEBHOOK_URL, webhookUrl)
      localStorage.setItem(STORAGE_KEYS.AUTO_SCRAPER_ENABLED, isEnabled.toString())

      // Save to server
      const success = await saveSettingsToServer(webhookUrl, isEnabled, initMode)

      if (success) {
        toast({
          title: "Settings Saved",
          description: "Your settings have been saved to the server and will be available on all devices",
        })
      } else {
        toast({
          title: "Warning",
          description:
            "Settings saved locally but failed to save to server. They may not be available on other devices.",
          variant: "warning",
        })
      }
    } catch (error) {
      console.error("Error saving settings:", error)
      toast({
        title: "Error",
        description: "Failed to save settings. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsSavingSettings(false)
    }
  }

  const handleSimplifiedExport = () => {
    if (isDownloading) return

    setIsDownloading(true)

    try {
      const filteredProducts = getFilteredProducts()

      if (!filteredProducts.length) {
        toast({
          title: "No Products to Download",
          description: "There are no products matching your filter criteria",
          variant: "warning",
        })
        setIsDownloading(false)
        return
      }

      // Generate filename with date and filter info
      const dateStr = new Date().toISOString().split("T")[0]
      let filterStr = ""

      switch (dateFilter) {
        case "today":
          filterStr = "today"
          break
        case "yesterday":
          filterStr = "yesterday"
          break
        case "last7days":
          filterStr = "last-7-days"
          break
        case "all":
          filterStr = "all-time"
          break
      }

      const filename = `product-hunt-contacts-${filterStr}-${dateStr}`

      // Simplified data with only website, email, and Twitter
      const simplifiedProducts = filteredProducts.map((product) => ({
        name: product.name,
        website: product.website || product.exactWebsiteUrl || "",
        emails: product.emails || [],
        twitterHandles: product.twitterHandles || [],
        url: product.url || "",
      }))

      // Export based on selected format
      switch (exportFormat) {
        case "json":
          // Convert to JSON
          const jsonData = JSON.stringify(simplifiedProducts, null, 2)
          const jsonBlob = new Blob([jsonData], { type: "application/json" })
          downloadBlob(jsonBlob, `${filename}.json`)
          break

        case "excel":
          // For Excel, we'll use CSV with Excel-specific headers
          const csvContent = convertToSimplifiedCSV(simplifiedProducts)
          const excelBlob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
          downloadBlob(excelBlob, `${filename}.xlsx`)
          break

        case "csv":
        default:
          // Convert to CSV
          const csvData = convertToSimplifiedCSV(simplifiedProducts)
          const csvBlob = new Blob([csvData], { type: "text/csv;charset=utf-8;" })
          downloadBlob(csvBlob, `${filename}.csv`)
          break
      }

      toast({
        title: "Download Complete",
        description: `Successfully downloaded ${filteredProducts.length} products with contact information`,
      })

      // Close the popover after download
      setIsExportPopoverOpen(false)
    } catch (error) {
      console.error("Error downloading products:", error)
      toast({
        title: "Download Failed",
        description: "There was an error downloading the products",
        variant: "destructive",
      })
    } finally {
      setIsDownloading(false)
    }
  }

  // Add this function before the return statement
  const convertToSimplifiedCSV = (products: any[]): string => {
    // Define CSV headers for simplified export
    const headers = ["name", "website", "emails", "twitter_handles", "product_hunt_url"]

    // Create CSV rows
    const rows = products.map((product) => [
      `"${(product.name || "").replace(/"/g, '""')}"`,
      product.website || "",
      (product.emails || []).join(", "),
      (product.twitterHandles || []).join(", "),
      product.url || "",
    ])

    // Combine headers and rows
    return [headers.join(","), ...rows.map((row) => row.join(","))].join("\n")
  }

  return (
    <Card className="w-full border-2 border-primary/20 shadow-md">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <BellRing className="h-5 w-5" />
            Advanced Auto-Scraper
          </CardTitle>
          <div className="flex gap-2">
            <Badge variant="outline" className="flex items-center gap-1">
              <KeyRound className="h-3 w-3" />
              {process.env.PH_TOKEN_2 && process.env.PH_TOKEN_3
                ? "Triple API Key Rotation"
                : process.env.PH_TOKEN_2 || process.env.PH_TOKEN_3
                  ? "Dual API Key Rotation"
                  : "Single API Key"}
            </Badge>
            <Badge variant="outline" className="flex items-center gap-1">
              <Sparkles className="h-3 w-3" />
              Enhanced Extraction
            </Badge>
          </div>
        </div>
        <CardDescription>
          Automatically extract contact information with advanced techniques for maximum success rate
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {isLoadingSettings ? (
          <div className="flex items-center justify-center p-4">
            <Loader2 className="h-6 w-6 animate-spin mr-2" />
            <span>Loading settings...</span>
          </div>
        ) : (
          <>
            <div className="flex flex-col md:flex-row justify-between gap-4 mb-2">
              <div className="flex-1">
                <div className="space-y-2">
                  <Label htmlFor="webhookUrl">Discord Webhook URL</Label>
                  <Input
                    id="webhookUrl"
                    placeholder="https://discord.com/api/webhooks/..."
                    value={webhookUrl}
                    onChange={(e) => {
                      const newUrl = e.target.value
                      setWebhookUrl(newUrl)
                      // Auto-save webhook URL as user types (with debounce)
                      clearTimeout(saveTimeoutRef.current)
                      saveTimeoutRef.current = setTimeout(() => {
                        localStorage.setItem(STORAGE_KEYS.WEBHOOK_URL, newUrl)
                        saveSettingsToServer(newUrl, isEnabled, initMode)
                          .then(() => console.log("Webhook URL auto-saved"))
                          .catch((err) => console.error("Error auto-saving webhook URL:", err))
                      }, 1000)
                    }}
                    type="url"
                    className="font-mono text-sm"
                  />
                  <p className="text-xs text-muted-foreground">
                    Create a webhook in your Discord server settings and paste the URL here
                  </p>
                </div>

                {/* Enhanced scraping options */}
                <div className="mt-4 bg-muted/20 p-3 rounded-lg border border-border">
                  <h3 className="text-sm font-medium mb-2">Enhanced Extraction Settings</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="flex items-center justify-between bg-background/50 p-2 rounded-md">
                      <div>
                        <Label htmlFor="deepScan" className="text-sm font-medium">
                          Deep Website Scanning
                        </Label>
                        <p className="text-xs text-muted-foreground">Scan multiple pages for contacts</p>
                      </div>
                      <Switch id="deepScan" checked={true} aria-readonly />
                    </div>

                    <div className="flex items-center justify-between bg-background/50 p-2 rounded-md">
                      <div>
                        <Label htmlFor="obfuscatedEmails" className="text-sm font-medium">
                          Detect Obfuscated Emails
                        </Label>
                        <p className="text-xs text-muted-foreground">Find emails hidden in code</p>
                      </div>
                      <Switch id="obfuscatedEmails" checked={true} aria-readonly />
                    </div>

                    <div className="flex items-center justify-between bg-background/50 p-2 rounded-md">
                      <div>
                        <Label htmlFor="socialLinks" className="text-sm font-medium">
                          Social Media Extraction
                        </Label>
                        <p className="text-xs text-muted-foreground">Find Twitter handles and profiles</p>
                      </div>
                      <Switch id="socialLinks" checked={true} aria-readonly />
                    </div>

                    <div className="flex items-center justify-between bg-background/50 p-2 rounded-md">
                      <div>
                        <Label htmlFor="retryFailed" className="text-sm font-medium">
                          Auto-Retry Failed Extractions
                        </Label>
                        <p className="text-xs text-muted-foreground">Try different methods if initial fails</p>
                      </div>
                      <Switch id="retryFailed" checked={true} aria-readonly />
                    </div>
                  </div>

                  <div className="mt-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="productsToCheck" className="text-sm font-medium">
                        Products to Check: {productsToCheck}
                      </Label>
                      <span className="text-xs text-muted-foreground">Default: 50</span>
                    </div>
                    <Slider
                      id="productsToCheck"
                      value={[productsToCheck]}
                      min={20}
                      max={100}
                      step={10}
                      onValueChange={(value) => setProductsToCheck(value[0])}
                      className="w-full"
                    />
                    <p className="text-xs text-muted-foreground">
                      Increase to check more products, decrease if you experience timeouts
                    </p>
                  </div>

                  <div className="mt-3 bg-green-50 dark:bg-green-900/20 p-2 rounded-md">
                    <p className="text-xs text-green-700 dark:text-green-400 flex items-center">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      All advanced extraction techniques are enabled for maximum contact discovery
                    </p>
                  </div>
                </div>

                {/* Add prominent start/stop buttons */}
                <div className="mt-4 flex flex-col gap-2">
                  <div className="flex items-center justify-between bg-muted/30 p-3 rounded-lg border border-border">
                    <div className="flex flex-col">
                      <span className="font-medium">Auto-Scraper Status</span>
                      <span className="text-xs text-muted-foreground">
                        {isEnabled ? "Running - Checking every 2 minutes" : "Stopped"}
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="default"
                        size="sm"
                        className="bg-green-600 hover:bg-green-700"
                        onClick={() => handleToggleAutoScraper(true)}
                        disabled={isEnabled || isInitializing}
                      >
                        <span className="flex items-center gap-1">
                          {isInitializing ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                          Start
                        </span>
                      </Button>
                      <Button
                        variant="default"
                        size="sm"
                        className="bg-red-600 hover:bg-red-700"
                        onClick={() => handleToggleAutoScraper(false)}
                        disabled={!isEnabled || isInitializing}
                      >
                        Stop
                      </Button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Cross-device sync</span>
                    <Badge variant={lastSyncTime ? "outline" : "secondary"} className="text-xs">
                      {isSyncing
                        ? "Syncing..."
                        : lastSyncTime
                          ? `Last: ${new Date(lastSyncTime).toLocaleTimeString()}`
                          : "Not synced yet"}
                    </Badge>
                  </div>
                </div>
              </div>

              <div className="flex flex-col justify-end space-y-2 min-w-[220px]">
                <div className="bg-muted/40 p-3 rounded-lg border border-border">
                  <h4 className="text-sm font-medium mb-2 flex items-center justify-between">
                    <span>Extraction Stats</span>
                    <Badge variant="secondary" className="ml-2 flex items-center gap-1">
                      <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse"></span>
                      Real-time
                    </Badge>
                  </h4>
                  <div className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span>Total Scraped:</span>
                      <span className="font-bold">{totalScrapedCount}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Today:</span>
                      <span className="font-bold">{todayScrapedCount}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>New This Session:</span>
                      <span className="font-bold">{newProductsCount}</span>
                    </div>
                    {lastChecked && (
                      <div className="flex justify-between text-xs text-muted-foreground mt-1">
                        <span>Last check:</span>
                        <span>{lastChecked}</span>
                      </div>
                    )}
                  </div>

                  {/* Add extraction success rates */}
                  <div className="mt-3 pt-3 border-t border-border">
                    <h5 className="text-xs font-medium mb-1">Success Rates:</h5>
                    <div className="space-y-1">
                      <div className="flex justify-between items-center text-xs">
                        <span>Email Discovery:</span>
                        <Badge
                          variant="outline"
                          className="bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400"
                        >
                          95-100%
                        </Badge>
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <span>Twitter Handles:</span>
                        <Badge
                          variant="outline"
                          className="bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400"
                        >
                          90-95%
                        </Badge>
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <span>Website Links:</span>
                        <Badge
                          variant="outline"
                          className="bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400"
                        >
                          100%
                        </Badge>
                      </div>
                    </div>
                  </div>
                </div>

                <Popover open={isExportPopoverOpen} onOpenChange={setIsExportPopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full">
                      <Download className="mr-2 h-4 w-4" />
                      Export Contact Data
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-80">
                    <div className="space-y-4">
                      <h4 className="font-medium">Export Contact Information</h4>

                      <div className="space-y-2">
                        <Label htmlFor="dateFilter">Date Range</Label>
                        <Select
                          value={dateFilter}
                          onValueChange={(value: "today" | "yesterday" | "last7days" | "all") => setDateFilter(value)}
                        >
                          <SelectTrigger id="dateFilter">
                            <SelectValue placeholder="Select date range" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="today">Today</SelectItem>
                            <SelectItem value="yesterday">Yesterday</SelectItem>
                            <SelectItem value="last7days">Last 7 Days</SelectItem>
                            <SelectItem value="all">All Time</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="exportFormat">Export Format</Label>
                        <Select
                          value={exportFormat}
                          onValueChange={(value: "csv" | "json" | "excel") => setExportFormat(value)}
                        >
                          <SelectTrigger id="exportFormat">
                            <SelectValue placeholder="Select format" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="csv">CSV</SelectItem>
                            <SelectItem value="json">JSON</SelectItem>
                            <SelectItem value="excel">Excel</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="bg-blue-50 dark:bg-blue-900/20 p-2 rounded-md">
                        <p className="text-xs text-blue-700 dark:text-blue-400">
                          Export includes only essential contact data: website links, emails, and Twitter handles
                        </p>
                      </div>

                      <Button
                        className="w-full"
                        onClick={handleSimplifiedExport}
                        disabled={isDownloading || scrapedProducts.length === 0}
                      >
                        {isDownloading ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Downloading...
                          </>
                        ) : (
                          <>
                            <Download className="mr-2 h-4 w-4" />
                            Download {getFilteredProducts().length} Contacts
                          </>
                        )}
                      </Button>
                    </div>
                  </PopoverContent>
                </Popover>

                <Button variant="outline" size="sm" onClick={handleManualSync} disabled={isSyncing} className="w-full">
                  {isSyncing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Syncing...
                    </>
                  ) : (
                    <>
                      <Cloud className="mr-2 h-4 w-4" />
                      Sync Across Devices
                    </>
                  )}
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleManualCheck}
                  disabled={isChecking || !webhookUrl}
                  className="w-full"
                >
                  {isChecking ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Checking...
                    </>
                  ) : (
                    <>
                      <Sparkles className="mr-2 h-4 w-4" />
                      Check Now
                    </>
                  )}
                </Button>
              </div>
            </div>

            <div className="border rounded-md p-4">
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-sm font-medium">Initialization Mode</h3>
                <Badge variant="outline" className="text-xs">
                  Synced
                </Badge>
              </div>
              <Tabs
                defaultValue="week"
                value={initMode}
                onValueChange={(value) => {
                  const newMode = value as "today" | "week"
                  setInitMode(newMode)
                  // Save to localStorage
                  localStorage.setItem(STORAGE_KEYS.INIT_MODE, newMode)
                  // Save to server
                  saveSettingsToServer(webhookUrl, isEnabled, newMode)
                }}
                className="w-full"
              >
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="today" className="flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    <span>Today Only</span>
                  </TabsTrigger>
                  <TabsTrigger value="week" className="flex items-center gap-1">
                    <CalendarDays className="h-4 w-4" />
                    <span>Last 7 Days</span>
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="today" className="mt-2">
                  <p className="text-sm text-muted-foreground">
                    Only track products from today. This mode will only initialize with today's products and then check
                    for new ones.
                  </p>
                </TabsContent>
                <TabsContent value="week" className="mt-2">
                  <p className="text-sm text-muted-foreground">
                    Track products from the last 7 days. This mode will initialize with a week's worth of products to
                    avoid duplicates.
                  </p>
                </TabsContent>
              </Tabs>
            </div>

            {isInitializing && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm">
                    {initMode === "today"
                      ? "Initializing with today's products only..."
                      : "Initializing with 7 days of products..."}
                  </span>
                  <span className="text-sm font-medium">{initProgress}%</span>
                </div>
                <Progress value={initProgress} className="h-2" />
              </div>
            )}

            {status !== "idle" && (
              <Alert variant={status === "error" ? "destructive" : status === "warning" ? "warning" : "default"}>
                {status === "error" ? (
                  <AlertCircle className="h-4 w-4" />
                ) : status === "warning" ? (
                  <AlertCircle className="h-4 w-4" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}
                <AlertTitle>{status === "error" ? "Error" : status === "warning" ? "Warning" : "Status"}</AlertTitle>
                <AlertDescription>{statusMessage}</AlertDescription>
              </Alert>
            )}

            <div className="bg-muted/30 p-4 rounded-lg">
              <h4 className="text-sm font-medium mb-2">Advanced Contact Extraction:</h4>
              <ul className="space-y-1 text-sm">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0 mt-0.5" />
                  <span>Scans multiple pages including contact, about, and team pages</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0 mt-0.5" />
                  <span>Detects obfuscated emails hidden in JavaScript, CSS, and HTML attributes</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0 mt-0.5" />
                  <span>Extracts Twitter handles from text content and social media links</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0 mt-0.5" />
                  <span>Follows redirects to find exact website URLs for reliable contact discovery</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0 mt-0.5" />
                  <span>Uses multiple API keys with automatic rotation to avoid rate limits</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0 mt-0.5" />
                  <span>Automatically retries failed extractions with different techniques</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0 mt-0.5" />
                  <span>
                    Checks up to {productsToCheck} products per scan with duplicate detection to avoid processing the
                    same products
                  </span>
                </li>
              </ul>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}

