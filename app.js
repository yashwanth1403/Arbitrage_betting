const express = require("express");
const { exec } = require("child_process");
const path = require("path");
const fs = require("fs");
const cron = require("node-cron");
require("dotenv").config();

// Import our modules directly instead of running them as separate processes
const matchFinder = require("./matchFinder.js");
const processMatches = require("./process-matches.js");

// Create Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Track process status
const processStatus = {
  processingMatches: false,
  findingMatches: false,
  lastRunTime: {
    processingMatches: null,
    findingMatches: null,
  },
  lastRunResult: {
    processingMatches: null,
    findingMatches: null,
  },
};

// Middleware to parse JSON requests
app.use(express.json());

// Log function
function log(message) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${message}`);

  // Also append to log file
  const logDir =
    process.env.NODE_ENV === "production" ? "/data/logs" : "./logs";

  // Create logs directory if it doesn't exist
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }

  const logFile = path.join(
    logDir,
    `app-${new Date().toISOString().split("T")[0]}.log`
  );
  fs.appendFileSync(logFile, `[${timestamp}] ${message}\n`);
}

// Status endpoint
app.get("/api/status", (req, res) => {
  // Get the last data fetch times from process-matches
  const lastDataFetch = processMatches.getLastDataFetch
    ? processMatches.getLastDataFetch()
    : {
        matchFinder: null,
        mostbet: null,
        melbet: null,
      };

  // Format the timestamps for display
  const formattedDataFetch = {
    matchFinder: lastDataFetch.matchFinder
      ? new Date(lastDataFetch.matchFinder).toISOString()
      : "Never",
    mostbet: lastDataFetch.mostbet
      ? new Date(lastDataFetch.mostbet).toISOString()
      : "Never",
    melbet: lastDataFetch.melbet
      ? new Date(lastDataFetch.melbet).toISOString()
      : "Never",
  };

  // Calculate staleness
  const now = Date.now();
  const DATA_REFRESH_THRESHOLD = 15 * 60 * 1000; // 15 minutes in ms
  const dataFreshness = {
    matchFinder: lastDataFetch.matchFinder
      ? now - lastDataFetch.matchFinder < DATA_REFRESH_THRESHOLD
      : false,
    mostbet: lastDataFetch.mostbet
      ? now - lastDataFetch.mostbet < DATA_REFRESH_THRESHOLD
      : false,
    melbet: lastDataFetch.melbet
      ? now - lastDataFetch.melbet < DATA_REFRESH_THRESHOLD
      : false,
  };

  res.json({
    status: "online",
    processes: processStatus,
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    environment: process.env.NODE_ENV || "development",
    data: {
      matchingMatches: matchFinder.getMatchingMatches().length || 0,
      arbitrageOpportunities:
        processMatches.getArbitrageOpportunities().length || 0,
      lastDataFetch: formattedDataFetch,
      dataFreshness: dataFreshness,
      isDataStale:
        !dataFreshness.matchFinder ||
        !dataFreshness.mostbet ||
        !dataFreshness.melbet,
    },
  });
});

// Process matches endpoint
app.get("/api/process-matches", async (req, res) => {
  if (processStatus.processingMatches) {
    return res.status(200).json({
      success: false,
      message: "Process matches is already running",
      startedAt: processStatus.lastRunTime.processingMatches,
    });
  }

  try {
    processStatus.processingMatches = true;
    processStatus.lastRunTime.processingMatches = new Date().toISOString();

    console.log("DEBUG: API - Starting process-matches execution");

    // Start the process and immediately respond to client
    res.json({
      success: true,
      message: "Process matches started",
      startedAt: processStatus.lastRunTime.processingMatches,
    });

    // Run the process directly instead of executing a command
    log("Starting process-matches via API...");
    const opportunities = await processMatches.processAllMatches();

    // Update status
    processStatus.lastRunResult.processingMatches = {
      success: true,
      completedAt: new Date().toISOString(),
      opportunitiesFound: opportunities.length,
    };
    log(
      `Process-matches completed with ${opportunities.length} opportunities found`
    );
  } catch (error) {
    console.log(`DEBUG: API - Exception in process-matches: ${error.message}`);
    console.log(`DEBUG: API - Stack trace: ${error.stack}`);
    log(`Error in process-matches API: ${error.message}`);
    processStatus.lastRunResult.processingMatches = {
      success: false,
      completedAt: new Date().toISOString(),
      error: error.message,
    };
  } finally {
    console.log("DEBUG: API - Process matches endpoint completed");
    processStatus.processingMatches = false;
  }
});

// Match finder endpoint
app.get("/api/match-finder", async (req, res) => {
  if (processStatus.findingMatches) {
    return res.status(409).json({
      success: false,
      message: "Match finder is already running",
      startedAt: processStatus.lastRunTime.findingMatches,
    });
  }

  try {
    processStatus.findingMatches = true;
    processStatus.lastRunTime.findingMatches = new Date().toISOString();

    // Start the process and immediately respond to client
    res.json({
      success: true,
      message: "Match finder started",
      startedAt: processStatus.lastRunTime.findingMatches,
    });

    // Run the match finder directly instead of executing a command
    log("Starting match finder via API...");
    const matches = await matchFinder.runMatchFinder();

    // Update status
    processStatus.lastRunResult.findingMatches = {
      success: true,
      completedAt: new Date().toISOString(),
      matchesFound: matches.length,
    };
    log(`Match finder completed with ${matches.length} matches found`);
  } catch (error) {
    log(`Error in match-finder API: ${error.message}`);
    processStatus.lastRunResult.findingMatches = {
      success: false,
      completedAt: new Date().toISOString(),
      error: error.message,
    };
  } finally {
    processStatus.findingMatches = false;
  }
});

// Run all processes in sequence endpoint
app.get("/api/run-all", async (req, res) => {
  // If any process is already running, return an error
  if (processStatus.findingMatches || processStatus.processingMatches) {
    return res.status(409).json({
      success: false,
      message: "One or more processes are already running",
      currentStatus: {
        findingMatches: processStatus.findingMatches,
        processingMatches: processStatus.processingMatches,
      },
    });
  }

  // Start the sequence and immediately respond to client
  res.json({
    success: true,
    message: "Full process sequence started",
    startedAt: new Date().toISOString(),
  });

  // Run the processes in sequence
  try {
    log("Starting full process sequence");

    // 1. Run match finder
    processStatus.findingMatches = true;
    processStatus.lastRunTime.findingMatches = new Date().toISOString();

    log("Running match finder...");
    const matches = await matchFinder.runMatchFinder();

    processStatus.lastRunResult.findingMatches = {
      success: true,
      completedAt: new Date().toISOString(),
      matchesFound: matches.length,
    };
    processStatus.findingMatches = false;
    log(`Match finder completed with ${matches.length} matches found`);

    // Wait a moment before starting the next process
    await new Promise((resolve) => setTimeout(resolve, 5000));

    // 2. Process matches
    processStatus.processingMatches = true;
    processStatus.lastRunTime.processingMatches = new Date().toISOString();

    log("Running process-matches...");
    const opportunities = await processMatches.processAllMatches();

    processStatus.lastRunResult.processingMatches = {
      success: true,
      completedAt: new Date().toISOString(),
      opportunitiesFound: opportunities.length,
    };
    processStatus.processingMatches = false;
    log(
      `Process-matches completed with ${opportunities.length} opportunities found`
    );

    log("Full process sequence completed");
  } catch (error) {
    log(`Error in run-all sequence: ${error.message}`);
    // Make sure all process flags are reset
    processStatus.findingMatches = false;
    processStatus.processingMatches = false;
  }
});

// Add a new endpoint to refresh all data
app.get("/api/refresh-data", async (req, res) => {
  try {
    log("Manual data refresh requested");

    // Start the process and immediately respond to client
    res.json({
      success: true,
      message: "Data refresh started",
      startedAt: new Date().toISOString(),
    });

    // Run the refresh function
    const success = await processMatches.refreshAllData();

    log(`Manual data refresh ${success ? "completed successfully" : "failed"}`);
  } catch (error) {
    log(`Error in manual data refresh: ${error.message}`);
  }
});

// Health check endpoint
app.get("/health", (req, res) => {
  res.status(200).send("OK");
});

// Root endpoint with basic info
app.get("/", (req, res) => {
  res.json({
    name: "Arbitrage API",
    version: "1.0.0",
    endpoints: [
      { method: "GET", path: "/api/status", description: "Get system status" },
      {
        method: "GET",
        path: "/api/process-matches",
        description: "Run the process-matches job",
      },
      {
        method: "GET",
        path: "/api/match-finder",
        description: "Run the match finder job",
      },
      {
        method: "GET",
        path: "/api/run-all",
        description: "Run all jobs in sequence",
      },
      {
        method: "GET",
        path: "/api/refresh-data",
        description: "Manually refresh all data sources",
      },
      { method: "GET", path: "/health", description: "Health check endpoint" },
    ],
  });
});

// Start the server
app.listen(PORT, () => {
  log(`Server running on port ${PORT}`);
  log(`Environment: ${process.env.NODE_ENV || "development"}`);
});

// Handle graceful shutdown
process.on("SIGTERM", () => {
  log("SIGTERM received, shutting down gracefully");
  process.exit(0);
});

module.exports = app; // Export for testing purposes
