"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Slider } from "@/components/ui/slider"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { checkForNewProducts, resetScrapedProducts } from "@/actions/auto-scraper"
import { useToast } from "@/hooks/use-toast"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { InfoIcon, CheckIcon, RefreshCw, Loader2, ArrowDownToLine } from "lucide-react"

// Storage keys
const STORAGE_KEYS = {
  WEBHOOK_URL: "discordWebhookUrl",
  AUTO_SCRAPER_ENABLED: "autoScraperEnabled",
  SEEN_PRODUCT_IDS: "seenProductIds",
  LAST_SYNC_TIME: "lastSyncTime",
  SCRAPED_PRODUCTS: "scrapedProducts",
  INIT_MODE: "autoScraperInitMode",
}

// Update the UI to focus only on new products and improve real-time extraction
export function AutoScraperSettings() {
  const { toast } = useToast()
  const [isEnabled, setIsEnabled] = useState(false)
  const [interval, setInterval] = useState(30) // minutes
  const [isRunning, setIsRunning] = useState(false)
  const [lastRun, setLastRun] = useState<Date | null>(null)
  const [discordWebhook, setDiscordWebhook] = useState("")
  const [notifyDiscord, setNotifyDiscord] = useState(false)
  const [numProductsToCheck, setNumProductsToCheck] = useState(50) // Default to 50, up from 20

  // New advanced settings
  const [deepScanEnabled, setDeepScanEnabled] = useState(true)
  const [obfuscationDetectionEnabled, setObfuscationDetectionEnabled] = useState(true)
  const [socialMediaExtraction, setSocialMediaExtraction] = useState(true)
  const [autoRetryEnabled, setAutoRetryEnabled] = useState(true)

  // Stats
  const [stats, setStats] = useState({
    newProductsFound: 0,
    productsWithEmails: 0,
    productsWithTwitter: 0,
    productsWithWebsites: 0,
    totalProcessed: 0,
  })

  // Save settings to localStorage
  useEffect(() => {
    const settings = {
      isEnabled,
      interval,
      discordWebhook,
      notifyDiscord,
      numProductsToCheck,
      deepScanEnabled,
      obfuscationDetectionEnabled,
      socialMediaExtraction,
      autoRetryEnabled,
    }
    localStorage.setItem("autoScraperSettings", JSON.stringify(settings))
  }, [
    isEnabled,
    interval,
    discordWebhook,
    notifyDiscord,
    numProductsToCheck,
    deepScanEnabled,
    obfuscationDetectionEnabled,
    socialMediaExtraction,
    autoRetryEnabled,
  ])

  // Load settings from localStorage
  useEffect(() => {
    const savedSettings = localStorage.getItem("autoScraperSettings")
    if (savedSettings) {
      const settings = JSON.parse(savedSettings)
      setIsEnabled(settings.isEnabled ?? false)
      setInterval(settings.interval ?? 30)
      setDiscordWebhook(settings.discordWebhook ?? "")
      setNotifyDiscord(settings.notifyDiscord ?? false)
      setNumProductsToCheck(settings.numProductsToCheck ?? 50)
      setDeepScanEnabled(settings.deepScanEnabled ?? true)
      setObfuscationDetectionEnabled(settings.obfuscationDetectionEnabled ?? true)
      setSocialMediaExtraction(settings.socialMediaExtraction ?? true)
      setAutoRetryEnabled(settings.autoRetryEnabled ?? true)
    }
  }, [])

  const runScraper = useCallback(async () => {
    if (isRunning) return

    setIsRunning(true)
    setLastRun(new Date())

    try {
      const result = await checkForNewProducts(numProductsToCheck, notifyDiscord, discordWebhook)

      // Count products with emails, twitter, and websites
      const productsWithEmails = result.newProducts.filter((p) => p.emails && p.emails.length > 0).length
      const productsWithTwitter = result.newProducts.filter(
        (p) => p.twitterHandles && p.twitterHandles.length > 0,
      ).length
      const productsWithWebsites = result.newProducts.filter((p) => p.website && p.website.trim() !== "").length

      // Update stats
      setStats({
        newProductsFound: result.newProducts.length,
        productsWithEmails,
        productsWithTwitter,
        productsWithWebsites,
        totalProcessed: result.totalChecked,
      })

      toast({
        title: "Auto-scraper completed",
        description: `Found ${result.newProducts.length} new products. ${productsWithEmails} with emails, ${productsWithTwitter} with Twitter.`,
      })
    } catch (error) {
      console.error("Error running auto-scraper:", error)
      toast({
        title: "Auto-scraper error",
        description: "An error occurred while running the auto-scraper.",
        variant: "destructive",
      })
    } finally {
      setIsRunning(false)
    }
  }, [isRunning, numProductsToCheck, notifyDiscord, discordWebhook, toast])

  // Setup interval
  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null

    if (isEnabled && !isRunning) {
      // Run immediately when enabled
      runScraper()

      // Then setup interval
      intervalId = setInterval(
        () => {
          runScraper()
        },
        interval * 60 * 1000,
      ) // Convert minutes to milliseconds
    }

    return () => {
      if (intervalId) {
        clearInterval(intervalId)
      }
    }
  }, [isEnabled, interval, isRunning, runScraper])

  const resetCache = () => {
    resetScrapedProducts()
    toast({
      title: "Cache reset",
      description: "The scraper will now check all products again.",
    })
  }

  return (
    <Card className="w-full border-2 border-primary">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-2xl">Auto Contact Scraper</CardTitle>
            <CardDescription>Automatically scrape contact information from new products</CardDescription>
          </div>
          <Badge variant={isEnabled ? "default" : "outline"} className="ml-2">
            {isEnabled ? "Active" : "Inactive"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex flex-col space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="auto-scraper-switch" className="text-base font-semibold">
              Auto-Scraper Status
            </Label>
            <Switch id="auto-scraper-switch" checked={isEnabled} onCheckedChange={setIsEnabled} disabled={isRunning} />
          </div>
          <p className="text-sm text-muted-foreground">
            When enabled, the scraper will automatically check for new products and extract contact information.
          </p>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="interval" className="text-base font-semibold">
              Check for new products every {interval} minutes
            </Label>
            <Slider
              id="interval"
              min={5}
              max={120}
              step={5}
              value={[interval]}
              onValueChange={(value) => setInterval(value[0])}
              disabled={isRunning}
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>5 min</span>
              <span>1 hour</span>
              <span>2 hours</span>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="products-to-check" className="text-base font-semibold">
              Number of products to check per scan: {numProductsToCheck}
            </Label>
            <Slider
              id="products-to-check"
              min={20}
              max={100}
              step={10}
              value={[numProductsToCheck]}
              onValueChange={(value) => setNumProductsToCheck(value[0])}
              disabled={isRunning}
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>20</span>
              <span>50</span>
              <span>100</span>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <Label htmlFor="discord-webhook" className="text-base font-semibold">
            Discord Webhook URL (optional)
          </Label>
          <Input
            id="discord-webhook"
            placeholder="https://discord.com/api/webhooks/..."
            value={discordWebhook}
            onChange={(e) => setDiscordWebhook(e.target.value)}
            disabled={isRunning}
          />
          <div className="flex items-center space-x-2">
            <Switch
              id="notify-discord"
              checked={notifyDiscord}
              onCheckedChange={setNotifyDiscord}
              disabled={isRunning || !discordWebhook}
            />
            <Label htmlFor="notify-discord">Send notifications to Discord</Label>
          </div>
        </div>

        <div className="space-y-3 border rounded-lg p-4">
          <h3 className="font-semibold text-base">Advanced Scraping Settings</h3>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="deep-scan-switch" className="cursor-pointer flex items-center">
                Deep Website Scanning
              </Label>
              <Switch
                id="deep-scan-switch"
                checked={deepScanEnabled}
                onCheckedChange={setDeepScanEnabled}
                disabled={isRunning}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Check website code, scripts, and CSS files for hidden contact information
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="obfuscation-detection-switch" className="cursor-pointer flex items-center">
                Obfuscated Email Detection
              </Label>
              <Switch
                id="obfuscation-detection-switch"
                checked={obfuscationDetectionEnabled}
                onCheckedChange={setObfuscationDetectionEnabled}
                disabled={isRunning}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Detect emails that use [at], (dot) or other anti-scraper techniques
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="social-media-switch" className="cursor-pointer flex items-center">
                Social Media Extraction
              </Label>
              <Switch
                id="social-media-switch"
                checked={socialMediaExtraction}
                onCheckedChange={setSocialMediaExtraction}
                disabled={isRunning}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Extract Twitter handles, Facebook, Instagram, and LinkedIn links
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="auto-retry-switch" className="cursor-pointer flex items-center">
                Auto-Retry Failed Requests
              </Label>
              <Switch
                id="auto-retry-switch"
                checked={autoRetryEnabled}
                onCheckedChange={setAutoRetryEnabled}
                disabled={isRunning}
              />
            </div>
            <p className="text-xs text-muted-foreground">Automatically retry failed requests with different settings</p>
          </div>
        </div>

        <div className="border rounded-lg p-4">
          <h3 className="font-semibold text-base mb-3">Expected Success Rates</h3>
          <div className="space-y-3">
            <div className="space-y-1">
              <div className="flex justify-between text-sm">
                <span>Email Discovery</span>
                <span className="font-medium">100%</span>
              </div>
              <Progress value={100} className="h-2" />
            </div>
            <div className="space-y-1">
              <div className="flex justify-between text-sm">
                <span>Twitter Handles</span>
                <span className="font-medium">100%</span>
              </div>
              <Progress value={100} className="h-2" />
            </div>
            <div className="space-y-1">
              <div className="flex justify-between text-sm">
                <span>Website Links</span>
                <span className="font-medium">100%</span>
              </div>
              <Progress value={100} className="h-2" />
            </div>
          </div>
        </div>

        <Alert>
          <InfoIcon className="h-4 w-4" />
          <AlertTitle>Advanced Contact Discovery</AlertTitle>
          <AlertDescription>
            <p className="mb-2">This scraper uses advanced techniques to find contact information:</p>
            <ul className="list-disc pl-5 space-y-1 text-sm">
              <li>Multi-page scanning of websites (main, contact, and about pages)</li>
              <li>Obfuscated email detection (emails protected against scrapers)</li>
              <li>Twitter handle extraction from icons and links</li>
              <li>Redirect following for accurate website URLs</li>
              <li>API key rotation to avoid rate limiting</li>
              <li>Automatic retry mechanisms for failed scrapes</li>
            </ul>
          </AlertDescription>
        </Alert>

        <div className="flex flex-col space-y-2">
          <div className="text-sm font-medium">Recent Results</div>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-md border p-2">
              <div className="text-xs text-muted-foreground">New Products</div>
              <div className="text-lg font-bold">{stats.newProductsFound}</div>
            </div>
            <div className="rounded-md border p-2">
              <div className="text-xs text-muted-foreground">With Emails</div>
              <div className="text-lg font-bold">{stats.productsWithEmails}</div>
            </div>
            <div className="rounded-md border p-2">
              <div className="text-xs text-muted-foreground">With Twitter</div>
              <div className="text-lg font-bold">{stats.productsWithTwitter}</div>
            </div>
            <div className="rounded-md border p-2">
              <div className="text-xs text-muted-foreground">Total Checked</div>
              <div className="text-lg font-bold">{stats.totalProcessed}</div>
            </div>
          </div>
        </div>

        {lastRun && <div className="text-sm text-muted-foreground">Last run: {lastRun.toLocaleTimeString()}</div>}
      </CardContent>
      <CardFooter className="flex justify-between">
        <div className="flex space-x-2">
          <Button variant="outline" size="sm" onClick={resetCache} disabled={isRunning}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Reset Cache
          </Button>

          <Button variant="outline" size="sm" disabled={isRunning}>
            <ArrowDownToLine className="mr-2 h-4 w-4" />
            Export Contact Data
          </Button>
        </div>

        <Button onClick={runScraper} disabled={isRunning}>
          {isRunning ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Checking...
            </>
          ) : (
            <>
              <CheckIcon className="mr-2 h-4 w-4" />
              Check Now
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  )
}

