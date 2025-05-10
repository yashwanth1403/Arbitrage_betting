const axios = require("axios");

/**
 * Fetches match data from Mostbet API with pagination
 */
async function fetchMostbetData() {
  // Array to store all matches
  const allMatches = [];
  let offset = 0;

  console.log("Starting to fetch Mostbet match data...");

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

  try {
    // Continue fetching until no more matches are found
    while (true) {
      console.log(`Fetching matches with offset: ${offset}`);

      // Construct the API URL with the current offset
      const url = `https://mostbet-in62.com/api/v3/user/line/list?t[]=1&lc[]=1&um=12&ss=all&l=20&of=${offset}&ltr=0`;

      // Fetch data from the API
      const response = await axios.get(url, { headers });

      // Check if the request was successful and contains data
      if (!response.data || !response.data.lines_hierarchy) {
        console.log("No more data available or invalid response. Stopping.");
        break;
      }

      // Process the data and extract matches
      const matches = extractMatches(response.data);

      // Break the loop if no matches were found
      if (matches.length === 0) {
        console.log(
          `No matches found with offset ${offset}. Finished fetching.`
        );
        break;
      }

      // Add matches to the collection
      allMatches.push(...matches);
      console.log(
        `Found ${matches.length} matches. Total matches so far: ${allMatches.length}`
      );

      // Increase offset for the next request
      offset += 20;

      // Add a small delay to avoid overwhelming the server
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    // Save matches to JSON file
    console.log(`Total matches found: ${allMatches.length}`);
    console.log("Matches saved to mostbet_matches.json");
  } catch (error) {
    console.error("Error fetching data:", error.message);
    if (error.response) {
      console.error("Response status:", error.response.status);
      console.error(
        "Response data:",
        JSON.stringify(error.response.data, null, 2)
      );
    }
  }
}

/**
 * Extracts match information from the API response
 * @param {Object} data - The API response data
 * @returns {Array} - Array of extracted match information
 */
function extractMatches(data) {
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

// Execute the function
fetchMostbetData();
