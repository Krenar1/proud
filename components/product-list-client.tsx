"use client"

import { useState } from "react"
import type { Product } from "@/types/product"
import { ProductCard } from "@/components/product-card"
import { Button } from "@/components/ui/button"
import { extractContactInfo, processBatches } from "@/actions/extract-contacts"
import { fetchProducts } from "@/actions/fetch-products"
import { useToast } from "@/hooks/use-toast"
import { Loader2, AlertTriangle, Database, Download } from "lucide-react"
import { Slider } from "@/components/ui/slider"

interface ProductListClientProps {
  products: Product[]
  hasNextPage: boolean
  endCursor?: string
}

export function ProductListClient({
  products: initialProducts,
  hasNextPage,
  endCursor: initialCursor,
}: ProductListClientProps) {
  const [products, setProducts] = useState<Product[]>(initialProducts)
  const [isExtracting, setIsExtracting] = useState(false)
  const [rateLimited, setRateLimited] = useState(false)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [endCursor, setEndCursor] = useState<string | undefined>(initialCursor)
  const [hasMorePages, setHasMorePages] = useState(hasNextPage)
  const [csvData, setCsvData] = useState<string | null>(null)
  const [maxProducts, setMaxProducts] = useState<number>(10)
  const { toast } = useToast()

  // Generate CSV content
  const generateCsvContent = (productsWithContacts: Product[]) => {
    console.log("Generating CSV content...")

    // Create CSV headers
    const headers = [
      "id",
      "name",
      "tagline",
      "description",
      "url",
      "website_url",
      "votes_count",
      "launched_at",
      "emails",
      "twitter",
      "contact_links",
      "external_links",
    ]

    // Create CSV rows
    const rows = productsWithContacts.map((product) => [
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
      (product.contactLinks || []).join(", "),
      (product.externalLinks || []).join(", "),
    ])

    // Combine headers and rows
    return [headers.join(","), ...rows.map((row) => row.join(","))].join("\n")
  }

  // Handle manual CSV download
  const handleDownloadCsv = () => {
    if (!csvData) {
      toast({
        title: "No Data Available",
        description: "Please extract contact information first",
        variant: "warning",
      })
      return
    }

    try {
      // Create a Blob with the CSV data
      const blob = new Blob([csvData], { type: "text/csv;charset=utf-8;" })

      // Create a download URL
      const url = URL.createObjectURL(blob)

      // Create a link element
      const link = document.createElement("a")
      link.href = url
      link.download = `product-hunt-contacts-${new Date().toISOString().split("T")[0]}.csv`

      // Append to body, click, and remove
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      // Clean up the URL
      URL.revokeObjectURL(url)

      toast({
        title: "CSV Downloaded",
        description: "Contact information has been downloaded as a CSV file",
      })
    } catch (error) {
      console.error("Download error:", error)

      toast({
        title: "Download Failed",
        description: "Failed to download CSV. Try again or check console for details.",
        variant: "destructive",
      })
    }
  }

  // Extract contact information
  const handleExtractContactInfo = async () => {
    try {
      // Prevent multiple extractions
      if (isExtracting) {
        toast({
          title: "Extraction in Progress",
          description: "Please wait for the current extraction to complete",
        })
        return
      }

      setIsExtracting(true)
      setRateLimited(false)
      setCsvData(null)

      toast({
        title: "Contact Extraction Started",
        description: `Processing up to ${maxProducts} products. This may take a moment...`,
      })

      // Process products
      const productsToProcess = products.slice(0, Math.min(products.length, maxProducts))
      console.log(`Will process ${productsToProcess.length} products`)

      // Set a timeout for the entire extraction process
      const extractionPromise =
        maxProducts > 10
          ? processBatches(productsToProcess, 5) // Process in batches of 5 for large requests
          : extractContactInfo(productsToProcess, maxProducts)

      const timeoutPromise = new Promise<Product[]>((_, reject) => {
        // Set timeout based on number of products (8 seconds per product + 15 seconds base)
        const timeout = Math.min(15000 + maxProducts * 8000, 120000) // Max 120 seconds (2 minutes)
        setTimeout(() => reject(new Error("Extraction timed out")), timeout)
      })

      const updatedProducts = await Promise.race([extractionPromise, timeoutPromise]).catch((error) => {
        console.error("Extraction error or timeout:", error)
        toast({
          title: "Extraction Partially Completed",
          description: "Some products may not have been fully processed due to timeout or errors",
          variant: "warning",
        })
        // Return what we have so far
        return productsToProcess
      })

      console.log(`Received ${updatedProducts.length} updated products`)

      // Update the products state
      setProducts((prevProducts) => {
        return prevProducts.map((product) => {
          const updatedProduct = updatedProducts.find((p) => p.id === product.id)
          return updatedProduct || product
        })
      })

      // Count products with contact info
      const productsWithContactInfo = updatedProducts.filter(
        (p) =>
          (p.emails && p.emails.length > 0) ||
          (p.twitterHandles && p.twitterHandles.length > 0) ||
          (p.contactLinks && p.contactLinks.length > 0),
      )

      // Generate CSV data and store it
      const csvContent = generateCsvContent(updatedProducts)
      setCsvData(csvContent)

      // Trigger automatic download
      try {
        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
        const url = URL.createObjectURL(blob)
        const link = document.createElement("a")
        link.href = url
        link.download = `product-hunt-contacts-${new Date().toISOString().split("T")[0]}.csv`
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        URL.revokeObjectURL(url)
      } catch (downloadError) {
        console.error("Error auto-downloading CSV:", downloadError)
        // We'll still have the manual download button as fallback
      }

      toast({
        title: "Contact Extraction Complete",
        description: `Found contact info for ${productsWithContactInfo.length} out of ${updatedProducts.length} products. CSV has been downloaded.`,
      })
    } catch (error) {
      console.error("Contact extraction error:", error)

      if (error.message && error.message.includes("429")) {
        setRateLimited(true)
        toast({
          title: "Rate Limit Exceeded",
          description: "The API rate limit has been reached. Please try again later.",
          variant: "destructive",
        })
      } else {
        toast({
          title: "Extraction Partially Completed",
          description: "There was an error during extraction. Some data may have been collected.",
          variant: "warning",
        })
      }
    } finally {
      setIsExtracting(false)
    }
  }

  // Load more products
  const handleLoadMore = async () => {
    try {
      setIsLoadingMore(true)

      // Get current filter values from URL or use defaults
      const urlParams = new URL(window.location.href).searchParams
      const daysBack = Number.parseInt(urlParams.get("days") || "7")
      const sortBy = (urlParams.get("sort") || "newest") as "newest" | "popular"

      // Use the fetchProducts server action
      fetchProducts({ daysBack, sortBy, limit: 20 }, endCursor)
        .then((data) => {
          if (data && data.posts) {
            // Add new products to the existing list
            const newProducts = data.posts.edges.map((edge) => edge.node)
            setProducts((prevProducts) => [...prevProducts, ...newProducts])

            // Update cursor and hasNextPage state
            setEndCursor(data.posts.pageInfo.endCursor)
            setHasMorePages(data.posts.pageInfo.hasNextPage)

            toast({
              title: "Products Loaded",
              description: `Loaded ${data.posts.edges.length} more products`,
            })
          }
          setIsLoadingMore(false)
        })
        .catch((error) => {
          console.error("Error loading more products:", error)
          toast({
            title: "Failed to Load More",
            description: "There was an error loading more products",
            variant: "destructive",
          })
          setIsLoadingMore(false)
        })
    } catch (error) {
      console.error("Error preparing to load more products:", error)
      toast({
        title: "Failed to Load More",
        description: "There was an error loading more products",
        variant: "destructive",
      })
      setIsLoadingMore(false)
    }
  }

  return (
    <div>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 p-4 bg-muted/30 rounded-lg">
        <div className="w-full md:w-1/2">
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Products to Process: {maxProducts}</label>
              <span className="text-xs text-muted-foreground">
                {maxProducts === 1 ? "1 product" : `${maxProducts} products`}
              </span>
            </div>
            <Slider
              value={[maxProducts]}
              min={1}
              max={50}
              step={5}
              onValueChange={(value) => setMaxProducts(value[0])}
              className="w-full"
              disabled={isExtracting}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Note: Processing more than 10 products will use batch processing to avoid timeouts. Larger batches will
              take longer but should complete successfully.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <Button
            variant="default"
            disabled={isExtracting || rateLimited}
            onClick={handleExtractContactInfo}
            className="w-full md:w-auto"
          >
            {isExtracting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Extracting Contacts...
              </>
            ) : (
              <>
                <Database className="mr-2 h-4 w-4" />
                Extract Contacts
              </>
            )}
          </Button>

          <Button variant="outline" disabled={!csvData} onClick={handleDownloadCsv} className="w-full md:w-auto">
            <Download className="mr-2 h-4 w-4" />
            Download CSV
          </Button>
        </div>
      </div>

      {rateLimited && (
        <div className="flex items-center text-amber-500 gap-2 text-sm mb-4 p-2 bg-amber-50 dark:bg-amber-950/20 rounded-md">
          <AlertTriangle size={16} />
          <span>Rate limit reached. Please try again later.</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {products.map((product) => (
          <ProductCard key={`product-${product.id}`} product={product} />
        ))}
      </div>

      {hasMorePages && (
        <div className="flex justify-center mt-8">
          <Button variant="outline" onClick={handleLoadMore} disabled={isLoadingMore}>
            {isLoadingMore ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Loading...
              </>
            ) : (
              "Load More"
            )}
          </Button>
        </div>
      )}
    </div>
  )
}

