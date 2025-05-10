// Import required modules
const fs = require("fs");
const path = require("path");

// Import the bookmaker functions
const { fetch1xBetData } = require("./1xBet.js");
const { fetchMostBetData } = require("./mostbet.js");

// Import arbitrage functions directly from the file
const arbitrageFunctions = require("./arbitrage-functions.js");

// Load all the matching matches
const matchingMatches = require("./matching_matches.json");

// Helper function to format arbitrage result
function formatArbitrageResult(market, bookies, odds, result) {
  if (!result.isArbitrage) return null;

  const impliedProbabilities = odds.map((odd) => (1 / odd).toFixed(4));
  const sumProbabilities = odds
    .reduce((sum, odd) => sum + 1 / odd, 0)
    .toFixed(4);

  return {
    market,
    bookies,
    odds,
    profitPercent: result.profitPercent,
    totalStake: result.totalStake,
    stakeDistribution: result.stakeDistribution,
    expectedReturn: result.expectedReturn,
    expectedProfit: result.expectedProfit,
    condition: `Arbitrage condition met: Sum of implied probabilities ${impliedProbabilities.join(
      " + "
    )} = ${sumProbabilities} < 1`,
  };
}

/**
 * Find arbitrage opportunities between bookmakers for a specific match
 * @param {Object} matchData - The match data containing IDs for both bookmakers
 * @returns {Promise<Object>} - Object containing arbitrage opportunities and match details
 */
