const fs = require("fs");
const path = require("path");
const axios = require("axios");

/**
 * Match finder algorithm that identifies the same matches from two different sources
 * using team name similarity and date/time proximity
 */

// Similarity threshold (60%)
const SIMILARITY_THRESHOLD = 0.6;
// Maximum time difference in minutes
const MAX_TIME_DIFFERENCE_MINUTES = 5;

// Store data in memory
let mostbetMatches = [];
let melbetMatches = [];
let matchingMatches = [];

/**
 * Calculate the similarity between two strings using Levenshtein distance
 * @param {string} str1 - First string
 * @param {string} str2 - Second string
 * @returns {number} Similarity score between 0 and 1
 */
function stringSimilarity(str1, str2) {
  if (!str1 || !str2) return 0;

  // Convert both strings to lowercase for better comparison
  const s1 = str1.toLowerCase();
  const s2 = str2.toLowerCase();

  // Calculate Levenshtein distance
  const track = Array(s2.length + 1)
    .fill(null)
    .map(() => Array(s1.length + 1).fill(null));

  for (let i = 0; i <= s1.length; i += 1) {
    track[0][i] = i;
  }

  for (let j = 0; j <= s2.length; j += 1) {
    track[j][0] = j;
  }

  for (let j = 1; j <= s2.length; j += 1) {
    for (let i = 1; i <= s1.length; i += 1) {
      const indicator = s1[i - 1] === s2[j - 1] ? 0 : 1;
      track[j][i] = Math.min(
        track[j][i - 1] + 1, // deletion
        track[j - 1][i] + 1, // insertion
        track[j - 1][i - 1] + indicator // substitution
      );
    }
  }

  // Calculate similarity (1 - normalized distance)
  const maxLength = Math.max(s1.length, s2.length);
  return maxLength > 0 ? 1 - track[s2.length][s1.length] / maxLength : 1;
}

/**
 * Calculate time difference in minutes between two timestamps
 * @param {number|string} timestamp1 - First timestamp or ISO date string
 * @param {number|string} timestamp2 - Second timestamp or ISO date string
 * @returns {number} Absolute difference in minutes
 */
function getTimeDifferenceMinutes(timestamp1, timestamp2) {
  // Convert to Date objects if needed
  const date1 =
    typeof timestamp1 === "number"
      ? new Date(timestamp1 * 1000)
      : new Date(timestamp1);
  const date2 =
    typeof timestamp2 === "number"
      ? new Date(timestamp2 * 1000)
      : new Date(timestamp2);

  // Calculate difference in milliseconds and convert to minutes
  const diffMs = Math.abs(date1 - date2);
  return diffMs / (1000 * 60);
}

/**
 * Find matching matches between two sources
 * @param {Array} mostbetMatches - Matches from Mostbet
 * @param {Array} melbetMatches - Matches from Melbet
 * @returns {Array} Array of matching pairs with similarity scores
 */
function findMatchingMatches(mostbetMatches, melbetMatches) {
  const matches = [];

  // Iterate through all Mostbet matches
  for (const mostbet of mostbetMatches) {
    // Compare with each Melbet match
    for (const melbet of melbetMatches) {
      // Calculate team name similarities
      const homeSimilarity = stringSimilarity(
        mostbet.home_team,
        melbet.home_team
      );
      const awaySimilarity = stringSimilarity(
        mostbet.away_team,
        melbet.away_team
      );

      // Try reverse match (sometimes home/away teams are swapped)
      const reverseHomeSimilarity = stringSimilarity(
        mostbet.home_team,
        melbet.away_team
      );
      const reverseAwaySimilarity = stringSimilarity(
        mostbet.away_team,
        melbet.home_team
      );

      // Use the best match (regular or reverse)
      const isReversed =
        reverseHomeSimilarity + reverseAwaySimilarity >
        homeSimilarity + awaySimilarity;
      const teamSimilarity = isReversed
        ? (reverseHomeSimilarity + reverseAwaySimilarity) / 2
        : (homeSimilarity + awaySimilarity) / 2;

      // Calculate time difference
      const timeDiff = getTimeDifferenceMinutes(
        mostbet.timestamp,
        melbet.timestamp
      );

      // Match is valid if team similarity is above threshold and time difference is acceptable
      if (
        teamSimilarity >= SIMILARITY_THRESHOLD &&
        timeDiff <= MAX_TIME_DIFFERENCE_MINUTES
      ) {
        matches.push({
          mostbet: mostbet,
          melbet: melbet,
          similarity: {
            teams: teamSimilarity.toFixed(2),
            isTeamsReversed: isReversed,
            timeDifferenceMinutes: Math.round(timeDiff),
          },
        });
      }
    }
  }

  // Sort matches by similarity (highest first)
  return matches.sort((a, b) => b.similarity.teams - a.similarity.teams);
}

