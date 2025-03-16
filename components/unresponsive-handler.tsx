"use client"

import { useEffect, useState } from "react"
import { AlertTriangle } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

export function UnresponsiveHandler() {
  const [isActive, setIsActive] = useState(false)
  const [lastActivity, setLastActivity] = useState(Date.now())

  // Update the last activity time whenever there's user interaction
  useEffect(() => {
    const updateActivity = () => {
      setLastActivity(Date.now())
      setIsActive(false)
    }

    // Set up listeners for user interaction
    window.addEventListener("click", updateActivity)
    window.addEventListener("keydown", updateActivity)
    window.addEventListener("mousemove", updateActivity)
    window.addEventListener("scroll", updateActivity)

    // Check for inactivity periodically
    const interval = setInterval(() => {
      const now = Date.now()
      const timeSinceLastActivity = now - lastActivity

      // Check if page hasn't responded in 3 seconds
      if (timeSinceLastActivity > 3000 && !isActive) {
        setIsActive(true)
      }
    }, 1000)

    return () => {
      window.removeEventListener("click", updateActivity)
      window.removeEventListener("keydown", updateActivity)
      window.removeEventListener("mousemove", updateActivity)
      window.removeEventListener("scroll", updateActivity)
      clearInterval(interval)
    }
  }, [lastActivity, isActive])

  if (!isActive) return null

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-md">
      <Alert variant="warning" className="border-2 border-yellow-500 shadow-lg animate-pulse">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Page Processing</AlertTitle>
        <AlertDescription>
          <p className="mb-2">The page is currently processing a large amount of data and may appear unresponsive.</p>
          <p className="text-sm">
            Please wait while the scraper completes its work. Avoid closing the tab or refreshing.
          </p>
        </AlertDescription>
      </Alert>
    </div>
  )
}

