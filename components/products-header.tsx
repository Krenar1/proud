"use client"

import { useState } from "react"
import { Download, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { exportProductsToCSV } from "@/actions/export-products"
import { useToast } from "@/hooks/use-toast"

export function ProductsHeader() {
  const { toast } = useToast()
  const [isExporting, setIsExporting] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)

  const handleExport = async () => {
    try {
      setIsExporting(true)

      // Get the current filter values from URL params
      const params = new URLSearchParams(window.location.search)
      const daysBack = Number.parseInt(params.get("days") || "7", 10)
      const limit = 100 // We'll use a higher limit for exports

      toast({
        title: "Starting Export",
        description: `Exporting data for the last ${daysBack} days...`,
      })

      const csvContent = await exportProductsToCSV(daysBack, limit)

      if (!csvContent || csvContent.trim() === "") {
        throw new Error("No data returned from export")
      }

      // Check if we only got headers (no data)
      const lines = csvContent.trim().split("\n")
      if (lines.length <= 1) {
        toast({
          title: "No Products Found",
          description: `No products found in the last ${daysBack} days. Try increasing the time range.`,
          variant: "warning",
        })
        setIsExporting(false)
        return
      }

      // Create a blob and download it
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.setAttribute("download", `product-hunt-data-${new Date().toISOString().split("T")[0]}.csv`)
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      toast({
        title: "Export Successful",
        description: `Exported ${lines.length - 1} products to CSV`,
      })
    } catch (error) {
      console.error("Export error:", error)
      toast({
        title: "Export Failed",
        description: "There was an error exporting your data. Try adjusting your filters.",
        variant: "destructive",
      })
    } finally {
      setIsExporting(false)
    }
  }

  const handleRefresh = () => {
    setIsRefreshing(true)
    window.location.reload()
    setTimeout(() => setIsRefreshing(false), 1000)

    toast({
      title: "Data Refreshed",
      description: "The product list has been updated",
    })
  }

  return (
    <div className="flex items-center justify-between mb-4">
      <h2 className="text-2xl font-bold">Latest Products</h2>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isRefreshing}>
          <RefreshCw size={16} className={`mr-1 ${isRefreshing ? "animate-spin" : ""}`} />
          <span>Refresh</span>
        </Button>
        <Button variant="outline" size="sm" onClick={handleExport} disabled={isExporting}>
          <Download size={16} className="mr-1" />
          <span>{isExporting ? "Exporting..." : "Export CSV"}</span>
        </Button>
      </div>
    </div>
  )
}