/**
 * Fetch Mostbet data directly through API calls
 * @returns {Promise<Array>} Array of Mostbet matches
 */
async function fetchMostbetMatches() {
  console.log("Fetching Mostbet matches via API...");
  const matches = [];
  let offset = 0;

  // Define common headers to mimic a browser request
  const headers = {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
    Accept: "application/json, text/plain, */*",
    "Accept-Language": "en-US,en;q=0.9",
    Connection: "keep-alive",
    "Cache-Control": "no-cache",
    Pragma: "no-cache",
    "Sec-Fetch-Dest": "empty",
    "Sec-Fetch-Mode": "cors",
    "Sec-Fetch-Site": "same-origin",
  };

  // Define alternate Mostbet domains to try if the main one fails
  const mostbetDomains = [
    "mostbet-in62.com",
    "mostbet.com",
    "mostbet-india.com",
    "mostbet-in.com",
  ];

  let currentDomainIndex = 0;
  let successfulDomain = mostbetDomains[0]; // Default to first domain

  try {
    // Continue fetching until no more matches are found
    while (true) {
      console.log(`Fetching matches with offset: ${offset}`);

      let retryCount = 0;
      let response = null;
      let lastError = null;

      // Try up to 3 times with different domains if needed
      while (retryCount < 3 && !response) {
        try {
          // Construct the API URL with the current offset and domain
          const domain = mostbetDomains[currentDomainIndex];
          const url = `https://${domain}/api/v3/user/line/list?t[]=1&lc[]=1&um=12&ss=all&l=20&of=${offset}&ltr=0`;

          console.log(`Attempt ${retryCount + 1}: Using domain ${domain}`);

          // Fetch data from the API
          response = await axios.get(url, {
            headers,
            timeout: 10000, // 10 second timeout
          });

          // If we get here, the request was successful
          successfulDomain = domain;
          console.log(`Successfully fetched data from ${domain}`);
        } catch (error) {
          lastError = error;

          // Handle 451 error (Unavailable for Legal Reasons)
          if (error.response && error.response.status === 451) {
            console.log(
              `Domain ${mostbetDomains[currentDomainIndex]} returned 451 error (geo-restricted). Trying next domain...`
            );
            // Try next domain
            currentDomainIndex =
              (currentDomainIndex + 1) % mostbetDomains.length;
          } else {
            console.error(
              `Error fetching from ${mostbetDomains[currentDomainIndex]}: ${error.message}`
            );
          }

          retryCount++;

          // Wait before retrying to avoid overwhelming the server
          await new Promise((resolve) => setTimeout(resolve, 2000));
        }
      }

      // If all retries failed, break the loop
      if (!response) {
        console.error(
          `All domains failed after 3 retries. Last error: ${lastError?.message}`
        );
        break;
      }

      // Check if the request was successful and contains data
      if (!response.data || !response.data.lines_hierarchy) {
        console.log("No more data available or invalid response. Stopping.");
        break;
      }

      // Process the data and extract matches
      const newMatches = extractMostbetMatches(response.data);

      // Break the loop if no matches were found
      if (newMatches.length === 0) {
        console.log(
          `No matches found with offset ${offset}. Finished fetching.`
        );
        break;
      }

      // Add matches to the collection
      matches.push(...newMatches);
      console.log(
        `Found ${newMatches.length} matches. Total matches so far: ${matches.length}`
      );

      // Increase offset for the next request
      offset += 20;

      // Add a small delay to avoid overwhelming the server
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    console.log(`Total Mostbet matches found: ${matches.length}`);
    return matches;
  } catch (error) {
    console.error("Error fetching Mostbet data:", error.message);
    return [];
  }
}

/**
 * Extract Mostbet match information from the API response
 * @param {Object} data - The API response data
 * @returns {Array} - Array of extracted match information
 */
function extractMostbetMatches(data) {
  const matches = [];

  if (!data || !data.lines_hierarchy) {
    return matches;
  }

  // Navigate through the nested structure
  data.lines_hierarchy.forEach((category) => {
    category.line_category_dto_collection?.forEach((sportCategory) => {
      const sportName = sportCategory.title || "Football";

      sportCategory.line_supercategory_dto_collection?.forEach(
        (superCategory) => {
          superCategory.line_subcategory_dto_collection?.forEach(
            (subCategory) => {
              const leagueName = subCategory.title_old || "";
              const leagueId = subCategory.id || "";

              subCategory.line_dto_collection?.forEach((line) => {
                const matchId = parseInt(line.id) || 0;
                const matchData = line.match;
                if (matchData) {
                  const matchTitle = matchData.title || "";
                  const matchTimestamp = matchData.begin_at || 0;

                  // Split team names by the hyphen
                  const teams = matchTitle.split(" - ");
                  const homeTeam = teams[0] || "";
                  const awayTeam = teams[1] || "";

                  // Convert timestamp to ISO format date string
                  const matchDate = new Date(
                    matchTimestamp * 1000
                  ).toISOString();

                  // Create match info object following the melbet format
                  const matchInfo = {
                    match_id: matchId,
                    home_team: homeTeam,
                    away_team: awayTeam,
                    league_id: parseInt(leagueId) || 0,
                    league_name: leagueName,
                    sport: sportName,
                    timestamp: matchTimestamp,
                    date: matchDate,
                  };

                  matches.push(matchInfo);
                }
              });
            }
          );
        }
      );
    });
  });

  return matches;
}

/**
 * Fetch Melbet data directly through API calls
 * @returns {Promise<Array>} Array of Melbet matches
 */
async function fetchMelbetMatches() {
  console.log("Fetching Melbet matches via API...");

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

  // Define alternate Melbet domains to try if the main one fails
  const melbetDomains = [
    "melbet-india.net",
    "melbet.com",
    "melbet-in.com",
    "melbet-ind.com",
  ];

  // Define alternate 1xBet domains for fetching league data
  const onexBetDomains = [
    "ind.1x-bet.mobi",
    "1xbet.com",
    "1xbet-india.com",
    "app.1xbet.com",
  ];

  let currentMelbetDomainIndex = 0;
  let currentOnexBetDomainIndex = 0;

  try {
    // First fetch to get league IDs
    let leaguesResponse = null;
    let retryCount = 0;
    let lastError = null;

    // Try up to 3 times with different domains for the main league list
    while (retryCount < 3 && !leaguesResponse) {
      try {
        const domain = melbetDomains[currentMelbetDomainIndex];
        const url = `https://${domain}/service-api/LineFeed/GetSportsShortZip?sports=1&lng=en&country=71&partner=8&virtualSports=true&gr=1182&groupChamps=true&tsFrom=${tsFrom}&tsTo=${tsTo}`;

        console.log(
          `Attempt ${retryCount + 1}: Fetching league data from ${domain}`
        );
        console.log("Fetching data from URL:", url);

        leaguesResponse = await axios.get(url, {
          headers,
          timeout: 10000, // 10 second timeout
        });

        console.log(`Successfully fetched league data from ${domain}`);
      } catch (error) {
        lastError = error;

        // Handle 451 error (Unavailable for Legal Reasons) or other network errors
        if (error.response && error.response.status === 451) {
          console.log(
            `Domain ${melbetDomains[currentMelbetDomainIndex]} returned 451 error (geo-restricted). Trying next domain...`
          );
        } else {
          console.error(
            `Error fetching from ${melbetDomains[currentMelbetDomainIndex]}: ${error.message}`
          );
        }

        // Try next domain
        currentMelbetDomainIndex =
          (currentMelbetDomainIndex + 1) % melbetDomains.length;
        retryCount++;

        // Wait before retrying
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }

    // If all retries failed, return empty array
    if (!leaguesResponse) {
      console.error(
        `All Melbet domains failed after 3 retries. Last error: ${lastError?.message}`
      );
      return [];
    }

    // Extract league IDs
    const leagueIds = extractLeagueIds(leaguesResponse.data);
    console.log(`Found ${leagueIds.length} league IDs`);

    if (leagueIds.length === 0) {
      console.error("No league IDs found");
      return [];
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

          let leagueResponse = null;
          let retryCount = 0;

          // Try up to 3 times with different domains for each league
          while (retryCount < 3 && !leagueResponse) {
            try {
              const domain = onexBetDomains[currentOnexBetDomainIndex];
              const leagueUrl = `https://${domain}/LineFeed/Get1x2_VZip?sports=1&champs=${leagueId}&count=50&lng=en&tf=2200000&tz=5&mode=4&country=71&partner=71&getEmpty=true&gr=35`;

              leagueResponse = await axios.get(leagueUrl, {
                headers,
                timeout: 15000, // 15 second timeout for league data
              });
            } catch (error) {
              // Handle 451 error or other network errors
              if (error.response && error.response.status === 451) {
                console.log(
                  `Domain ${onexBetDomains[currentOnexBetDomainIndex]} returned 451 error. Trying next domain...`
                );
              } else {
                console.error(
                  `Error fetching league ID ${leagueId} from ${onexBetDomains[currentOnexBetDomainIndex]}: ${error.message}`
                );
              }

              // Try next domain
              currentOnexBetDomainIndex =
                (currentOnexBetDomainIndex + 1) % onexBetDomains.length;
              retryCount++;

              // Wait before retrying
              await new Promise((resolve) => setTimeout(resolve, 1500));
            }
          }

          if (!leagueResponse) {
            console.error(
              `Failed to fetch data for league ID: ${leagueId} after 3 attempts`
            );
            return;
          }

          if (
            leagueResponse.data &&
            leagueResponse.data.Success &&
            leagueResponse.data.Value
          ) {
            processMelbetMatches(
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
        await new Promise((resolve) =>
          setTimeout(resolve, DELAY_BETWEEN_BATCHES)
        );
      }
    }

    console.log(`Total Melbet matches found: ${allMatches.length}`);
    return allMatches;
  } catch (error) {
    console.error("Error fetching Melbet data:", error.message);
    return [];
  }
}

/**
 * Process Melbet matches and extract only the fields we need
 * @param {Array} matchesData - Raw matches data from API
 * @param {Array} allMatches - Array to store processed matches
 * @param {Set} processedMatchIds - Set to track processed match IDs
 */
function processMelbetMatches(matchesData, allMatches, processedMatchIds) {
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

/**
 * Extract league IDs from Melbet API response
 * @param {Object} data - API response data
 * @returns {Array} Array of league IDs
 */
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

/**
 * Main function to fetch data and find matches
 * @returns {Promise<Array>} Array of matching matches
 */
async function main() {
  console.log("Starting match finder process...");

  const MAX_RETRIES = 2;
  let retryCount = 0;
  let success = false;

  while (!success && retryCount <= MAX_RETRIES) {
    try {
      if (retryCount > 0) {
        console.log(`Retry attempt ${retryCount} of ${MAX_RETRIES}...`);
        // Add a delay between retry attempts
        await new Promise((resolve) => setTimeout(resolve, 5000));
      }

      // Fetch match data directly from APIs
      console.log("Fetching match data from APIs...");

      // Fetch data in parallel with timeouts to prevent hanging
      console.log("Starting parallel data fetching with 2-minute timeout...");
      const fetchTimeout = new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error("Data fetching timeout after 2 minutes")),
          120000
        )
      );

      const [mostbetData, melbetData] = await Promise.race([
        Promise.all([
          fetchMostbetMatches().catch((error) => {
            console.error("Error in Mostbet fetch:", error.message);
            return []; // Return empty array on error
          }),
          fetchMelbetMatches().catch((error) => {
            console.error("Error in Melbet fetch:", error.message);
            return []; // Return empty array on error
          }),
        ]),
        fetchTimeout,
      ]);

      // Check if we got any data
      if (
        mostbetData &&
        mostbetData.length > 0 &&
        melbetData &&
        melbetData.length > 0
      ) {
        // Store data in memory
        mostbetMatches = mostbetData;
        melbetMatches = melbetData;

        console.log(
          `Loaded ${mostbetMatches.length} Mostbet matches and ${melbetMatches.length} Melbet matches`
        );

        // Find matching matches
        console.log("Finding matching matches...");
        matchingMatches = findMatchingMatches(mostbetMatches, melbetMatches);

        console.log(`Found ${matchingMatches.length} matching matches`);

        // If we found at least one match, consider it a success
        if (matchingMatches.length > 0) {
          success = true;

          // Display a few examples
          console.log("\nSample matches:");
          const sampleCount = Math.min(5, matchingMatches.length);

          for (let i = 0; i < sampleCount; i++) {
            const match = matchingMatches[i];
            console.log(
              `\nMatch #${i + 1} (Similarity: ${
                match.similarity.teams
              }, Time diff: ${match.similarity.timeDifferenceMinutes} mins)`
            );
            console.log(
              `Mostbet: ${match.mostbet.home_team} vs ${
                match.mostbet.away_team
              } (${new Date(match.mostbet.timestamp * 1000).toISOString()})`
            );
            console.log(
              `Melbet: ${match.melbet.home_team} vs ${match.melbet.away_team} (${match.melbet.date})`
            );
          }
        } else {
          console.log("No matching matches found between the two bookmakers");

          // If we didn't find matches but have data from both sources, we'll still
          // consider it a partial success but will retry once more
          if (retryCount < MAX_RETRIES) {
            console.log("Will retry one more time to find matches...");
          } else {
            // If this was our last retry, we'll just use what we have
            console.log("Max retries reached. Proceeding with available data.");
            success = true;
          }
        }
      } else {
        // We didn't get data from both sources, increase retry count
        console.log("Failed to get data from both bookmakers. Will retry.");
        retryCount++;
      }
    } catch (error) {
      console.error(
        `Error in main function (attempt ${retryCount + 1}):`,
        error.message
      );
      retryCount++;

      if (retryCount > MAX_RETRIES) {
        console.error("Max retries exceeded. Returning any available matches.");
        // Return whatever we have at this point
        return matchingMatches;
      }
    }
  }

  return matchingMatches;
}

// Export the functions and data for use in other modules
module.exports = {
  findMatchingMatches,
  fetchMostbetMatches,
  fetchMelbetMatches,
  getMatchingMatches: () => matchingMatches,
  runMatchFinder: main,
};

// Only run main function if this script is executed directly
if (require.main === module) {
  main();
}
