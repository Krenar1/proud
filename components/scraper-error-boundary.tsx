"use client"

import type React from "react"

import { Component, type ReactNode } from "react"
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert"
import { AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"

interface ScraperErrorBoundaryProps {
  children: ReactNode
  fallback?: ReactNode
}

interface ScraperErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

export class ScraperErrorBoundary extends Component<ScraperErrorBoundaryProps, ScraperErrorBoundaryState> {
  constructor(props: ScraperErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): ScraperErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Scraper error caught:", error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <Alert variant="destructive" className="mb-6">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Scraper Error</AlertTitle>
          <AlertDescription>
            <p className="mb-2">The scraper encountered an error and had to stop.</p>
            <p className="mb-4 text-sm opacity-80">{this.state.error?.message}</p>
            <Button size="sm" onClick={() => this.setState({ hasError: false, error: null })}>
              Try Again
            </Button>
          </AlertDescription>
        </Alert>
      )
    }

    return this.props.children
  }
}

