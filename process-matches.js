// Import required modules
const fs = require("fs");
const path = require("path");
const { fetch1xBetData } = require("./1xBet.js");
const { fetchMostBetData } = require("./mostbet.js");
const arbitrageFunctions = require("./arbitrage-functions.js");
const nodemailer = require("nodemailer");
const matchFinder = require("./matchFinder.js");
require("dotenv").config();

// Create the email transporter
let transporter = null;
if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
  transporter = nodemailer.createTransport({
    service: process.env.EMAIL_SERVICE || "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
  console.log("Email transporter configured successfully");
} else {
  console.log(
    "Email credentials not provided. Email notifications will be disabled."
  );
}

// Use the persistent data directory if available (for Railway deployment)
const dataDir = process.env.NODE_ENV === "production" ? "/data" : ".";

// Store arbitrage opportunities in memory
let allArbitrageOpportunities = [];

// Track the last time data was fetched
const lastDataFetch = {
  matchFinder: null,
  mostbet: null,
  melbet: null,
};

// Time threshold for data refresh (15 minutes in milliseconds)
const DATA_REFRESH_THRESHOLD = 15 * 60 * 1000; // 15 minutes

// Function to check if data needs to be refreshed
function isDataStale() {
  const now = Date.now();
  // If any of the data sources are null or older than threshold, data is stale
  return (
    !lastDataFetch.matchFinder ||
    !lastDataFetch.mostbet ||
    !lastDataFetch.melbet ||
    now - lastDataFetch.matchFinder > DATA_REFRESH_THRESHOLD ||
    now - lastDataFetch.mostbet > DATA_REFRESH_THRESHOLD ||
    now - lastDataFetch.melbet > DATA_REFRESH_THRESHOLD
  );
}

// Function to refresh all data
async function refreshAllData() {
  console.log(
    "Refreshing all data sources as they are more than 15 minutes old..."
  );

  try {
    // Run the match finder to refresh data
    await matchFinder.runMatchFinder();

    // Update last fetch timestamps
    const now = Date.now();
    lastDataFetch.matchFinder = now;
    lastDataFetch.mostbet = now;
    lastDataFetch.melbet = now;

    console.log("All data successfully refreshed");
    return true;
  } catch (error) {
    console.error("Error refreshing data:", error.message);
    return false;
  }
}

// Function to send email notifications when arbitrage opportunities are found
async function sendArbitrageEmail(opportunity) {
  if (!transporter) {
    console.log(
      "Email transporter not configured. Skipping email notification."
    );
    return false;
  }

  try {
    // Sort opportunities by profit percentage (highest first)
    const sortedOpportunities = [...opportunity.arbitrageOpportunities].sort(
      (a, b) => b.profitPercent - a.profitPercent
    );

    // Format all opportunities for the email
    const opportunitiesHtml = sortedOpportunities
      .map((opp, index) => {
        return `
        <div style="margin-bottom: 15px; padding: 10px; background-color: ${
          index === 0 ? "#f0f8ff" : "#f5f5f5"
        }; border-radius: 5px;">
          <h3>Opportunity ${index + 1}: ${opp.market}</h3>
          <p><strong>Profit Potential:</strong> ${opp.profitPercent.toFixed(
            2
          )}%</p>
          <p><strong>Odds:</strong> ${opp.odds
            .map((o) => o.toFixed(2))
            .join(", ")}</p>
          <p><strong>Bookmakers:</strong> ${opp.bookies.join(", ")}</p>
          <p><strong>Stake Distribution:</strong></p>
          <ul>
            ${opp.stakeDistribution
              .map(
                (stake, i) =>
                  `<li>${opp.bookies[i]}: ${stake.toFixed(
                    2
                  )}% of total stake</li>`
              )
              .join("")}
          </ul>
          <p><strong>Expected Return:</strong> ${opp.expectedReturn.toFixed(
            2
          )} (for 100 unit stake)</p>
        </div>
      `;
      })
      .join("");

    // Create HTML content for the email
    const htmlContent = `
      <h1>🔥 Arbitrage Opportunity Alert! 🔥</h1>
      <p>Profitable arbitrage opportunities have been detected:</p>
      
      <h2>Match Details:</h2>
      <p><strong>${opportunity.homeTeam} vs ${opportunity.awayTeam}</strong></p>
      <p><strong>Match IDs:</strong> Mostbet: ${
        opportunity.mostbetMatchId
      }, Melbet/1xBet: ${opportunity.melbet1xbetMatchId}</p>
      <p><strong>League:</strong> ${opportunity.league}</p>
      <p><strong>Match Date:</strong> ${new Date(
        opportunity.date
      ).toLocaleString()}</p>
      
      <h2>Arbitrage Opportunities (${
        opportunity.arbitrageOpportunities.length
      }):</h2>
      ${opportunitiesHtml}
      
      <p><strong>⚠️ Act quickly as odds may change rapidly!</strong></p>
      <p>Time Detected: ${new Date().toLocaleString()}</p>
    `;

    // Set up email data
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: [
        process.env.NOTIFICATION_EMAIL,
        "gangireddyharshavardhan30@gmail.com",
      ].join(","),
      subject: `Arbitrage Alert: ${opportunity.homeTeam} vs ${
        opportunity.awayTeam
      } (${sortedOpportunities[0].profitPercent.toFixed(2)}% profit)`,
      html: htmlContent,
    };

    // Send the email
    const info = await transporter.sendMail(mailOptions);
    console.log(`Email notification sent successfully: ${info.messageId}`);
    return true;
  } catch (error) {
    console.error(`Exception sending email notification: ${error.message}`);
    return false;
  }
}