async function findArbitrageForMatch(matchData) {
  try {
    const mostbetMatchId = matchData.mostbet.match_id;
    const melBetMatchId = matchData.melbet.match_id;

    console.log(
      `\nAnalyzing match: ${matchData.mostbet.home_team} vs ${matchData.mostbet.away_team}`
    );
    console.log(`Mostbet ID: ${mostbetMatchId}, MelBet ID: ${melBetMatchId}`);

    // Fetch odds from both bookmakers in parallel
    const [dataMostbet, dataMelBet] = await Promise.all([
      fetchMostBetData(mostbetMatchId),
      fetch1xBetData(melBetMatchId),
    ]);

    // If either API call failed, skip this match
    if (!dataMostbet.success || !dataMelBet.success) {
      console.log("Failed to fetch odds for this match, skipping.");
      return {
        success: false,
        error: "Failed to fetch odds for this match",
        matchDetails: {
          homeTeam: matchData.mostbet.home_team,
          awayTeam: matchData.mostbet.away_team,
          league: matchData.mostbet.league_name,
          bookmakerIds: {
            Mostbet: mostbetMatchId,
            MelBet: melBetMatchId,
          },
        },
      };
    }

    // Store all arbitrage opportunities
    const arbitrageOpportunities = [];

    // 1. Check Match Result (1X2) for arbitrage
    if (dataMostbet.odds["1X2"] && dataMelBet.odds["1X2"]) {
      const mostbet1X2 = dataMostbet.odds["1X2"];
      const melBet1X2 = dataMelBet.odds["1X2"];

      // Find best odds for each outcome
      const bestHome = Math.max(mostbet1X2.W1, melBet1X2.W1);
      const bestDraw = Math.max(mostbet1X2.X, melBet1X2.X);
      const bestAway = Math.max(mostbet1X2.W2, melBet1X2.W2);

      // Determine which bookmaker offers the best odds
      const homeBookmaker =
        mostbet1X2.W1 >= melBet1X2.W1 ? "Mostbet" : "MelBet";
      const drawBookmaker = mostbet1X2.X >= melBet1X2.X ? "Mostbet" : "MelBet";
      const awayBookmaker =
        mostbet1X2.W2 >= melBet1X2.W2 ? "Mostbet" : "MelBet";

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
        console.log(
          `Found 1X2 arbitrage with profit: ${result.profitPercent}% - Home (${bestHome}) at ${homeBookmaker}, Draw (${bestDraw}) at ${drawBookmaker}, Away (${bestAway}) at ${awayBookmaker}`
        );
      }
    }

    // 2. Check Double Chance for arbitrage
    if (dataMostbet.odds["Double Chance"] && dataMelBet.odds["Double Chance"]) {
      const mostbetDC = dataMostbet.odds["Double Chance"];
      const melBetDC = dataMelBet.odds["Double Chance"];

      const best1X = Math.max(mostbetDC["1X"], melBetDC["1X"]);
      const bestX2 = Math.max(mostbetDC["X2"], melBetDC["X2"]);
      const best12 = Math.max(mostbetDC["12"], melBetDC["12"]);

      const oneXBookmaker =
        mostbetDC["1X"] >= melBetDC["1X"] ? "Mostbet" : "MelBet";
      const x2Bookmaker =
        mostbetDC["X2"] >= melBetDC["X2"] ? "Mostbet" : "MelBet";
      const twelveBookmaker =
        mostbetDC["12"] >= melBetDC["12"] ? "Mostbet" : "MelBet";

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
        console.log(
          `Found Double Chance arbitrage with profit: ${result.profitPercent}% - 1X (${best1X}) at ${oneXBookmaker}, X2 (${bestX2}) at ${x2Bookmaker}, 12 (${best12}) at ${twelveBookmaker}`
        );
      }
    }

    // 3. Check Over/Under markets for arbitrage
    const markets = [
      "Total",
      "Corners - Total",
      "Yellow Cards - Total",
      "Fouls - Total",
      "Home Team Total",
      "Away Team Total",
      "Asian Total",
      "Corners - Home Team Total",
      "Corners - Away Team Total",
      "Yellow Cards - Home Team Total",
      "Yellow Cards - Away Team Total",
      "Offsides - Total",
      "Offsides - Home Team Total",
      "Offsides - Away Team Total",
      "Throw-ins - Total",
      "Throw-ins - Home Team Total",
      "Throw-ins - Away Team Total",
    ];

    for (const market of markets) {
      if (dataMostbet.odds[market] && dataMelBet.odds[market]) {
        const mostbetMarket = dataMostbet.odds[market];
        const melBetMarket = dataMelBet.odds[market];

        // Find common lines between bookmakers
        const lines = new Set();
        for (const key in mostbetMarket) {
          // Handle both "Total Over/Under" format and "Over/Under" format (used in team totals)
          if (
            key.startsWith("Total Over") ||
            key.startsWith("Total Under") ||
            key.startsWith("Over") ||
            key.startsWith("Under")
          ) {
            const match = key.match(/\((\d+\.?\d*)\)/);
            if (match) lines.add(match[1]);
          }
        }

        for (const key in melBetMarket) {
          // Handle both "Total Over/Under" format and "Over/Under" format (used in team totals)
          if (
            key.startsWith("Total Over") ||
            key.startsWith("Total Under") ||
            key.startsWith("Over") ||
            key.startsWith("Under")
          ) {
            const match = key.match(/\((\d+\.?\d*)\)/);
            if (match) lines.add(match[1]);
          }
        }

        for (const line of lines) {
          // Determine the correct key format based on market type
          let overKey1, underKey1, overKey2, underKey2;

          if (
            market === "Home Team Total" ||
            market === "Away Team Total" ||
            market.includes("Yellow Cards") ||
            market.includes("Cards") ||
            market.includes("- Home Team") ||
            market.includes("- Away Team")
          ) {
            // Format 1: "Over (2.5)" format
            overKey1 = `Over (${line})`;
            underKey1 = `Under (${line})`;

            // Format 2: "Total Over (2.5)" format
            overKey2 = `Total Over (${line})`;
            underKey2 = `Total Under (${line})`;
          } else {
            // Primary format: "Total Over (2.5)"
            overKey1 = `Total Over (${line})`;
            underKey1 = `Total Under (${line})`;

            // Alternative format: "Over (2.5)"
            overKey2 = `Over (${line})`;
            underKey2 = `Under (${line})`;
          }

          // Check for odds in the first bookmaker (Mostbet)
          const mostbetOverOdd =
            mostbetMarket[overKey1] || mostbetMarket[overKey2] || 0;
          const mostbetUnderOdd =
            mostbetMarket[underKey1] || mostbetMarket[underKey2] || 0;

          // Check for odds in the second bookmaker (MelBet)
          const melBetOverOdd =
            melBetMarket[overKey1] || melBetMarket[overKey2] || 0;
          const melBetUnderOdd =
            melBetMarket[underKey1] || melBetMarket[underKey2] || 0;

          // Skip if either bookmaker doesn't have both over and under odds
          if (
            (mostbetOverOdd === 0 || mostbetUnderOdd === 0) &&
            (melBetOverOdd === 0 || melBetUnderOdd === 0)
          ) {
            continue;
          }

          // Find best odds for each outcome
          const bestOver = Math.max(mostbetOverOdd, melBetOverOdd);
          const bestUnder = Math.max(mostbetUnderOdd, melBetUnderOdd);

          // Skip if either best odd is 0
          if (bestOver === 0 || bestUnder === 0) continue;

          // Determine which bookmaker offers the best odds
          const overBookmaker =
            mostbetOverOdd >= melBetOverOdd && mostbetOverOdd > 0
              ? "Mostbet"
              : "MelBet";
          const underBookmaker =
            mostbetUnderOdd >= melBetUnderOdd && mostbetUnderOdd > 0
              ? "Mostbet"
              : "MelBet";

          const result = arbitrageFunctions.arbitrageOverUnder(
            bestOver,
            bestUnder
          );

          if (result.isArbitrage) {
            const opportunity = formatArbitrageResult(
              `${market} (${line})`,
              [overBookmaker, underBookmaker],
              [bestOver, bestUnder],
              result
            );
            arbitrageOpportunities.push(opportunity);
            console.log(
              `Found ${market} (${line}) arbitrage with profit: ${result.profitPercent}% - Over (${bestOver}) at ${overBookmaker}, Under (${bestUnder}) at ${underBookmaker}`
            );
          }
        }
      }
    }

    // 4. Check Asian Handicap for arbitrage
    if (
      dataMostbet.odds["Asian Handicap"] &&
      dataMelBet.odds["Asian Handicap"]
    ) {
      const mostbetAH = dataMostbet.odds["Asian Handicap"];
      const melBetAH = dataMelBet.odds["Asian Handicap"];

      // Get all handicap values
      const handicaps = new Map();
      for (const key in mostbetAH) {
        const match = key.match(/(.*) \(([-+]?\d+\.?\d*)\)/);
        if (match) {
          const team = match[1];
          const handicap = match[2];
          if (!handicaps.has(team)) handicaps.set(team, new Set());
          handicaps.get(team).add(handicap);
        }
      }

      // Check matching handicaps
      for (const [team, values] of handicaps.entries()) {
        for (const handicap of values) {
          const oppositeHandicap = parseFloat(handicap) * -1;
          const oppositeTeam =
            team === dataMostbet.matchDetails.homeTeam
              ? dataMostbet.matchDetails.awayTeam
              : dataMostbet.matchDetails.homeTeam;

          const key1 = `${team} (${handicap})`;
          const key2 = `${oppositeTeam} (${oppositeHandicap})`;

          if (
            mostbetAH[key1] &&
            melBetAH[key1] &&
            mostbetAH[key2] &&
            melBetAH[key2]
          ) {
            const bestOdds1 = Math.max(mostbetAH[key1], melBetAH[key1]);
            const bestOdds2 = Math.max(mostbetAH[key2], melBetAH[key2]);

            const bookmaker1 =
              mostbetAH[key1] >= melBetAH[key1] ? "Mostbet" : "MelBet";
            const bookmaker2 =
              mostbetAH[key2] >= melBetAH[key2] ? "Mostbet" : "MelBet";

            const result = arbitrageFunctions.arbitrageOverUnder(
              bestOdds1,
              bestOdds2
            );

            if (result.isArbitrage) {
              const opportunity = formatArbitrageResult(
                `Asian Handicap ${key1} vs ${key2}`,
                [bookmaker1, bookmaker2],
                [bestOdds1, bestOdds2],
                result
              );
              arbitrageOpportunities.push(opportunity);
              console.log(
                `Found Asian Handicap arbitrage with profit: ${result.profitPercent}% - ${key1} (${bestOdds1}) at ${bookmaker1}, ${key2} (${bestOdds2}) at ${bookmaker2}`
              );
            }
          }
        }
      }
    }

    // 5. Check Both Teams To Score for arbitrage
    if (
      dataMostbet.odds["Both Teams To Score"] &&
      dataMelBet.odds["Both Teams To Score"]
    ) {
      const mostbetBTTS = dataMostbet.odds["Both Teams To Score"];
      const melBetBTTS = dataMelBet.odds["Both Teams To Score"];

      if (
        mostbetBTTS["Yes"] &&
        melBetBTTS["Yes"] &&
        mostbetBTTS["No"] &&
        melBetBTTS["No"]
      ) {
        const bestYes = Math.max(mostbetBTTS["Yes"], melBetBTTS["Yes"]);
        const bestNo = Math.max(mostbetBTTS["No"], melBetBTTS["No"]);

        const yesBookmaker =
          mostbetBTTS["Yes"] >= melBetBTTS["Yes"] ? "Mostbet" : "MelBet";
        const noBookmaker =
          mostbetBTTS["No"] >= melBetBTTS["No"] ? "Mostbet" : "MelBet";

        const result = arbitrageFunctions.arbitrageBTTS(bestYes, bestNo);

        if (result.isArbitrage) {
          const opportunity = formatArbitrageResult(
            "Both Teams To Score",
            [yesBookmaker, noBookmaker],
            [bestYes, bestNo],
            result
          );
          arbitrageOpportunities.push(opportunity);
          console.log(
            `Found BTTS arbitrage with profit: ${result.profitPercent}% - Yes (${bestYes}) at ${yesBookmaker}, No (${bestNo}) at ${noBookmaker}`
          );
        }
      }
    }

    // 6. Check Draw No Bet for arbitrage
    if (dataMostbet.odds["Draw No Bet"] && dataMelBet.odds["Draw No Bet"]) {
      const mostbetDNB = dataMostbet.odds["Draw No Bet"];
      const melBetDNB = dataMelBet.odds["Draw No Bet"];

      // Assuming W1 and W2 are the keys used for home and away team
      if (
        mostbetDNB["W1"] &&
        melBetDNB["W1"] &&
        mostbetDNB["W2"] &&
        melBetDNB["W2"]
      ) {
        const bestHome = Math.max(mostbetDNB["W1"], melBetDNB["W1"]);
        const bestAway = Math.max(mostbetDNB["W2"], melBetDNB["W2"]);

        const homeBookmaker =
          mostbetDNB["W1"] >= melBetDNB["W1"] ? "Mostbet" : "MelBet";
        const awayBookmaker =
          mostbetDNB["W2"] >= melBetDNB["W2"] ? "Mostbet" : "MelBet";

        const result = arbitrageFunctions.arbitrageDrawNoBet(
          bestHome,
          bestAway
        );

        if (result.isArbitrage) {
          const opportunity = formatArbitrageResult(
            "Draw No Bet",
            [homeBookmaker, awayBookmaker],
            [bestHome, bestAway],
            result
          );
          arbitrageOpportunities.push(opportunity);
          console.log(
            `Found Draw No Bet arbitrage with profit: ${result.profitPercent}% - Home (${bestHome}) at ${homeBookmaker}, Away (${bestAway}) at ${awayBookmaker}`
          );
        }
      }
    }

    // 7. Check additional 1X2 markets for arbitrage
    const markets1X2 = [
      "Corners - 1X2",
      "Yellow Cards - 1X2",
      "Fouls - 1X2",
      "Offsides - 1X2",
      "Throw-ins - 1X2",
    ];

    for (const market of markets1X2) {
      if (dataMostbet.odds[market] && dataMelBet.odds[market]) {
        const mostbet1X2 = dataMostbet.odds[market];
        const melBet1X2 = dataMelBet.odds[market];

        // Find best odds for each outcome
        const bestHome = Math.max(mostbet1X2.W1, melBet1X2.W1);
        const bestDraw = Math.max(mostbet1X2.X, melBet1X2.X);
        const bestAway = Math.max(mostbet1X2.W2, melBet1X2.W2);

        // Determine which bookmaker offers the best odds
        const homeBookmaker =
          mostbet1X2.W1 >= melBet1X2.W1 ? "Mostbet" : "MelBet";
        const drawBookmaker =
          mostbet1X2.X >= melBet1X2.X ? "Mostbet" : "MelBet";
        const awayBookmaker =
          mostbet1X2.W2 >= melBet1X2.W2 ? "Mostbet" : "MelBet";

        const result = arbitrageFunctions.arbitrageMatchResult(
          bestHome,
          bestDraw,
          bestAway
        );

        if (result.isArbitrage) {
          const opportunity = formatArbitrageResult(
            market,
            [homeBookmaker, drawBookmaker, awayBookmaker],
            [bestHome, bestDraw, bestAway],
            result
          );
          arbitrageOpportunities.push(opportunity);
          console.log(
            `Found ${market} arbitrage with profit: ${result.profitPercent}% - Home (${bestHome}) at ${homeBookmaker}, Draw (${bestDraw}) at ${drawBookmaker}, Away (${bestAway}) at ${awayBookmaker}`
          );
        }
      }
    }

    // 8. Check additional handicap markets for arbitrage
    const handicapMarkets = [
      "Corners - Handicap",
      "Yellow Cards - Handicap",
      "Fouls - Handicap",
      "Offsides - Handicap",
      "Throw-ins - Handicap",
      "Handicap",
    ];

    for (const market of handicapMarkets) {
      if (dataMostbet.odds[market] && dataMelBet.odds[market]) {
        const mostbetHandicap = dataMostbet.odds[market];
        const melBetHandicap = dataMelBet.odds[market];

        // Find all unique teams/players in the handicap market
        const allTeams = new Set([
          ...Object.keys(mostbetHandicap).map((key) => key.split(" (")[0]),
          ...Object.keys(melBetHandicap).map((key) => key.split(" (")[0]),
        ]);

        // Find all unique handicap values
        const allHandicaps = new Set();
        [
          ...Object.keys(mostbetHandicap),
          ...Object.keys(melBetHandicap),
        ].forEach((key) => {
          const handicapMatch = key.match(/\(([-+]?\d+\.?\d*)\)/);
          if (handicapMatch) allHandicaps.add(handicapMatch[1]);
        });

        // Check for arbitrage opportunities between opposing handicaps
        for (const team of allTeams) {
          for (const handicap of allHandicaps) {
            // Find the opposing team
            let opposingTeam = "";
            for (const otherTeam of allTeams) {
              if (otherTeam !== team) {
                opposingTeam = otherTeam;
                break;
              }
            }

            if (!opposingTeam) continue;

            // Calculate opposite handicap value
            const oppositeHandicap = (parseFloat(handicap) * -1).toString();

            // Form the keys for both teams
            const key1 = `${team} (${handicap})`;
            const key2 = `${opposingTeam} (${oppositeHandicap})`;

            // Check if both keys exist in either bookmaker
            if (
              (mostbetHandicap[key1] || melBetHandicap[key1]) &&
              (mostbetHandicap[key2] || melBetHandicap[key2])
            ) {
              // Find best odds for each outcome
              const bestOdds1 = Math.max(
                mostbetHandicap[key1] || 0,
                melBetHandicap[key1] || 0
              );
              const bestOdds2 = Math.max(
                mostbetHandicap[key2] || 0,
                melBetHandicap[key2] || 0
              );

              // Skip if either odds is 0 (not available)
              if (bestOdds1 === 0 || bestOdds2 === 0) continue;

              // Determine which bookmaker offers the best odds
              const bookmaker1 =
                (mostbetHandicap[key1] || 0) >= (melBetHandicap[key1] || 0)
                  ? "Mostbet"
                  : "MelBet";
              const bookmaker2 =
                (mostbetHandicap[key2] || 0) >= (melBetHandicap[key2] || 0)
                  ? "Mostbet"
                  : "MelBet";

              const result = arbitrageFunctions.arbitrageOverUnder(
                bestOdds1,
                bestOdds2
              );

              if (result.isArbitrage) {
                const opportunity = formatArbitrageResult(
                  `${market}: ${key1} vs ${key2}`,
                  [bookmaker1, bookmaker2],
                  [bestOdds1, bestOdds2],
                  result
                );
                arbitrageOpportunities.push(opportunity);
                console.log(
                  `Found ${market} arbitrage with profit: ${result.profitPercent}% - ${key1} (${bestOdds1}) at ${bookmaker1}, ${key2} (${bestOdds2}) at ${bookmaker2}`
                );
              }
            }
          }
        }
      }
    }

    // 9. Check First/Last Event markets for arbitrage
    const firstLastMarkets = [
      "First Corner",
      "Last Corner",
      "First Yellow Card",
      "Last Yellow Card",
      "First Goal",
      "Last Goal",
    ];

    for (const market of firstLastMarkets) {
      if (dataMostbet.odds[market] && dataMelBet.odds[market]) {
        const mostbetEvent = dataMostbet.odds[market];
        const melBetEvent = dataMelBet.odds[market];

        // Check if we have odds for Team 1, Team 2, and No Event/No Goal
        if (
          (mostbetEvent["Team 1"] || melBetEvent["Team 1"]) &&
          (mostbetEvent["Team 2"] || melBetEvent["Team 2"]) &&
          (mostbetEvent["No Event"] ||
            mostbetEvent["No Goal"] ||
            melBetEvent["No Event"] ||
            melBetEvent["No Goal"])
        ) {
          // Find best odds for each outcome
          const bestTeam1 = Math.max(
            mostbetEvent["Team 1"] || 0,
            melBetEvent["Team 1"] || 0
          );
          const bestTeam2 = Math.max(
            mostbetEvent["Team 2"] || 0,
            melBetEvent["Team 2"] || 0
          );

          // For No Event/No Goal, check both possible naming conventions
          const mostbetNoEvent =
            mostbetEvent["No Event"] || mostbetEvent["No Goal"] || 0;
          const melBetNoEvent =
            melBetEvent["No Event"] || melBetEvent["No Goal"] || 0;
          const bestNoEvent = Math.max(mostbetNoEvent, melBetNoEvent);

          // Skip if any of the odds are missing
          if (bestTeam1 === 0 || bestTeam2 === 0 || bestNoEvent === 0) continue;

          // Determine which bookmaker offers the best odds
          const team1Bookmaker =
            (mostbetEvent["Team 1"] || 0) >= (melBetEvent["Team 1"] || 0)
              ? "Mostbet"
              : "MelBet";
          const team2Bookmaker =
            (mostbetEvent["Team 2"] || 0) >= (melBetEvent["Team 2"] || 0)
              ? "Mostbet"
              : "MelBet";
          const noEventBookmaker =
            mostbetNoEvent >= melBetNoEvent ? "Mostbet" : "MelBet";

          const result = arbitrageFunctions.arbitrageFirstLast(
            bestTeam1,
            bestTeam2,
            bestNoEvent
          );

          if (result.isArbitrage) {
            const opportunity = formatArbitrageResult(
              market,
              [team1Bookmaker, team2Bookmaker, noEventBookmaker],
              [bestTeam1, bestTeam2, bestNoEvent],
              result
            );
            arbitrageOpportunities.push(opportunity);
            console.log(
              `Found ${market} arbitrage with profit: ${result.profitPercent}% - Team 1 (${bestTeam1}) at ${team1Bookmaker}, Team 2 (${bestTeam2}) at ${team2Bookmaker}, No Event (${bestNoEvent}) at ${noEventBookmaker}`
            );
          }
        }
      }
    }

    // Prepare the final result
    const matchResult = {
      success: true,
      matchDetails: {
        homeTeam: matchData.mostbet.home_team,
        awayTeam: matchData.mostbet.away_team,
        league: matchData.mostbet.league_name,
        matchTime: new Date(
          matchData.mostbet.timestamp * 1000
        ).toLocaleString(),
        bookmakerIds: {
          Mostbet: mostbetMatchId,
          MelBet: melBetMatchId,
        },
      },
      arbitrageOpportunities: arbitrageOpportunities.sort(
        (a, b) => b.profitPercent - a.profitPercent
      ),
    };

    return matchResult;
  } catch (error) {
    console.error(`Error finding arbitrage for match: ${error.message}`);
    return {
      success: false,
      error: error.message,
      matchDetails: {
        homeTeam: matchData.mostbet.home_team,
        awayTeam: matchData.mostbet.away_team,
        league: matchData.mostbet.league_name,
        bookmakerIds: {
          Mostbet: matchData.mostbet.match_id,
          MelBet: matchData.melbet.match_id,
        },
      },
    };
  }
}

