const fs = require("fs");
const axios = require("axios");

// Add rate limiting utility
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchMelbetData() {
  // Get current date
  const now = new Date();

  // Set time to 18:30:00 UTC today
  const currentDay = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
      18,
      30,
      0
    )
  );

  // Calculate next day at 18:30:00 UTC
  const nextDay = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() + 1,
      18,
      30,
      0
    )
  );

  // Convert to timestamps (seconds since epoch)
  const tsFrom = Math.floor(currentDay.getTime() / 1000);
  const tsTo = Math.floor(nextDay.getTime() / 1000);

  console.log(
    `Fetching data from ${currentDay.toISOString()} to ${nextDay.toISOString()}`
  );
  console.log(`Using timestamps: tsFrom=${tsFrom}, tsTo=${tsTo}`);

  // Define common headers to mimic a browser request
  const headers = {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
    Accept: "application/json, text/plain, */*",
    "Accept-Language": "en-US,en;q=0.9",
    Origin: "https://melbet-india.net",
    Referer: "https://melbet-india.net/line/football",
    Connection: "keep-alive",
    "Cache-Control": "no-cache",
    Pragma: "no-cache",
    "Sec-Fetch-Dest": "empty",
    "Sec-Fetch-Mode": "cors",
    "Sec-Fetch-Site": "same-origin",
  };

  try {
    // First fetch to get league IDs
    const url = `https://melbet-india.net/service-api/LineFeed/GetSportsShortZip?sports=1&lng=en&country=71&partner=8&virtualSports=true&gr=1182&groupChamps=true&tsFrom=${tsFrom}&tsTo=${tsTo}`;
    console.log("Fetching data from URL:", url);

    const leaguesResponse = await axios.get(url, { headers });

    // Extract league IDs
    const leagueIds = extractLeagueIds(leaguesResponse.data);
    console.log(`Found ${leagueIds.length} league IDs`);

    if (leagueIds.length === 0) {
      console.error("No league IDs found");
      return;
    }

    // Array to store all processed match data
    const allMatches = [];
    // Set to track already added match IDs
    const processedMatchIds = new Set();

    // Process leagues in batches to avoid overwhelming the server
    const BATCH_SIZE = 5;
    const DELAY_BETWEEN_BATCHES = 1000; // 1 second delay between batches

    for (let i = 0; i < leagueIds.length; i += BATCH_SIZE) {
      const batch = leagueIds.slice(i, i + BATCH_SIZE);
      console.log(
        `Processing batch ${i / BATCH_SIZE + 1} of ${Math.ceil(
          leagueIds.length / BATCH_SIZE
        )}`
      );

      // Create an array of promises for the current batch
      const batchPromises = batch.map(async (leagueId) => {
        try {
          console.log(`Fetching data for league ID: ${leagueId}`);
          const leagueUrl = `https://ind.1x-bet.mobi/LineFeed/Get1x2_VZip?sports=1&champs=${leagueId}&count=50&lng=en&tf=2200000&tz=5&mode=4&country=71&partner=71&getEmpty=true&gr=35`;

          const leagueResponse = await axios.get(leagueUrl, { headers });

          if (
            leagueResponse.data &&
            leagueResponse.data.Success &&
            leagueResponse.data.Value
          ) {
            processMatches(
              leagueResponse.data.Value,
              allMatches,
              processedMatchIds
            );
            console.log(
              `Successfully processed data for league ID: ${leagueId}`
            );
          } else {
            console.error(
              `Failed to fetch valid data for league ID: ${leagueId}`
            );
          }
        } catch (error) {
          console.error(
            `Error fetching data for league ID ${leagueId}:`,
            error.message
          );
        }
      });

      // Wait for all promises in the current batch to resolve
      await Promise.all(batchPromises);

      // Add delay between batches if not the last batch
      if (i + BATCH_SIZE < leagueIds.length) {
        await delay(DELAY_BETWEEN_BATCHES);
      }
    }

    // Write processed data to a single JSON file
    fs.writeFileSync(
      "melbet_matches.json",
      JSON.stringify(allMatches, null, 2)
    );

    console.log(
      `Data successfully written to melbet_matches.json - ${allMatches.length} unique matches found`
    );
    console.log(
      `Filtered out ${
        processedMatchIds.size - allMatches.length
      } duplicate or invalid matches`
    );
  } catch (error) {
    console.error("Error fetching data:", error.message);
    if (error.response) {
      console.error("Response status:", error.response.status);
      console.error("Response data:", error.response.data);
    }
  }
}

// Function to process matches and extract only the fields we need
function processMatches(matchesData, allMatches, processedMatchIds) {
  if (!Array.isArray(matchesData)) {
    return;
  }

  matchesData.forEach((match) => {
    // Skip if match ID already exists or if home/away team is generic
    if (
      !match.CI ||
      processedMatchIds.has(match.CI) ||
      !match.O1E ||
      !match.O2E ||
      match.O1E === "Home" ||
      match.O2E === "Away"
    ) {
      return;
    }

    // Mark this match ID as processed
    processedMatchIds.add(match.CI);

    // Convert timestamp to date string
    const matchDate = new Date(match.S * 1000).toISOString();

    // Extract only the fields we need
    const simplifiedMatch = {
      match_id: match.CI,
      home_team: match.O1E,
      away_team: match.O2E,
      league_id: match.LI,
      league_name: match.LE || "",
      sport: match.SN,
      timestamp: match.S,
      date: matchDate,
    };

    allMatches.push(simplifiedMatch);
  });
}

function extractLeagueIds(data) {
  const leagueIds = [];

  // Check if data and Value array exist
  if (!data || !data.Value || !Array.isArray(data.Value)) {
    return leagueIds;
  }

  // Process each sport category (football, basketball, etc.)
  data.Value.forEach((sportCategory) => {
    // Check if this category has leagues
    if (sportCategory.L && Array.isArray(sportCategory.L)) {
      // Process each league
      sportCategory.L.forEach((league) => {
        // Add the main league ID
        if (league.LI) {
          leagueIds.push(league.LI);
        }

        // Check for sub-leagues/competitions
        if (league.SC && Array.isArray(league.SC)) {
          league.SC.forEach((subLeague) => {
            if (subLeague.LI) {
              leagueIds.push(subLeague.LI);
            }
          });
        }
      });
    }
  });

  return leagueIds;
}

// Execute the function
fetchMelbetData();
