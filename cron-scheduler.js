const cron = require("node-cron");
const axios = require("axios");
require("dotenv").config();

// Base URL for API - change this to match your deployment
const API_BASE_URL = process.env.API_URL || "http://localhost:3000";

// Log function to print timestamp with each log
function logWithTimestamp(message) {
  const now = new Date();
  console.log(`[${now.toISOString()}] ${message}`);
}

// Function to call API endpoints
async function callApiEndpoint(endpoint, description) {
  try {
    logWithTimestamp(`Calling API: ${description}`);
    const response = await axios.post(`${API_BASE_URL}${endpoint}`);
    logWithTimestamp(`API call successful: ${description}`);
    return response.data;
  } catch (error) {
    if (error.response) {
      // The request was made and the server responded with a status code
      // that falls out of the range of 2xx
      logWithTimestamp(
        `API error (${description}): ${
          error.response.status
        } - ${JSON.stringify(error.response.data)}`
      );
    } else if (error.request) {
      // The request was made but no response was received
      logWithTimestamp(`API no response (${description}): ${error.message}`);
    } else {
      // Something happened in setting up the request that triggered an Error
      logWithTimestamp(
        `API call setup error (${description}): ${error.message}`
      );
    }
    return { success: false, error: error.message };
  }
}

// Schedule process-matches.js to run every 1 minute
cron.schedule("* * * * *", async () => {
  await callApiEndpoint("/api/process-matches", "Process matches");
});

// Schedule data fetching to run every 20 minutes
cron.schedule("*/20 * * * *", async () => {
  // Sequence of calls with delays in between
  try {
    // 1. Fetch Mostbet data
    await callApiEndpoint("/api/fetch-mostbet", "Fetch Mostbet data");

    // Wait 10 seconds before next call
    await new Promise((resolve) => setTimeout(resolve, 10000));

    // 2. Fetch Melbet data
    await callApiEndpoint("/api/fetch-melbet", "Fetch Melbet data");

    // Wait 10 seconds before next call
    await new Promise((resolve) => setTimeout(resolve, 10000));

    // 3. Run match finder
    await callApiEndpoint("/api/match-finder", "Match finder");

    logWithTimestamp("Completed full data refresh sequence");
  } catch (error) {
    logWithTimestamp(`Error in data fetching sequence: ${error.message}`);
  }
});

// Log that the scheduler has started
logWithTimestamp("API-based cron scheduler started");
logWithTimestamp("Schedule:");
logWithTimestamp("- Process matches API: every 1 minute");
logWithTimestamp("- Data fetching sequence: every 20 minutes");
logWithTimestamp(`API base URL: ${API_BASE_URL}`);

// Handle graceful shutdown
process.on("SIGTERM", () => {
  logWithTimestamp("SIGTERM received, shutting down gracefully");
  process.exit(0);
});