// Main function to process all matching matches
async function processAllMatches() {
  try {
    console.log("Getting matching matches...");

    // Check if data is stale and needs refreshing
    if (isDataStale()) {
      console.log("Data is stale (older than 15 minutes). Refreshing...");
      await refreshAllData();
    } else {
      console.log(
        "Data is fresh (less than 15 minutes old). Proceeding with current data."
      );
    }

    // Check if we have matching matches in memory, if not, run the match finder
    let matchingMatches = matchFinder.getMatchingMatches();
    if (!matchingMatches || matchingMatches.length === 0) {
      console.log(
        "No matching matches found in memory, running match finder..."
      );
      matchingMatches = await matchFinder.runMatchFinder();

      // Update timestamp since we just fetched the data
      lastDataFetch.matchFinder = Date.now();
    }

    console.log(`Found ${matchingMatches.length} matching matches to process`);

    // Reset the array of arbitrage opportunities
    allArbitrageOpportunities = [];

    // Reduce log verbosity by logging only every 5th match in detail
    const logVerbose = matchingMatches.length <= 20;

    // Process each match
    for (let i = 0; i < matchingMatches.length; i++) {
      const match = matchingMatches[i];
      const matchNumber = i + 1;

      // Only log detailed info for the first match, every 5th match, or the last match when processing many matches
      const shouldLogDetailed =
        logVerbose ||
        matchNumber === 1 ||
        matchNumber % 5 === 0 ||
        matchNumber === matchingMatches.length;

      // Get the match IDs
      const mostbetMatchId = match.mostbet.match_id;
      const melbet1xbetMatchId = match.melbet.match_id;

      if (shouldLogDetailed) {
        console.log(
          `\n[${matchNumber}/${matchingMatches.length}] Processing match: ${match.mostbet.home_team} vs ${match.mostbet.away_team}`
        );
        console.log(
          `Mostbet ID: ${mostbetMatchId}, Melbet/1xBet ID: ${melbet1xbetMatchId}`
        );
      } else {
        // Simple progress indicator
        process.stdout.write(`.`);
        if (matchNumber % 50 === 0) process.stdout.write(`${matchNumber}\n`);
      }

      try {
        // Fetch odds data from both bookmakers
        if (shouldLogDetailed) console.log("Fetching odds from bookmakers...");
        const mostbetData = await fetchMostBetData(mostbetMatchId);
        const data1xbet = await fetch1xBetData(melbet1xbetMatchId);

        // Update timestamps for individual data sources
        lastDataFetch.mostbet = Date.now();
        lastDataFetch.melbet = Date.now();

        if (mostbetData.success && data1xbet.success) {
          if (shouldLogDetailed)
            console.log("Successfully fetched odds from both bookmakers");

          // Find arbitrage opportunities
          const arbitrageOpportunities = findArbitrageOpportunities(
            mostbetData,
            data1xbet
          );

          // If arbitrage opportunities were found, add them to the list
          if (arbitrageOpportunities.length > 0) {
            const matchWithArbitrage = {
              homeTeam: match.mostbet.home_team,
              awayTeam: match.mostbet.away_team,
              league: match.mostbet.league_name,
              date: match.mostbet.date,
              mostbetMatchId: mostbetMatchId,
              melbet1xbetMatchId: melbet1xbetMatchId,
              arbitrageOpportunities: arbitrageOpportunities,
              mostbetData: mostbetData,
              data1xbet: data1xbet,
            };

            allArbitrageOpportunities.push(matchWithArbitrage);
            console.log(
              `Found ${arbitrageOpportunities.length} arbitrage opportunities for match ${matchNumber}: ${match.mostbet.home_team} vs ${match.mostbet.away_team}`
            );

            // Send email notification about this opportunity
            await sendArbitrageEmail(matchWithArbitrage);
          } else if (shouldLogDetailed) {
            console.log("No arbitrage opportunities found for this match");
          }
        } else if (shouldLogDetailed) {
          console.log("Failed to fetch odds from one or both bookmakers");
        }
      } catch (error) {
        console.error(
          `Error processing match ${mostbetMatchId} vs ${melbet1xbetMatchId}:`,
          error.message
        );
      }

      // Add a small delay between requests to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    console.log("\n"); // Ensure we start on a new line after progress dots

    // Print summary
    console.log("\n=== ARBITRAGE OPPORTUNITIES SUMMARY ===");
    if (allArbitrageOpportunities.length > 0) {
      console.log(
        `Found arbitrage opportunities in ${allArbitrageOpportunities.length} matches out of ${matchingMatches.length}`
      );

      // Count total opportunities
      const totalOpportunities = allArbitrageOpportunities.reduce(
        (sum, match) => sum + match.arbitrageOpportunities.length,
        0
      );

      console.log(`Total arbitrage opportunities found: ${totalOpportunities}`);

      // Log the timestamp for reference instead of writing to file
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      console.log(`Arbitrage opportunities found at: ${timestamp}`);

      // Display top matches with most opportunities
      console.log("\nTop 5 matches with most arbitrage opportunities:");

      const sortedMatches = [...allArbitrageOpportunities].sort(
        (a, b) =>
          b.arbitrageOpportunities.length - a.arbitrageOpportunities.length
      );

      sortedMatches.slice(0, 5).forEach((match, index) => {
        console.log(
          `\n${index + 1}. ${match.homeTeam} vs ${match.awayTeam} (${
            match.league
          })`
        );
        console.log(`   Date: ${new Date(match.date).toLocaleString()}`);
        console.log(
          `   Number of opportunities: ${match.arbitrageOpportunities.length}`
        );

        // Show top opportunity from this match
        const topOpportunity = match.arbitrageOpportunities.sort(
          (a, b) => b.profitPercent - a.profitPercent
        )[0];

        console.log(
          `   Best opportunity: ${
            topOpportunity.market
          } - Profit: ${topOpportunity.profitPercent.toFixed(2)}%`
        );
      });
    } else {
      console.log("No arbitrage opportunities found in any of the matches");
    }

    return allArbitrageOpportunities;
  } catch (error) {
    console.error("Error processing matches:", error);
    return [];
  }
}

// Helper function to format arbitrage results
function formatArbitrageResult(market, bookies, odds, result) {
  if (!result.isArbitrage) return null;

  return {
    market,
    bookies,
    odds,
    profitPercent: result.profitPercent,
    totalStake: result.totalStake,
    stakeDistribution: result.stakeDistribution,
    expectedReturn: result.expectedReturn,
    expectedProfit: result.expectedProfit,
    condition: `Sum of implied probabilities: ${odds
      .map((odd) => (1 / odd).toFixed(4))
      .join(" + ")} = ${odds
      .reduce((sum, odd) => sum + 1 / odd, 0)
      .toFixed(4)} < 1`,
  };
}

// Function to find all arbitrage opportunities between two bookmakers
function findArbitrageOpportunities(dataMostbet, data1xbet) {
  // Store arbitrage opportunities for this match
  const arbitrageOpportunities = [];

  // 1. Check Match Result (1X2) for arbitrage
  try {
    if (dataMostbet.odds["1X2"] && data1xbet.odds["1X2"]) {
      const mostbet1X2 = dataMostbet.odds["1X2"];
      const oneXbet1X2 = data1xbet.odds["1X2"];

      // Find best odds for each outcome from either bookmaker
      const bestHome = Math.max(mostbet1X2.W1, oneXbet1X2.W1);
      const bestDraw = Math.max(mostbet1X2.X, oneXbet1X2.X);
      const bestAway = Math.max(mostbet1X2.W2, oneXbet1X2.W2);

      // Determine which bookmaker offers the best odds for each outcome
      const homeBookmaker =
        mostbet1X2.W1 >= oneXbet1X2.W1 ? "Mostbet" : "1xBet";
      const drawBookmaker = mostbet1X2.X >= oneXbet1X2.X ? "Mostbet" : "1xBet";
      const awayBookmaker =
        mostbet1X2.W2 >= oneXbet1X2.W2 ? "Mostbet" : "1xBet";

      // Check for arbitrage
      const result = arbitrageFunctions.arbitrageMatchResult(
        bestHome,
        bestDraw,
        bestAway
      );

      if (result.isArbitrage) {
        const opportunity = formatArbitrageResult(
          "Match Result (1X2)",
          [homeBookmaker, drawBookmaker, awayBookmaker],
          [bestHome, bestDraw, bestAway],
          result
        );

        arbitrageOpportunities.push(opportunity);
      }
    }
  } catch (error) {
    console.error("Error checking 1X2 arbitrage:", error.message);
  }

  // 2. Check Double Chance for arbitrage
  try {
    if (dataMostbet.odds["Double Chance"] && data1xbet.odds["Double Chance"]) {
      const mostbetDC = dataMostbet.odds["Double Chance"];
      const oneXbetDC = data1xbet.odds["Double Chance"];

      // Find best odds for each outcome from either bookmaker
      const best1X = Math.max(mostbetDC["1X"], oneXbetDC["1X"]);
      const bestX2 = Math.max(mostbetDC["X2"], oneXbetDC["X2"]);
      const best12 = Math.max(mostbetDC["12"], oneXbetDC["12"]);

      // Determine which bookmaker offers the best odds for each outcome
      const oneXBookmaker =
        mostbetDC["1X"] >= oneXbetDC["1X"] ? "Mostbet" : "1xBet";
      const x2Bookmaker =
        mostbetDC["X2"] >= oneXbetDC["X2"] ? "Mostbet" : "1xBet";
      const twelveBookmaker =
        mostbetDC["12"] >= oneXbetDC["12"] ? "Mostbet" : "1xBet";

      // Check for arbitrage
      const result = arbitrageFunctions.arbitrageDoubleChance(
        best1X,
        bestX2,
        best12
      );

      if (result.isArbitrage) {
        const opportunity = formatArbitrageResult(
          "Double Chance",
          [oneXBookmaker, x2Bookmaker, twelveBookmaker],
          [best1X, bestX2, best12],
          result
        );

        arbitrageOpportunities.push(opportunity);
      }
    }
  } catch (error) {
    console.error("Error checking Double Chance arbitrage:", error.message);
  }

  // 3. Check Over/Under Totals for arbitrage
  try {
    // Check main Total goals market
    if (dataMostbet.odds["Total"] && data1xbet.odds["Total"]) {
      const mostbetTotal = dataMostbet.odds["Total"];
      const oneXbetTotal = data1xbet.odds["Total"];

      // Collect all Over/Under lines from both bookmakers
      const totalLines = new Set();

      // Collect lines from Mostbet
      for (const key in mostbetTotal) {
        if (key.startsWith("Total Over") || key.startsWith("Total Under")) {
          const match = key.match(/\((\d+\.?\d*)\)/);
          if (match) {
            totalLines.add(match[1]);
          }
        }
      }

      // Collect lines from 1xBet
      for (const key in oneXbetTotal) {
        if (
          key.startsWith("Total Over") ||
          key.startsWith("Total Under") ||
          key.startsWith("Total Over (") ||
          key.startsWith("Total Under (")
        ) {
          const match = key.match(/\((\d+\.?\d*)\)/);
          if (match) {
            totalLines.add(match[1]);
          }
        }
      }

      // Check each line for arbitrage
      totalLines.forEach((line) => {
        // Skip the 0.5 line for Total goals

        // Check different key formats for 1xBet
        const mostbetOverKey = `Total Over (${line})`;
        const mostbetUnderKey = `Total Under (${line})`;

        // 1xBet may have different key formats
        let xbetOverKey = null;
        let xbetUnderKey = null;

        if (oneXbetTotal[`Total Over (${line})`]) {
          xbetOverKey = `Total Over (${line})`;
        } else if (oneXbetTotal[`Total Over ${line}`]) {
          xbetOverKey = `Total Over ${line}`;
        }

        if (oneXbetTotal[`Total Under (${line})`]) {
          xbetUnderKey = `Total Under (${line})`;
        } else if (oneXbetTotal[`Total Under ${line}`]) {
          xbetUnderKey = `Total Under ${line}`;
        }

        // Check if both bookmakers have this line
        if (
          mostbetTotal[mostbetOverKey] &&
          xbetOverKey &&
          oneXbetTotal[xbetOverKey] &&
          mostbetTotal[mostbetUnderKey] &&
          xbetUnderKey &&
          oneXbetTotal[xbetUnderKey]
        ) {
          // Find best odds for over and under
          const bestOver = Math.max(
            mostbetTotal[mostbetOverKey],
            oneXbetTotal[xbetOverKey]
          );
          const bestUnder = Math.max(
            mostbetTotal[mostbetUnderKey],
            oneXbetTotal[xbetUnderKey]
          );

          // Determine which bookmaker offers the best odds
          const overBookmaker =
            mostbetTotal[mostbetOverKey] >= oneXbetTotal[xbetOverKey]
              ? "Mostbet"
              : "1xBet";
          const underBookmaker =
            mostbetTotal[mostbetUnderKey] >= oneXbetTotal[xbetUnderKey]
              ? "Mostbet"
              : "1xBet";

          // Check for arbitrage
          const result = arbitrageFunctions.arbitrageOverUnder(
            bestOver,
            bestUnder
          );

          if (result.isArbitrage) {
            const opportunity = formatArbitrageResult(
              `Total Goals (${line})`,
              [overBookmaker, underBookmaker],
              [bestOver, bestUnder],
              result
            );

            arbitrageOpportunities.push(opportunity);
          }
        }
      });
    }

    // Check other over/under markets
    const marketTypes = [
      "Corners - Total",
      "Yellow Cards - Total",
      "Fouls - Total",
      "Offsides - Total",
      "Throw-ins - Total",
      "Home Team Total",
      "Away Team Total",
      "Corners - Home Team Total",
      "Corners - Away Team Total",
      "Yellow Cards - Home Team Total",
      "Yellow Cards - Away Team Total",
      "Fouls - Home Team Total",
      "Fouls - Away Team Total",
      "Throw-ins - Home Team Total",
      "Throw-ins - Away Team Total",
    ];

    marketTypes.forEach((marketType) => {
      if (dataMostbet.odds[marketType] && data1xbet.odds[marketType]) {
        const mostbetMarket = dataMostbet.odds[marketType];
        const oneXbetMarket = data1xbet.odds[marketType];

        // Look for common lines
        const lines = new Set();

        // Collect from Mostbet
        for (const key in mostbetMarket) {
          const match = key.match(/\((\d+\.?\d*)\)/);
          if (match) {
            lines.add(match[1]);
          }
        }

        // Collect from 1xBet
        for (const key in oneXbetMarket) {
          const match = key.match(/\((\d+\.?\d*)\)/);
          if (match) {
            lines.add(match[1]);
          }
        }

        // Check each line for arbitrage
        lines.forEach((line) => {
          const overKey = `Total Over (${line})`;
          const underKey = `Total Under (${line})`;

          // Check if both bookmakers have this line
          if (
            mostbetMarket[overKey] &&
            oneXbetMarket[overKey] &&
            mostbetMarket[underKey] &&
            oneXbetMarket[underKey]
          ) {
            // Find best odds
            const bestOver = Math.max(
              mostbetMarket[overKey],
              oneXbetMarket[overKey]
            );
            const bestUnder = Math.max(
              mostbetMarket[underKey],
              oneXbetMarket[underKey]
            );

            // Determine bookmaker
            const overBookmaker =
              mostbetMarket[overKey] >= oneXbetMarket[overKey]
                ? "Mostbet"
                : "1xBet";
            const underBookmaker =
              mostbetMarket[underKey] >= oneXbetMarket[underKey]
                ? "Mostbet"
                : "1xBet";

            // Check for arbitrage
            const result = arbitrageFunctions.arbitrageOverUnder(
              bestOver,
              bestUnder
            );

            if (result.isArbitrage) {
              const opportunity = formatArbitrageResult(
                marketType + ` (${line})`,
                [overBookmaker, underBookmaker],
                [bestOver, bestUnder],
                result
              );

              arbitrageOpportunities.push(opportunity);
            }
          }
        });
      }
    });
  } catch (error) {
    console.error("Error checking Over/Under arbitrage:", error.message);
  }

  // 4. Check Asian Handicap for arbitrage
  try {
    if (
      dataMostbet.odds["Asian Handicap"] &&
      data1xbet.odds["Asian Handicap"]
    ) {
      const mostbetAH = dataMostbet.odds["Asian Handicap"];
      const oneXbetAH = data1xbet.odds["Asian Handicap"];

      // Collect all possible team/handicap combinations
      const handicaps = new Map();

      // Process Mostbet handicaps
      for (const key in mostbetAH) {
        const match = key.match(/(.*) \(([-+]?\d+\.?\d*)\)/);
        if (match) {
          const team = match[1];
          const handicap = match[2];

          if (!handicaps.has(team)) {
            handicaps.set(team, new Set());
          }
          handicaps.get(team).add(handicap);
        }
      }

      // Process 1xBet handicaps (add to the same map)
      for (const key in oneXbetAH) {
        const match = key.match(/(.*) \(([-+]?\d+\.?\d*)\)/);
        if (match) {
          const team = match[1];
          const handicap = match[2];

          if (!handicaps.has(team)) {
            handicaps.set(team, new Set());
          }
          handicaps.get(team).add(handicap);
        }
      }

      // Get team names
      const homeTeam = dataMostbet.matchDetails.homeTeam;
      const awayTeam = dataMostbet.matchDetails.awayTeam;

      // Check matching handicaps for arbitrage
      handicaps.get(homeTeam)?.forEach((homeHandicap) => {
        handicaps.get(awayTeam)?.forEach((awayHandicap) => {
          // For Asian Handicap, we need opposing handicaps (e.g. -0.5 and +0.5)
          // The sum should be 0 for valid handicap pairs
          const homeValue = parseFloat(homeHandicap);
          const awayValue = parseFloat(awayHandicap);

          if (Math.abs(homeValue + awayValue) < 0.01) {
            // Account for floating point imprecision
            const homeKey = `${homeTeam} (${homeHandicap})`;
            const awayKey = `${awayTeam} (${awayHandicap})`;

            // Check if both bookmakers have these handicaps
            if (
              mostbetAH[homeKey] &&
              oneXbetAH[homeKey] &&
              mostbetAH[awayKey] &&
              oneXbetAH[awayKey]
            ) {
              // Find best odds
              const bestHomeOdds = Math.max(
                mostbetAH[homeKey],
                oneXbetAH[homeKey]
              );
              const bestAwayOdds = Math.max(
                mostbetAH[awayKey],
                oneXbetAH[awayKey]
              );

              // Determine bookmaker
              const homeBookmaker =
                mostbetAH[homeKey] >= oneXbetAH[homeKey] ? "Mostbet" : "1xBet";
              const awayBookmaker =
                mostbetAH[awayKey] >= oneXbetAH[awayKey] ? "Mostbet" : "1xBet";

              // Check for arbitrage
              const result = arbitrageFunctions.arbitrageOverUnder(
                bestHomeOdds,
                bestAwayOdds
              ); // Using OverUnder since it's also 2 outcomes

              if (result.isArbitrage) {
                const opportunity = formatArbitrageResult(
                  `Asian Handicap ${homeTeam} (${homeHandicap}) / ${awayTeam} (${awayHandicap})`,
                  [homeBookmaker, awayBookmaker],
                  [bestHomeOdds, bestAwayOdds],
                  result
                );

                arbitrageOpportunities.push(opportunity);
              }
            }
          }
        });
      });
    }
  } catch (error) {
    console.error("Error checking Asian Handicap arbitrage:", error.message);
  }

  // 5. Check other Handicap markets for arbitrage
  try {
    const handicapMarkets = [
      "Handicap",
      "Corners - Handicap",
      "Yellow Cards - Handicap",
      "Fouls - Handicap",
      "Offsides - Handicap",
      "Throw-ins - Handicap",
    ];

    handicapMarkets.forEach((marketType) => {
      if (dataMostbet.odds[marketType] && data1xbet.odds[marketType]) {
        const mostbetHandicap = dataMostbet.odds[marketType];
        const oneXbetHandicap = data1xbet.odds[marketType];

        // Get all teams from both bookmakers
        const teams = new Set();

        // Collect team names from Mostbet
        for (const key in mostbetHandicap) {
          const match = key.match(/(.*) \([+-]?\d+\.?\d*\)/);
          if (match) {
            teams.add(match[1]);
          }
        }

        // Collect team names from 1xBet
        for (const key in oneXbetHandicap) {
          const match = key.match(/(.*) \([+-]?\d+\.?\d*\)/);
          if (match) {
            teams.add(match[1]);
          }
        }

        // For each team, check all handicaps
        teams.forEach((team) => {
          // Get all handicaps for this team
          const handicaps = new Set();

          // Collect handicaps from Mostbet
          for (const key in mostbetHandicap) {
            if (key.startsWith(team)) {
              const match = key.match(/\(([-+]?\d+\.?\d*)\)/);
              if (match) {
                handicaps.add(match[1]);
              }
            }
          }

          // Collect handicaps from 1xBet
          for (const key in oneXbetHandicap) {
            if (key.startsWith(team)) {
              const match = key.match(/\(([-+]?\d+\.?\d*)\)/);
              if (match) {
                handicaps.add(match[1]);
              }
            }
          }

          // Check each handicap for arbitrage
          handicaps.forEach((handicap) => {
            const teamHandicapKey = `${team} (${handicap})`;

            if (
              mostbetHandicap[teamHandicapKey] &&
              oneXbetHandicap[teamHandicapKey]
            ) {
              // Find best odds
              const bestOdds = Math.max(
                mostbetHandicap[teamHandicapKey],
                oneXbetHandicap[teamHandicapKey]
              );

              // Determine which bookmaker offers the best odds
              const bookmaker =
                mostbetHandicap[teamHandicapKey] >=
                oneXbetHandicap[teamHandicapKey]
                  ? "Mostbet"
                  : "1xBet";

              // Look for opposing handicap (the negative value)
              const opposingValue = (-parseFloat(handicap)).toString();

              // Find opposing team - simple logic for two-team sports
              const opposingTeam =
                team === dataMostbet.matchDetails.homeTeam
                  ? dataMostbet.matchDetails.awayTeam
                  : dataMostbet.matchDetails.homeTeam;

              const opposingKey = `${opposingTeam} (${opposingValue})`;

              if (
                mostbetHandicap[opposingKey] &&
                oneXbetHandicap[opposingKey]
              ) {
                // Find best opposing odds
                const bestOpposingOdds = Math.max(
                  mostbetHandicap[opposingKey],
                  oneXbetHandicap[opposingKey]
                );

                // Determine which bookmaker offers the best opposing odds
                const opposingBookmaker =
                  mostbetHandicap[opposingKey] >= oneXbetHandicap[opposingKey]
                    ? "Mostbet"
                    : "1xBet";

                // Check for arbitrage
                const result = arbitrageFunctions.arbitrageOverUnder(
                  bestOdds,
                  bestOpposingOdds
                );

                if (result.isArbitrage) {
                  const opportunity = formatArbitrageResult(
                    `${marketType} ${team} (${handicap}) / ${opposingTeam} (${opposingValue})`,
                    [bookmaker, opposingBookmaker],
                    [bestOdds, bestOpposingOdds],
                    result
                  );

                  arbitrageOpportunities.push(opportunity);
                }
              }
            }
          });
        });
      }
    });
  } catch (error) {
    console.error(`Error checking handicap markets arbitrage:`, error.message);
  }

  // 6. Check 1X2 markets for arbitrage
  try {
    const markets1X2 = [
      "1X2",
      "Corners - 1X2",
      "Yellow Cards - 1X2",
      "Fouls - 1X2",
      "Offsides - 1X2",
      "Throw-ins - 1X2",
    ];

    markets1X2.forEach((marketType) => {
      if (marketType === "1X2") return; // Skip main 1X2 which is already checked

      if (dataMostbet.odds[marketType] && data1xbet.odds[marketType]) {
        const mostbet1X2 = dataMostbet.odds[marketType];
        const oneXbet1X2 = data1xbet.odds[marketType];

        // Find best odds for each outcome from either bookmaker
        const bestHome = Math.max(mostbet1X2.W1 || 0, oneXbet1X2.W1 || 0);
        const bestDraw = Math.max(mostbet1X2.X || 0, oneXbet1X2.X || 0);
        const bestAway = Math.max(mostbet1X2.W2 || 0, oneXbet1X2.W2 || 0);

        // Check if both bookmakers have this market
        if (bestHome > 0 && bestDraw > 0 && bestAway > 0) {
          // Determine which bookmaker offers the best odds for each outcome
          const homeBookmaker =
            (mostbet1X2.W1 || 0) >= (oneXbet1X2.W1 || 0) ? "Mostbet" : "1xBet";
          const drawBookmaker =
            (mostbet1X2.X || 0) >= (oneXbet1X2.X || 0) ? "Mostbet" : "1xBet";
          const awayBookmaker =
            (mostbet1X2.W2 || 0) >= (oneXbet1X2.W2 || 0) ? "Mostbet" : "1xBet";

          // Check for arbitrage
          const result = arbitrageFunctions.arbitrageMatchResult(
            bestHome,
            bestDraw,
            bestAway
          );

          if (result.isArbitrage) {
            const opportunity = formatArbitrageResult(
              marketType,
              [homeBookmaker, drawBookmaker, awayBookmaker],
              [bestHome, bestDraw, bestAway],
              result
            );

            arbitrageOpportunities.push(opportunity);
          }
        }
      }
    });
  } catch (error) {
    console.error(`Error checking 1X2 markets arbitrage:`, error.message);
  }

  return arbitrageOpportunities;
}

// Export the functions and data for use in other modules
module.exports = {
  processAllMatches,
  getArbitrageOpportunities: () => allArbitrageOpportunities,
  findArbitrageOpportunities,
  getLastDataFetch: () => ({ ...lastDataFetch }),
  refreshAllData,
};

// Execute the main function if this file is run directly
if (require.main === module) {
  processAllMatches();
}
