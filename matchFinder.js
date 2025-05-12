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

  // Create a rotating set of user agents to appear more like regular browser traffic
  const userAgents = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/115.0",
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
  ];

  // Define a broader set of alternate Mostbet domains to try
  const mostbetDomains = [
    "mostbet-uz.club",
    "mostbet-az.xyz",
    "mostbet-azerbaycan24.com",
    "mostbet-azerbaijan.xyz",
    "mostbet-sportsbook.com",
    "mostbet-india.com",
    "mostbet.com",
    "mostbet-in62.com",
    "mostbet.io",
    "most1.bet",
    "mostbet-br.xyz",
    "mostbet-oynash.com",
  ];

  // Proxy configuration - free proxy options
  // You can replace these with paid proxy services for better reliability
  const proxyOptions = [
    // Format: protocol://username:password@host:port (or protocol://host:port if no auth)
    { url: null }, // No proxy (direct connection) - try first
    { url: "http://104.227.16.86:3189" }, // Example proxy 1
    { url: "http://103.241.205.136:3128" }, // Example proxy 2
    { url: "http://51.159.115.233:3128" }, // Example proxy 3
    { url: "http://187.217.54.84:80" }, // Example proxy 4
    { url: "http://157.245.27.9:3128" }, // Example proxy 5
  ];

  let currentDomainIndex = 0;
  let currentProxyIndex = 0;
  let currentUserAgentIndex = 0;
  let successfulDomain = mostbetDomains[0]; // Default to first domain

  try {
    // Continue fetching until no more matches are found
    while (true) {
      console.log(`Fetching matches with offset: ${offset}`);

      let retryCount = 0;
      let response = null;
      let lastError = null;

      // Try up to 5 times with different combinations of domains, proxies, and user agents
      while (retryCount < 5 && !response) {
        // Rotate through domains, proxies and user agents
        const domain = mostbetDomains[currentDomainIndex];
        const proxy = proxyOptions[currentProxyIndex];
        const userAgent = userAgents[currentUserAgentIndex];

        // Define common headers with rotating user agent
        const headers = {
          "User-Agent": userAgent,
          Accept: "application/json, text/plain, */*",
          "Accept-Language": "en-US,en;q=0.9",
          Connection: "keep-alive",
          "Cache-Control": "no-cache",
          Pragma: "no-cache",
          "Sec-Fetch-Dest": "empty",
          "Sec-Fetch-Mode": "cors",
          "Sec-Fetch-Site": "same-origin",
          // Add randomized headers to look more like a real browser
          "sec-ch-ua": `"Not.A/Brand";v="8", "Chromium";v="${
            Math.floor(Math.random() * 10) + 110
          }", "Google Chrome";v="${Math.floor(Math.random() * 10) + 110}"`,
          "sec-ch-ua-mobile": "?0",
          "sec-ch-ua-platform": '"Windows"',
          Referer: `https://${domain}/`,
          Origin: `https://${domain}`,
        };

        try {
          // Construct the API URL with the current offset and domain
          const url = `https://${domain}/api/v3/user/line/list?t[]=1&lc[]=1&um=12&ss=all&l=20&of=${offset}&ltr=0`;

          console.log(
            `Attempt ${retryCount + 1}: Using domain ${domain} with ${
              proxy.url ? "proxy" : "direct connection"
            }`
          );

          // Configure request options
          const requestOptions = {
            headers,
            timeout: 20000, // 20 second timeout
          };

          // Add proxy if one is selected
          if (proxy.url) {
            console.log(`Using proxy: ${proxy.url}`);
            requestOptions.proxy = {
              host: proxy.url.split("://")[1].split(":")[0],
              port: parseInt(proxy.url.split(":")[2]),
              protocol: proxy.url.split("://")[0],
            };
          }

          // Fetch data from the API
          response = await axios.get(url, requestOptions);

          // If we get here, the request was successful
          successfulDomain = domain;
          console.log(
            `Successfully fetched data from ${domain}${
              proxy.url ? " using proxy" : ""
            }`
          );

          // Save the successful combination for future use
          // We'll continue using this domain/proxy/agent combination as long as it works
          break;
        } catch (error) {
          lastError = error;

          // Handle different error scenarios
          if (error.response && error.response.status === 451) {
            console.log(
              `Domain ${domain} returned 451 error (geo-restricted).`
            );

            // Only change proxy if we're on the last domain and we've tried a few times
            if (retryCount % 2 === 1) {
              // Try next proxy
              currentProxyIndex = (currentProxyIndex + 1) % proxyOptions.length;
              console.log(
                `Switching to ${
                  proxyOptions[currentProxyIndex].url
                    ? "proxy: " + proxyOptions[currentProxyIndex].url
                    : "direct connection"
                }`
              );
            } else {
              // Try next domain
              currentDomainIndex =
                (currentDomainIndex + 1) % mostbetDomains.length;
              console.log(
                `Switching to domain: ${mostbetDomains[currentDomainIndex]}`
              );
            }
          } else if (error.code === "ECONNABORTED") {
            console.error(`Request timed out for ${domain}`);
            // On timeout, try a different proxy
            currentProxyIndex = (currentProxyIndex + 1) % proxyOptions.length;
          } else {
            console.error(`Error fetching from ${domain}: ${error.message}`);
            // For other errors, try different combinations
            if (retryCount % 2 === 0) {
              currentDomainIndex =
                (currentDomainIndex + 1) % mostbetDomains.length;
            } else {
              currentProxyIndex = (currentProxyIndex + 1) % proxyOptions.length;
            }
          }

          // Always rotate user agent on error
          currentUserAgentIndex =
            (currentUserAgentIndex + 1) % userAgents.length;

          retryCount++;

          // Add increasing delay between retries to avoid rate limiting
          const delayMs = 2000 + retryCount * 1000;
          console.log(`Waiting ${delayMs}ms before next attempt...`);
          await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
      }

      // If all retries failed, try to continue with any data we have
      if (!response) {
        console.error(
          `Failed to fetch data after 5 retries. Last error: ${lastError?.message}`
        );
        console.log(
          "Will try to continue with any data we've collected so far."
        );

        // If we haven't found any matches yet, retry once more with a longer delay
        if (matches.length === 0 && offset === 0) {
          console.log(
            "No matches found yet. Will retry after a 30 second pause..."
          );
          await new Promise((resolve) => setTimeout(resolve, 30000));
          continue;
        } else {
          // If we have some matches already or this isn't the first offset, break the loop
          break;
        }
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
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }

    console.log(`Total Mostbet matches found: ${matches.length}`);
    return matches;
  } catch (error) {
    console.error("Error in fetchMostbetMatches:", error.message);
    return matches.length > 0 ? matches : [];
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

  // Create a rotating set of user agents to appear more like regular browser traffic
  const userAgents = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/115.0",
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
  ];

  // Define alternate Melbet domains to try if the main one fails
  const melbetDomains = [
    "melbet-india.net",
    "melbet.com",
    "melbet-in.com",
    "melbet-ind.com",
    "melbet.team",
    "melbet.pk",
    "melbet-uz.club",
    "melbet-az.xyz",
    "melbet.io",
    "ml-bet.com",
    "melbet-brazil.xyz",
    "melbetplay.com",
  ];

  // Define alternate 1xBet domains for fetching league data
  const onexBetDomains = [
    "ind.1x-bet.mobi",
    "1xbet.com",
    "1xbet-india.com",
    "app.1xbet.com",
    "1x-bet.com",
    "1xbet.io",
    "bet-1x.com",
    "1xstavka.ru",
    "1xbit.com",
  ];

  // Proxy configuration - same as in fetchMostbetMatches
  const proxyOptions = [
    // Format: protocol://username:password@host:port (or protocol://host:port if no auth)
    { url: null }, // No proxy (direct connection) - try first
    { url: "http://104.227.16.86:3189" }, // Example proxy 1
    { url: "http://103.241.205.136:3128" }, // Example proxy 2
    { url: "http://51.159.115.233:3128" }, // Example proxy 3
    { url: "http://187.217.54.84:80" }, // Example proxy 4
    { url: "http://157.245.27.9:3128" }, // Example proxy 5
  ];

  let currentMelbetDomainIndex = 0;
  let currentOnexBetDomainIndex = 0;
  let currentProxyIndex = 0;
  let currentUserAgentIndex = 0;

  try {
    // First fetch to get league IDs
    let leaguesResponse = null;
    let retryCount = 0;
    let lastError = null;

    // Try up to 5 times with different domains/proxies/user agents for the main league list
    while (retryCount < 5 && !leaguesResponse) {
      // Rotate through domains, proxies and user agents
      const domain = melbetDomains[currentMelbetDomainIndex];
      const proxy = proxyOptions[currentProxyIndex];
      const userAgent = userAgents[currentUserAgentIndex];

      // Define request headers with rotating user agent
      const headers = {
        "User-Agent": userAgent,
        Accept: "application/json, text/plain, */*",
        "Accept-Language": "en-US,en;q=0.9",
        Origin: `https://${domain}`,
        Referer: `https://${domain}/line/football`,
        Connection: "keep-alive",
        "Cache-Control": "no-cache",
        Pragma: "no-cache",
        "Sec-Fetch-Dest": "empty",
        "Sec-Fetch-Mode": "cors",
        "Sec-Fetch-Site": "same-origin",
        // Add randomized headers to mimic real browsers
        "sec-ch-ua": `"Not.A/Brand";v="8", "Chromium";v="${
          Math.floor(Math.random() * 10) + 110
        }", "Google Chrome";v="${Math.floor(Math.random() * 10) + 110}"`,
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": '"Windows"',
      };

      try {
        const url = `https://${domain}/service-api/LineFeed/GetSportsShortZip?sports=1&lng=en&country=71&partner=8&virtualSports=true&gr=1182&groupChamps=true&tsFrom=${tsFrom}&tsTo=${tsTo}`;

        console.log(
          `Attempt ${
            retryCount + 1
          }: Fetching league data from ${domain} with ${
            proxy.url ? "proxy" : "direct connection"
          }`
        );
        console.log("Fetching data from URL:", url);

        // Configure request options
        const requestOptions = {
          headers,
          timeout: 20000, // 20 second timeout
        };

        // Add proxy if one is selected
        if (proxy.url) {
          console.log(`Using proxy: ${proxy.url}`);
          requestOptions.proxy = {
            host: proxy.url.split("://")[1].split(":")[0],
            port: parseInt(proxy.url.split(":")[2]),
            protocol: proxy.url.split("://")[0],
          };
        }

        leaguesResponse = await axios.get(url, requestOptions);

        console.log(
          `Successfully fetched league data from ${domain}${
            proxy.url ? " using proxy" : ""
          }`
        );
      } catch (error) {
        lastError = error;

        // Handle different error scenarios
        if (error.response && error.response.status === 451) {
          console.log(`Domain ${domain} returned 451 error (geo-restricted).`);

          // Only change proxy if we're on the last domain and we've tried a few times
          if (retryCount % 2 === 1) {
            // Try next proxy
            currentProxyIndex = (currentProxyIndex + 1) % proxyOptions.length;
            console.log(
              `Switching to ${
                proxyOptions[currentProxyIndex].url
                  ? "proxy: " + proxyOptions[currentProxyIndex].url
                  : "direct connection"
              }`
            );
          } else {
            // Try next domain
            currentMelbetDomainIndex =
              (currentMelbetDomainIndex + 1) % melbetDomains.length;
            console.log(
              `Switching to domain: ${melbetDomains[currentMelbetDomainIndex]}`
            );
          }
        } else if (error.code === "ECONNABORTED") {
          console.error(`Request timed out for ${domain}`);
          // On timeout, try a different proxy
          currentProxyIndex = (currentProxyIndex + 1) % proxyOptions.length;
        } else {
          console.error(`Error fetching from ${domain}: ${error.message}`);
          // For other errors, try different combinations
          if (retryCount % 2 === 0) {
            currentMelbetDomainIndex =
              (currentMelbetDomainIndex + 1) % melbetDomains.length;
          } else {
            currentProxyIndex = (currentProxyIndex + 1) % proxyOptions.length;
          }
        }

        // Always rotate user agent on error
        currentUserAgentIndex = (currentUserAgentIndex + 1) % userAgents.length;

        retryCount++;

        // Add increasing delay between retries to avoid rate limiting
        const delayMs = 2000 + retryCount * 1000;
        console.log(`Waiting ${delayMs}ms before next attempt...`);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }

    // If all retries failed, return empty array
    if (!leaguesResponse) {
      console.error(
        `All Melbet domains failed after 5 retries. Last error: ${lastError?.message}`
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

    // Save successful domain/proxy combinations
    let successfulDomain = null;
    let successfulProxy = null;
    let successfulUserAgent = null;

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

          // If we have a successful combination from previous calls, try it first
          if (
            successfulDomain &&
            successfulProxy !== undefined &&
            successfulUserAgent
          ) {
            currentOnexBetDomainIndex =
              onexBetDomains.indexOf(successfulDomain);
            if (currentOnexBetDomainIndex === -1) currentOnexBetDomainIndex = 0;

            currentProxyIndex = proxyOptions.findIndex(
              (p) => p.url === successfulProxy?.url
            );
            if (currentProxyIndex === -1) currentProxyIndex = 0;

            currentUserAgentIndex = userAgents.indexOf(successfulUserAgent);
            if (currentUserAgentIndex === -1) currentUserAgentIndex = 0;
          }

          // Try up to 5 times with different domains for each league
          while (retryCount < 5 && !leagueResponse) {
            // Get current domain, proxy and user agent
            const domain = onexBetDomains[currentOnexBetDomainIndex];
            const proxy = proxyOptions[currentProxyIndex];
            const userAgent = userAgents[currentUserAgentIndex];

            // Define headers with the current user agent
            const headers = {
              "User-Agent": userAgent,
              Accept: "application/json, text/plain, */*",
              "Accept-Language": "en-US,en;q=0.9",
              Origin: `https://${domain}`,
              Referer: `https://${domain}/sports/football`,
              Connection: "keep-alive",
              "Cache-Control": "no-cache",
              Pragma: "no-cache",
              "Sec-Fetch-Dest": "empty",
              "Sec-Fetch-Mode": "cors",
              "Sec-Fetch-Site": "same-origin",
              // Add randomized headers
              "sec-ch-ua": `"Not.A/Brand";v="8", "Chromium";v="${
                Math.floor(Math.random() * 10) + 110
              }", "Google Chrome";v="${Math.floor(Math.random() * 10) + 110}"`,
              "sec-ch-ua-mobile": "?0",
              "sec-ch-ua-platform": '"Windows"',
            };

            try {
              const leagueUrl = `https://${domain}/LineFeed/Get1x2_VZip?sports=1&champs=${leagueId}&count=50&lng=en&tf=2200000&tz=5&mode=4&country=71&partner=71&getEmpty=true&gr=35`;

              // Configure request options
              const requestOptions = {
                headers,
                timeout: 15000, // 15 second timeout for league data
              };

              // Add proxy if one is selected
              if (proxy.url) {
                requestOptions.proxy = {
                  host: proxy.url.split("://")[1].split(":")[0],
                  port: parseInt(proxy.url.split(":")[2]),
                  protocol: proxy.url.split("://")[0],
                };
              }

              // Log this attempt
              console.log(
                `League ${leagueId} - Attempt ${
                  retryCount + 1
                }: Using ${domain} with ${
                  proxy.url ? "proxy" : "direct connection"
                }`
              );

              leagueResponse = await axios.get(leagueUrl, requestOptions);

              // If successful, save this combination
              successfulDomain = domain;
              successfulProxy = proxy;
              successfulUserAgent = userAgent;

              console.log(
                `Successfully fetched league ID ${leagueId} from ${domain}${
                  proxy.url ? " using proxy" : ""
                }`
              );
            } catch (error) {
              // Handle different error scenarios
              if (error.response && error.response.status === 451) {
                console.log(
                  `Domain ${domain} returned 451 error for league ${leagueId}.`
                );

                // Try next domain or proxy
                if (retryCount % 2 === 0) {
                  currentOnexBetDomainIndex =
                    (currentOnexBetDomainIndex + 1) % onexBetDomains.length;
                } else {
                  currentProxyIndex =
                    (currentProxyIndex + 1) % proxyOptions.length;
                }
              } else if (error.code === "ECONNABORTED") {
                console.error(`Request timed out for league ${leagueId}`);
                // On timeout, try a different proxy
                currentProxyIndex =
                  (currentProxyIndex + 1) % proxyOptions.length;
              } else {
                console.error(
                  `Error fetching league ID ${leagueId} from ${domain}: ${error.message}`
                );
                // For other errors, alternate between changing domains and proxies
                if (retryCount % 2 === 0) {
                  currentOnexBetDomainIndex =
                    (currentOnexBetDomainIndex + 1) % onexBetDomains.length;
                } else {
                  currentProxyIndex =
                    (currentProxyIndex + 1) % proxyOptions.length;
                }
              }

              // Always rotate user agent on error
              currentUserAgentIndex =
                (currentUserAgentIndex + 1) % userAgents.length;

              retryCount++;

              // Add delay between retries
              const delayMs = 1500 + retryCount * 500;
              await new Promise((resolve) => setTimeout(resolve, delayMs));
            }
          }

          if (!leagueResponse) {
            console.error(
              `Failed to fetch data for league ID: ${leagueId} after 5 attempts`
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
    console.error("Error in fetchMelbetMatches:", error.message);
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
