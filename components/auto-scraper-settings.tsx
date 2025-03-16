"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Slider } from "@/components/ui/slider"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { CheckIcon, RefreshCw, Loader2, ArrowDownToLine, AlertTriangle, Server } from "lucide-react"

export function AutoScraperSettings() {
  const { toast } = useToast()
  const [isEnabled, setIsEnabled] = useState(false)
  const [interval, setInterval] = useState(30) // minutes
  const [isRunning, setIsRunning] = useState(false)
  const [lastRun, setLastRun] = useState<Date | null>(null)
  const [discordWebhook, setDiscordWebhook] = useState("")
  const [notifyDiscord, setNotifyDiscord] = useState(false)
  const [numProductsToCheck, setNumProductsToCheck] = useState(50)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  // Advanced settings
  const [deepScanEnabled, setDeepScanEnabled] = useState(true)
  const [obfuscationDetectionEnabled, setObfuscationDetectionEnabled] = useState(true)
  const [socialMediaExtraction, setSocialMediaExtraction] = useState(true)
  const [autoRetryEnabled, setAutoRetryEnabled] = useState(true)

  // Stats
  const [stats, setStats] = useState({
    newProductsFound: 0,
    totalRuns: 0,
    totalProductsChecked: 0,
    lastRunStatus: "",
  })

  // Logs
  const [logs, setLogs] = useState<any[]>([])

  // Load settings from the server
  const loadSettings = useCallback(async () => {
    try {
      setLoading(true)
      const response = await fetch("/api/scraper-settings")

      if (!response.ok) {
        throw new Error(`Failed to load settings: ${response.status}`)
      }

      const data = await response.json()

      if (data.settings) {
        setIsEnabled(data.settings.enabled)
        setInterval(data.settings.interval)
        setDiscordWebhook(data.settings.discordWebhook || "")
        setNotifyDiscord(data.settings.notifyDiscord)
        setNumProductsToCheck(data.settings.numProductsToCheck)
        setDeepScanEnabled(data.settings.deepScanEnabled)
        setObfuscationDetectionEnabled(data.settings.obfuscationEnabled)
        setSocialMediaExtraction(data.settings.socialMediaEnabled)
        setAutoRetryEnabled(data.settings.autoRetryEnabled)

        if (data.settings.lastRunAt) {
          setLastRun(new Date(data.settings.lastRunAt))
        }

        setStats({
          newProductsFound: data.settings.totalProductsFound || 0,
          totalRuns: data.settings.totalRuns || 0,
          totalProductsChecked: data.settings.totalProductsChecked || 0,
          lastRunStatus: "",
        })
      }

      if (data.logs) {
        setLogs(data.logs)

        // Update last run status from the most recent log
        if (data.logs.length > 0) {
          const lastLog = data.logs[0]
          setStats((prev) => ({
            ...prev,
            lastRunStatus: lastLog.success ? "Success" : "Failed",
          }))
        }
      }

      setError(null)
    } catch (err) {
      console.error("Error loading settings:", err)
      setError("Failed to load settings from server")
    } finally {
      setLoading(false)
    }
  }, [])

  // Load settings on component mount
  useEffect(() => {
    loadSettings()

    // Set up a polling interval to refresh the status
    const intervalId = setInterval(() => {
      loadSettings()
    }, 60000) // Refresh every minute

    return () => clearInterval(intervalId)
  }, [loadSettings])

  // Save settings to the server
  const saveSettings = async (runImmediately = false) => {
    try {
      setError(null)

      const response = await fetch("/api/scraper-settings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          enabled: isEnabled,
          interval,
          discordWebhook,
          notifyDiscord,
          numProductsToCheck,
          deepScanEnabled,
          obfuscationEnabled: obfuscationDetectionEnabled,
          socialMediaEnabled: socialMediaExtraction,
          autoRetryEnabled,
          runImmediately,
        }),
      })

      if (!response.ok) {
        throw new Error(`Failed to save settings: ${response.status}`)
      }

      const data = await response.json()

      toast({
        title: "Settings saved",
        description: "Your auto-scraper settings have been saved to the server.",
      })

      // Refresh settings
      loadSettings()

      return data
    } catch (err) {
      console.error("Error saving settings:", err)
      setError("Failed to save settings to server")

      toast({
        title: "Error",
        description: "Failed to save settings to server.",
        variant: "destructive",
      })

      return null
    }
  }

  // Run the scraper manually
  const runScraper = async () => {
    if (isRunning) return

    try {
      setIsRunning(true)
      setError(null)

      // First save the current settings
      await saveSettings(false)

      // Then trigger the scraper
      const response = await fetch("/api/scraper/run", {
        method: "POST",
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.message || `Failed to run scraper: ${response.status}`)
      }

      const result = await response.json()

      if (result.success) {
        toast({
          title: "Auto-scraper completed",
          description: `Found ${result.newProducts || 0} new products.`,
        })
      } else {
        throw new Error(result.message || "Unknown error")
      }

      // Refresh settings and logs
      loadSettings()
    } catch (err) {
      console.error("Error running scraper:", err)
      setError(err instanceof Error ? err.message : "Failed to run scraper")

      toast({
        title: "Error",
        description: "Failed to run the auto-scraper: " + (err instanceof Error ? err.message : "Unknown error"),
        variant: "destructive",
      })
    } finally {
      setIsRunning(false)
    }
  }

  // Toggle the scraper enabled state
  const toggleScraper = async () => {
    const newState = !isEnabled
    setIsEnabled(newState)

    // Save the new state to the server
    await saveSettings(newState) // Run immediately if enabling
  }

  // Reset the scraper
  const resetScraper = async () => {
    try {
      const response = await fetch("/api/scraper/reset", {
        method: "POST",
      })

      if (!response.ok) {
        throw new Error(`Failed to reset scraper: ${response.status}`)
      }

      toast({
        title: "Scraper reset",
        description: "The scraper cache has been reset.",
      })

      // Refresh settings and logs
      loadSettings()
    } catch (err) {
      console.error("Error resetting scraper:", err)

      toast({
        title: "Error",
        description: "Failed to reset the scraper.",
        variant: "destructive",
      })
    }
  }

  return (
    <Card className="w-full border-2 border-primary">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-2xl">Server-Side Auto Scraper</CardTitle>
            <CardDescription>
              Continuously scrapes contact information 24/7, even when your browser is closed
            </CardDescription>
          </div>
          <Badge variant={isEnabled ? "default" : "outline"} className="ml-2">
            {isEnabled ? "Active" : "Inactive"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="ml-2">Loading settings...</span>
          </div>
        ) : (
          <>
            {error && (
              <Alert variant="destructive" className="mb-4">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Error occurred</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Alert variant="default" className="bg-primary/10 border-primary/20">
              <Server className="h-4 w-4" />
              <AlertTitle>Server-Side Processing</AlertTitle>
              <AlertDescription>
                This scraper runs on the server and will continue to work 24/7 even when your browser is closed. The
                scraper runs automatically at the configured interval.
              </AlertDescription>
            </Alert>

            <div className="flex flex-col space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="auto-scraper-switch" className="text-base font-semibold">
                  Auto-Scraper Status
                </Label>
                <Switch
                  id="auto-scraper-switch"
                  checked={isEnabled}
                  onCheckedChange={toggleScraper}
                  disabled={isRunning}
                />
              </div>
              <p className="text-sm text-muted-foreground">
                When enabled, the server will automatically check for new products and extract contact information.
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
                <p className="text-xs text-muted-foreground">
                  Automatically retry failed requests with different settings
                </p>
              </div>
            </div>

            <div className="flex flex-col space-y-2">
              <div className="text-sm font-medium">Server Statistics</div>
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-md border p-2">
                  <div className="text-xs text-muted-foreground">Total Products Found</div>
                  <div className="text-lg font-bold">{stats.newProductsFound}</div>
                </div>
                <div className="rounded-md border p-2">
                  <div className="text-xs text-muted-foreground">Total Runs</div>
                  <div className="text-lg font-bold">{stats.totalRuns}</div>
                </div>
                <div className="rounded-md border p-2">
                  <div className="text-xs text-muted-foreground">Products Checked</div>
                  <div className="text-lg font-bold">{stats.totalProductsChecked}</div>
                </div>
                <div className="rounded-md border p-2">
                  <div className="text-xs text-muted-foreground">Last Run Status</div>
                  <div className="text-lg font-bold">{stats.lastRunStatus || "N/A"}</div>
                </div>
              </div>
            </div>

            {logs.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-medium">Recent Activity</h3>
                <div className="max-h-40 overflow-y-auto border rounded-md">
                  <table className="min-w-full divide-y divide-border">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Time</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Status</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Products</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Message</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border bg-background">
                      {logs.map((log) => (
                        <tr key={log.id}>
                          <td className="px-3 py-2 text-xs">{new Date(log.createdAt).toLocaleString()}</td>
                          <td className="px-3 py-2 text-xs">
                            <Badge variant={log.success ? "default" : "destructive"}>
                              {log.success ? "Success" : "Failed"}
                            </Badge>
                          </td>
                          <td className="px-3 py-2 text-xs">
                            {log.newProductsFound} / {log.productsChecked}
                          </td>
                          <td className="px-3 py-2 text-xs truncate max-w-[200px]">{log.message || "No message"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {lastRun && (
              <div className="text-sm text-muted-foreground">Last server run: {lastRun.toLocaleString()}</div>
            )}
          </>
        )}
      </CardContent>
      <CardFooter className="flex justify-between">
        <div className="flex space-x-2">
          <Button variant="outline" size="sm" onClick={resetScraper} disabled={isRunning}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Reset Cache
          </Button>

          <Button variant="outline" size="sm" onClick={saveSettings} disabled={isRunning}>
            <ArrowDownToLine className="mr-2 h-4 w-4" />
            Save Settings
          </Button>
        </div>

        <Button onClick={runScraper} disabled={isRunning}>
          {isRunning ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Running...
            </>
          ) : (
            <>
              <CheckIcon className="mr-2 h-4 w-4" />
              Run Now
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  )
}

