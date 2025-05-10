const express = require("express");
const { exec } = require("child_process");
const path = require("path");
const fs = require("fs");
const cron = require("node-cron");
require("dotenv").config();

// Create Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Track process status
const processStatus = {
  processingMatches: false,
  fetchingMostbet: false,
  fetchingMelbet: false,
  findingMatches: false,
  lastRunTime: {
    processingMatches: null,
    fetchingMostbet: null,
    fetchingMelbet: null,
    findingMatches: null,
  },
  lastRunResult: {
    processingMatches: null,
    fetchingMostbet: null,
    fetchingMelbet: null,
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

// Function to execute a command asynchronously
function executeCommand(command, description) {
  return new Promise((resolve, reject) => {
    log(`Starting: ${description}`);

    exec(command, { maxBuffer: 1024 * 1024 * 50 }, (error, stdout, stderr) => {
      if (error) {
        log(`Error executing ${description}: ${error.message}`);
        return resolve({
          success: false,
          error: error.message,
          stdout,
          stderr,
        });
      }

      if (stderr) {
        log(`${description} stderr: ${stderr}`);
      }

      log(`${description} completed successfully`);
      return resolve({ success: true, stdout, stderr });
    });
  });
}

// Helper function to properly quote paths that might contain spaces
function quotePath(filePath) {
  return `"${filePath}"`;
}

// Run process-matches function
async function runProcessMatches() {
  if (processStatus.processingMatches) {
    log("Process matches is already running, skipping this cron execution");
    return;
  }

  try {
    processStatus.processingMatches = true;
    processStatus.lastRunTime.processingMatches = new Date().toISOString();

    const scriptPath = quotePath(path.join(__dirname, "process-matches.js"));
    const result = await executeCommand(
      `node ${scriptPath}`,
      "Process matches (cron)"
    );

    processStatus.lastRunResult.processingMatches = {
      success: result.success,
      completedAt: new Date().toISOString(),
      error: result.error,
    };
  } catch (error) {
    log(`Error in cron job for process-matches: ${error.message}`);
    processStatus.lastRunResult.processingMatches = {
      success: false,
      completedAt: new Date().toISOString(),
      error: error.message,
    };
  } finally {
    processStatus.processingMatches = false;
  }
}

// Run data fetching and match finding sequence
// async function runDataFetchingSequence() {
//   // If any of these processes are already running, skip this execution
//   if (
//     processStatus.fetchingMostbet ||
//     processStatus.fetchingMelbet ||
//     processStatus.findingMatches
//   ) {
//     log(
//       "One of the data fetching processes is already running, skipping this cron execution"
//     );
//     return;
//   }

//   try {
//     log("Starting scheduled data fetching sequence");

//     // 1. Fetch Mostbet data
//     processStatus.fetchingMostbet = true;
//     processStatus.lastRunTime.fetchingMostbet = new Date().toISOString();

//     const mostbetPath = quotePath(path.join(__dirname, "fetchMostbetData.js"));
//     const mostbetResult = await executeCommand(
//       `node ${mostbetPath}`,
//       "Fetch Mostbet data (cron)"
//     );

//     processStatus.lastRunResult.fetchingMostbet = {
//       success: mostbetResult.success,
//       completedAt: new Date().toISOString(),
//       error: mostbetResult.error,
//     };
//     processStatus.fetchingMostbet = false;

//     // Wait a moment before starting the next process
//     await new Promise((resolve) => setTimeout(resolve, 5000));

//     // 2. Fetch Melbet data
//     processStatus.fetchingMelbet = true;
//     processStatus.lastRunTime.fetchingMelbet = new Date().toISOString();

//     const melbetPath = quotePath(path.join(__dirname, "fetchMelbetData.js"));
//     const melbetResult = await executeCommand(
//       `node ${melbetPath}`,
//       "Fetch Melbet data (cron)"
//     );

//     processStatus.lastRunResult.fetchingMelbet = {
//       success: melbetResult.success,
//       completedAt: new Date().toISOString(),
//       error: melbetResult.error,
//     };
//     processStatus.fetchingMelbet = false;

//     // Wait a moment before starting the next process
//     await new Promise((resolve) => setTimeout(resolve, 5000));

//     // 3. Run match finder
//     processStatus.findingMatches = true;
//     processStatus.lastRunTime.findingMatches = new Date().toISOString();

//     const matchFinderPath = quotePath(path.join(__dirname, "matchFinder.js"));
//     const matchFinderResult = await executeCommand(
//       `node ${matchFinderPath}`,
//       "Match finder (cron)"
//     );

//     processStatus.lastRunResult.findingMatches = {
//       success: matchFinderResult.success,
//       completedAt: new Date().toISOString(),
//       error: matchFinderResult.error,
//     };
//     processStatus.findingMatches = false;

//     log("Scheduled data fetching sequence completed");
//   } catch (error) {
//     log(`Error in cron job for data fetching sequence: ${error.message}`);
//     // Make sure all process flags are reset
//     processStatus.fetchingMostbet = false;
//     processStatus.fetchingMelbet = false;
//     processStatus.findingMatches = false;
//   }
// }

// Status endpoint
app.get("/api/status", (req, res) => {
  res.json({
    status: "online",
    processes: processStatus,
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    environment: process.env.NODE_ENV || "development",
  });
});

// Process matches endpoint
app.get("/api/process-matches", async (req, res) => {
  if (processStatus.processingMatches) {
    return res.status(409).json({
      success: false,
      message: "Process matches is already running",
      startedAt: processStatus.lastRunTime.processingMatches,
    });
  }

  try {
    processStatus.processingMatches = true;
    processStatus.lastRunTime.processingMatches = new Date().toISOString();

    const scriptPath = quotePath(path.join(__dirname, "process-matches.js"));
    const command = `node ${scriptPath}`;

    // Start the process and immediately respond to client
    res.json({
      success: true,
      message: "Process matches started",
      startedAt: processStatus.lastRunTime.processingMatches,
    });

    // Execute the command
    const result = await executeCommand(command, "Process matches");

    // Update status
    processStatus.lastRunResult.processingMatches = {
      success: result.success,
      completedAt: new Date().toISOString(),
      error: result.error,
    };
  } catch (error) {
    log(`Error in process-matches API: ${error.message}`);
    processStatus.lastRunResult.processingMatches = {
      success: false,
      completedAt: new Date().toISOString(),
      error: error.message,
    };
  } finally {
    processStatus.processingMatches = false;
  }
});

// Fetch Mostbet data endpoint
app.get("/api/fetch-mostbet", async (req, res) => {
  if (processStatus.fetchingMostbet) {
    return res.status(409).json({
      success: false,
      message: "Fetch Mostbet data is already running",
      startedAt: processStatus.lastRunTime.fetchingMostbet,
    });
  }

  try {
    processStatus.fetchingMostbet = true;
    processStatus.lastRunTime.fetchingMostbet = new Date().toISOString();

    const scriptPath = quotePath(path.join(__dirname, "fetchMostbetData.js"));
    const command = `node ${scriptPath}`;

    // Start the process and immediately respond to client
    res.json({
      success: true,
      message: "Fetch Mostbet data started",
      startedAt: processStatus.lastRunTime.fetchingMostbet,
    });

    // Execute the command
    const result = await executeCommand(command, "Fetch Mostbet data");

    // Update status
    processStatus.lastRunResult.fetchingMostbet = {
      success: result.success,
      completedAt: new Date().toISOString(),
      error: result.error,
    };
  } catch (error) {
    log(`Error in fetch-mostbet API: ${error.message}`);
    processStatus.lastRunResult.fetchingMostbet = {
      success: false,
      completedAt: new Date().toISOString(),
      error: error.message,
    };
  } finally {
    processStatus.fetchingMostbet = false;
  }
});

// Fetch Melbet data endpoint
app.get("/api/fetch-melbet", async (req, res) => {
  if (processStatus.fetchingMelbet) {
    return res.status(409).json({
      success: false,
      message: "Fetch Melbet data is already running",
      startedAt: processStatus.lastRunTime.fetchingMelbet,
    });
  }

  try {
    processStatus.fetchingMelbet = true;
    processStatus.lastRunTime.fetchingMelbet = new Date().toISOString();

    const scriptPath = quotePath(path.join(__dirname, "fetchMelbetData.js"));
    const command = `node ${scriptPath}`;

    // Start the process and immediately respond to client
    res.json({
      success: true,
      message: "Fetch Melbet data started",
      startedAt: processStatus.lastRunTime.fetchingMelbet,
    });

    // Execute the command
    const result = await executeCommand(command, "Fetch Melbet data");

    // Update status
    processStatus.lastRunResult.fetchingMelbet = {
      success: result.success,
      completedAt: new Date().toISOString(),
      error: result.error,
    };
  } catch (error) {
    log(`Error in fetch-melbet API: ${error.message}`);
    processStatus.lastRunResult.fetchingMelbet = {
      success: false,
      completedAt: new Date().toISOString(),
      error: error.message,
    };
  } finally {
    processStatus.fetchingMelbet = false;
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

    const scriptPath = quotePath(path.join(__dirname, "matchFinder.js"));
    const command = `node ${scriptPath}`;

    // Start the process and immediately respond to client
    res.json({
      success: true,
      message: "Match finder started",
      startedAt: processStatus.lastRunTime.findingMatches,
    });

    // Execute the command
    const result = await executeCommand(command, "Match finder");

    // Update status
    processStatus.lastRunResult.findingMatches = {
      success: result.success,
      completedAt: new Date().toISOString(),
      error: result.error,
    };
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
  if (
    processStatus.fetchingMostbet ||
    processStatus.fetchingMelbet ||
    processStatus.findingMatches ||
    processStatus.processingMatches
  ) {
    return res.status(409).json({
      success: false,
      message: "One or more processes are already running",
      currentStatus: {
        fetchingMostbet: processStatus.fetchingMostbet,
        fetchingMelbet: processStatus.fetchingMelbet,
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

    // 1. Fetch Mostbet data
    processStatus.fetchingMostbet = true;
    processStatus.lastRunTime.fetchingMostbet = new Date().toISOString();

    const mostbetPath = quotePath(path.join(__dirname, "fetchMostbetData.js"));
    const mostbetResult = await executeCommand(
      `node ${mostbetPath}`,
      "Fetch Mostbet data"
    );

    processStatus.lastRunResult.fetchingMostbet = {
      success: mostbetResult.success,
      completedAt: new Date().toISOString(),
      error: mostbetResult.error,
    };
    processStatus.fetchingMostbet = false;

    // Wait a moment before starting the next process
    await new Promise((resolve) => setTimeout(resolve, 5000));

    // 2. Fetch Melbet data
    processStatus.fetchingMelbet = true;
    processStatus.lastRunTime.fetchingMelbet = new Date().toISOString();

    const melbetPath = quotePath(path.join(__dirname, "fetchMelbetData.js"));
    const melbetResult = await executeCommand(
      `node ${melbetPath}`,
      "Fetch Melbet data"
    );

    processStatus.lastRunResult.fetchingMelbet = {
      success: melbetResult.success,
      completedAt: new Date().toISOString(),
      error: melbetResult.error,
    };
    processStatus.fetchingMelbet = false;

    // Wait a moment before starting the next process
    await new Promise((resolve) => setTimeout(resolve, 5000));

    // 3. Run match finder
    processStatus.findingMatches = true;
    processStatus.lastRunTime.findingMatches = new Date().toISOString();

    const matchFinderPath = quotePath(path.join(__dirname, "matchFinder.js"));
    const matchFinderResult = await executeCommand(
      `node ${matchFinderPath}`,
      "Match finder"
    );

    processStatus.lastRunResult.findingMatches = {
      success: matchFinderResult.success,
      completedAt: new Date().toISOString(),
      error: matchFinderResult.error,
    };
    processStatus.findingMatches = false;

    // Wait a moment before starting the next process
    await new Promise((resolve) => setTimeout(resolve, 5000));

    // 4. Process matches
    processStatus.processingMatches = true;
    processStatus.lastRunTime.processingMatches = new Date().toISOString();

    const processMatchesPath = quotePath(
      path.join(__dirname, "process-matches.js")
    );
    const processResult = await executeCommand(
      `node ${processMatchesPath}`,
      "Process matches"
    );

    processStatus.lastRunResult.processingMatches = {
      success: processResult.success,
      completedAt: new Date().toISOString(),
      error: processResult.error,
    };
    processStatus.processingMatches = false;

    log("Full process sequence completed");
  } catch (error) {
    log(`Error in run-all sequence: ${error.message}`);
    // Make sure all process flags are reset
    processStatus.fetchingMostbet = false;
    processStatus.fetchingMelbet = false;
    processStatus.findingMatches = false;
    processStatus.processingMatches = false;
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
        path: "/api/fetch-mostbet",
        description: "Run the fetch Mostbet data job",
      },
      {
        method: "GET",
        path: "/api/fetch-melbet",
        description: "Run the fetch Melbet data job",
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