/**
 * Process all matches and find arbitrage opportunities
 * @param {number} limit - Maximum number of matches to process (optional)
 * @returns {Promise<void>}
 */
async function findArbitrageForAllMatches(limit = null) {
  try {
    console.log(`Starting analysis of ${limit ? limit : "all"} matches...`);

    // Limit the number of matches if specified
    const matchesToProcess = limit
      ? matchingMatches.slice(0, limit)
      : matchingMatches;

    const allResults = [];
    const profitable = [];

    // Process each match one by one to avoid overloading APIs
    for (let i = 0; i < matchesToProcess.length; i++) {
      console.log(`\nProcessing match ${i + 1}/${matchesToProcess.length}`);
      const matchData = matchesToProcess[i];

      const result = await findArbitrageForMatch(matchData);
      allResults.push(result);

      // If arbitrage opportunities found, add to profitable list
      if (result.success && result.arbitrageOpportunities.length > 0) {
        profitable.push(result);
        console.log(
          `Found ${result.arbitrageOpportunities.length} arbitrage opportunities for this match!`
        );
      } else {
        console.log("No arbitrage opportunities found for this match.");
      }
    }

    // Save all results to a file
    const timestamp = new Date().toISOString().replace(/:/g, "-");
    const allResultsFile = `all-arbitrage-results-${timestamp}.json`;
    fs.writeFileSync(allResultsFile, JSON.stringify(allResults, null, 2));
    console.log(`\nAll analysis results saved to ${allResultsFile}`);

    // Save profitable results to a separate file
    if (profitable.length > 0) {
      const profitableFile = `profitable-arbitrage-${timestamp}.json`;
      fs.writeFileSync(profitableFile, JSON.stringify(profitable, null, 2));
      console.log(
        `Found arbitrage opportunities in ${profitable.length} matches out of ${matchesToProcess.length} processed!`
      );
      console.log(
        `Profitable arbitrage opportunities saved to ${profitableFile}`
      );

      // Display top opportunities
      console.log("\n=== TOP ARBITRAGE OPPORTUNITIES ===");

      // Collect all opportunities from profitable matches
      const allOpportunities = [];
      for (const match of profitable) {
        for (const opp of match.arbitrageOpportunities) {
          allOpportunities.push({
            match: `${match.matchDetails.homeTeam} vs ${match.matchDetails.awayTeam}`,
            league: match.matchDetails.league,
            ...opp,
          });
        }
      }

      // Sort by profit percentage
      allOpportunities.sort((a, b) => b.profitPercent - a.profitPercent);

      // Display top 10 (or fewer if less available)
      const topCount = Math.min(10, allOpportunities.length);
      for (let i = 0; i < topCount; i++) {
        const opp = allOpportunities[i];
        console.log(`\n${i + 1}. ${opp.match} - ${opp.market}`);
        console.log(`   League: ${opp.league}`);
        console.log(
          `   Profit: ${opp.profitPercent}%, Expected profit: $${opp.expectedProfit}`
        );
        console.log(`   Bookmakers: ${opp.bookies.join(", ")}`);
        console.log(`   Odds: ${opp.odds.join(", ")}`);
        console.log(`   Market Type: ${opp.market}`);
        console.log(`   Arbitrage Condition: ${opp.condition}`);
      }
    } else {
      console.log(
        "\nNo profitable arbitrage opportunities found in any matches."
      );
    }
  } catch (error) {
    console.error("Error processing matches:", error);
  }
}

// If this file is run directly, process matches
if (require.main === module) {
  // Optional: limit the number of matches to process
  const limit = process.argv[2] ? parseInt(process.argv[2]) : null;
  findArbitrageForAllMatches(limit);
}

module.exports = {
  findArbitrageForMatch,
  findArbitrageForAllMatches,
};
