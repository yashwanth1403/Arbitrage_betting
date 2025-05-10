const fs = require("fs");
const path = require("path");

/**
 * Match finder algorithm that identifies the same matches from two different sources
 * using team name similarity and date/time proximity
 */

// Similarity threshold (60%)
const SIMILARITY_THRESHOLD = 0.6;
// Maximum time difference in minutes
const MAX_TIME_DIFFERENCE_MINUTES = 5;

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
 * Main function to load data files and find matches
 */
async function main() {
  try {
    // Load match data from both sources
    console.log("Loading match data...");
    const mostbetData = JSON.parse(
      fs.readFileSync(path.join(__dirname, "mostbet_matches.json"), "utf8")
    );
    const melbetData = JSON.parse(
      fs.readFileSync(path.join(__dirname, "melbet_matches.json"), "utf8")
    );

    console.log(
      `Loaded ${mostbetData.length} Mostbet matches and ${melbetData.length} Melbet matches`
    );

    // Find matching matches
    console.log("Finding matching matches...");
    const matchingMatches = findMatchingMatches(mostbetData, melbetData);

    console.log(`Found ${matchingMatches.length} matching matches`);

    // Save results to file
    fs.writeFileSync(
      path.join(__dirname, "matching_matches.json"),
      JSON.stringify(matchingMatches, null, 2),
      "utf8"
    );

    console.log("Results saved to matching_matches.json");

    // Display a few examples
    if (matchingMatches.length > 0) {
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
    }
  } catch (error) {
    console.error("Error:", error.message);
  }
}

// Run the script
main();
