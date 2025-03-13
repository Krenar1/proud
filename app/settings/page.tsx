"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import { useToast } from "@/hooks/use-toast"

export default function SettingsPage() {
  const { toast } = useToast()
  const [settings, setSettings] = useState({
    maxProducts: 100,
    daysToLookBack: 7,
    enableAutoRefresh: false,
    exportFormat: "csv",
    includeContactInfo: true,
    maxContactPages: 3,
    extractEmails: true,
    extractTwitter: true,
    extractLinks: true,
  })

  const handleSaveSettings = () => {
    // In a real app, this would save to a database or localStorage
    toast({
      title: "Settings Saved",
      description: "Your preferences have been updated",
    })
  }

  return (
    <main className="container mx-auto px-4 py-8">
      <h1 className="text-4xl font-bold mb-2">Settings</h1>
      <p className="text-muted-foreground mb-8">Configure your Product Hunt Scraper preferences</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Data Collection</CardTitle>
            <CardDescription>Configure how data is collected from Product Hunt</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="maxProducts">Maximum Products to Fetch</Label>
              <div className="flex items-center justify-between">
                <Slider
                  id="maxProducts"
                  value={[settings.maxProducts]}
                  min={10}
                  max={500}
                  step={10}
                  onValueChange={(value) => setSettings({ ...settings, maxProducts: value[0] })}
                  className="w-[70%]"
                />
                <span className="font-medium">{settings.maxProducts}</span>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="daysToLookBack">Days to Look Back</Label>
              <div className="flex items-center justify-between">
                <Slider
                  id="daysToLookBack"
                  value={[settings.daysToLookBack]}
                  min={1}
                  max={30}
                  step={1}
                  onValueChange={(value) => setSettings({ ...settings, daysToLookBack: value[0] })}
                  className="w-[70%]"
                />
                <span className="font-medium">{settings.daysToLookBack} days</span>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="autoRefresh">Auto-refresh Data</Label>
              <Switch
                id="autoRefresh"
                checked={settings.enableAutoRefresh}
                onCheckedChange={(checked) => setSettings({ ...settings, enableAutoRefresh: checked })}
              />
            </div>
          </CardContent>
          <CardFooter>
            <Button onClick={handleSaveSettings}>Save Data Settings</Button>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Export Settings</CardTitle>
            <CardDescription>Configure how data is exported from the application</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="exportFormat">Export Format</Label>
              <select
                id="exportFormat"
                value={settings.exportFormat}
                onChange={(e) => setSettings({ ...settings, exportFormat: e.target.value })}
                className="w-full p-2 rounded-md border border-input bg-background"
              >
                <option value="csv">CSV</option>
                <option value="excel">Excel</option>
                <option value="json">JSON</option>
              </select>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="includeContactInfo">Include Contact Information</Label>
                <Switch
                  id="includeContactInfo"
                  checked={settings.includeContactInfo}
                  onCheckedChange={(checked) => setSettings({ ...settings, includeContactInfo: checked })}
                />
              </div>

              {settings.includeContactInfo && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="maxContactPages">Max Contact Pages to Check</Label>
                    <div className="flex items-center justify-between">
                      <Slider
                        id="maxContactPages"
                        value={[settings.maxContactPages]}
                        min={1}
                        max={5}
                        step={1}
                        onValueChange={(value) => setSettings({ ...settings, maxContactPages: value[0] })}
                        className="w-[70%]"
                      />
                      <span className="font-medium">{settings.maxContactPages}</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Data to Extract</Label>
                    <div className="grid grid-cols-1 gap-2">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="extractEmails" className="text-sm">
                          Emails
                        </Label>
                        <Switch
                          id="extractEmails"
                          checked={settings.extractEmails}
                          onCheckedChange={(checked) => setSettings({ ...settings, extractEmails: checked })}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label htmlFor="extractTwitter" className="text-sm">
                          Twitter Handles
                        </Label>
                        <Switch
                          id="extractTwitter"
                          checked={settings.extractTwitter}
                          onCheckedChange={(checked) => setSettings({ ...settings, extractTwitter: checked })}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label htmlFor="extractLinks" className="text-sm">
                          External Links
                        </Label>
                        <Switch
                          id="extractLinks"
                          checked={settings.extractLinks}
                          onCheckedChange={(checked) => setSettings({ ...settings, extractLinks: checked })}
                        />
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="apiKey">Product Hunt API Key</Label>
              <Input id="apiKey" type="password" placeholder="API Key is stored securely" disabled />
              <p className="text-xs text-muted-foreground">API key is securely stored as an environment variable</p>
            </div>
          </CardContent>
          <CardFooter>
            <Button onClick={handleSaveSettings}>Save Export Settings</Button>
          </CardFooter>
        </Card>
      </div>
    </main>
  )
}

