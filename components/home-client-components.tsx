"use client"

import { Suspense } from "react"
import dynamic from "next/dynamic"
import { LoadingProducts } from "@/components/loading-products"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertTriangle } from "lucide-react"
import { ScraperErrorBoundary } from "@/components/scraper-error-boundary"

// Dynamically import components that might use client-side hooks
const ProductList = dynamic(() => import("@/components/product-list"), {
  ssr: false,
  loading: () => <LoadingProducts />,
})

const ProductsHeader = dynamic(() => import("@/components/products-header").then((mod) => mod.ProductsHeader), {
  ssr: false,
  loading: () => <div className="h-[40px] bg-muted/40 rounded-lg animate-pulse mb-4"></div>,
})

const ProductsFilter = dynamic(() => import("@/components/products-filter").then((mod) => mod.ProductsFilter), {
  ssr: false,
  loading: () => <div className="h-[100px] bg-muted/40 rounded-lg animate-pulse mb-4"></div>,
})

export function HomeClientComponents() {
  return (
    <>
      <Suspense fallback={<div className="h-[40px] bg-muted/40 rounded-lg animate-pulse mb-4"></div>}>
        <ProductsHeader />
      </Suspense>

      <Suspense fallback={<div className="h-[100px] bg-muted/40 rounded-lg animate-pulse mb-4"></div>}>
        <ProductsFilter />
      </Suspense>

      <ScraperErrorBoundary
        fallback={
          <Alert variant="destructive" className="my-4">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Scraper Error</AlertTitle>
            <AlertDescription>
              The scraper process crashed. This usually happens when processing too many websites at once. Try reducing
              the number of products to process or use the batch processing option.
            </AlertDescription>
          </Alert>
        }
      >
        <Suspense fallback={<LoadingProducts />}>
          <ProductList />
        </Suspense>
      </ScraperErrorBoundary>
    </>
  )
}

