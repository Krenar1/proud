import fs from "fs"
import path from "path"

// Define file paths
const DATA_DIR = path.join(process.cwd(), "data")
const SETTINGS_FILE = path.join(DATA_DIR, "settings.json")
const LOGS_FILE = path.join(DATA_DIR, "logs.json")

// Default settings
const DEFAULT_SETTINGS = {
  enabled: true, // Set to true by default so it works immediately
  interval: 30,
  numProductsToCheck: 50,
  discordWebhook: "",
  notifyDiscord: false,
  lastRunAt: null,
  totalRuns: 0,
  totalProductsFound: 0,
  totalProductsChecked: 0,
  deepScanEnabled: true,
  obfuscationEnabled: true,
  socialMediaEnabled: true,
  autoRetryEnabled: true,
}

// Initialize storage
export function initializeStorage() {
  try {
    // Make sure the data directory exists
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true })
      console.log(`Created data directory at ${DATA_DIR}`)
    }

    // Initialize settings file if it doesn't exist
    if (!fs.existsSync(SETTINGS_FILE)) {
      fs.writeFileSync(SETTINGS_FILE, JSON.stringify(DEFAULT_SETTINGS, null, 2))
      console.log(`Created settings file with default values at ${SETTINGS_FILE}`)
    }

    // Initialize logs file if it doesn't exist
    if (!fs.existsSync(LOGS_FILE)) {
      fs.writeFileSync(LOGS_FILE, JSON.stringify([]))
      console.log(`Created empty logs file at ${LOGS_FILE}`)
    }

    return true
  } catch (error) {
    console.error("Error initializing storage:", error)
    return false
  }
}

// Initialize storage on module load
initializeStorage()

// Function to get settings
export function getSettings() {
  try {
    // Ensure storage is initialized
    initializeStorage()

    // Read settings file
    const data = fs.readFileSync(SETTINGS_FILE, "utf8")
    const settings = JSON.parse(data)

    // Merge with default settings to ensure all fields exist
    return { ...DEFAULT_SETTINGS, ...settings }
  } catch (error) {
    console.error("Error reading settings:", error)
    // Return default settings if there's an error
    return { ...DEFAULT_SETTINGS }
  }
}

// Function to save settings
export function saveSettings(settings) {
  try {
    // Ensure storage is initialized
    initializeStorage()

    // Merge with existing settings to preserve any fields not included in the update
    const existingSettings = getSettings()
    const mergedSettings = { ...existingSettings, ...settings }

    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(mergedSettings, null, 2))
    console.log("Settings saved successfully")
    return true
  } catch (error) {
    console.error("Error saving settings:", error)
    return false
  }
}

// Function to get logs
export function getLogs() {
  try {
    // Ensure storage is initialized
    initializeStorage()

    const data = fs.readFileSync(LOGS_FILE, "utf8")
    return JSON.parse(data)
  } catch (error) {
    console.error("Error reading logs:", error)
    return []
  }
}

// Function to add a log
export function addLog(log) {
  try {
    // Ensure storage is initialized
    initializeStorage()

    const logs = getLogs()
    const newLog = {
      id: Date.now().toString(),
      createdAt: new Date().toISOString(),
      ...log,
    }
    logs.unshift(newLog) // Add to beginning

    // Keep only the last 100 logs
    const trimmedLogs = logs.slice(0, 100)

    fs.writeFileSync(LOGS_FILE, JSON.stringify(trimmedLogs, null, 2))
    return newLog
  } catch (error) {
    console.error("Error adding log:", error)
    return null
  }
}

