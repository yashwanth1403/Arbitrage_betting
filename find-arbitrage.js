// Import required modules
const fs = require("fs");
const path = require("path");
const { fetch1xBetData } = require("./1xBet.js");
const { fetchMostBetData } = require("./mostbet.js");

// Import arbitrage functions directly from the file
const arbitrageFunctions = require("./arbitrage-functions.js");

// Load the odds data from both bookmakers

const data1xbet = fetch1xBetData(matchId);
const dataMostbet = fetchMostBetData(matchId);

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

// Store all arbitrage opportunities
const arbitrageOpportunities = [];

// 1. Check Match Result (1X2) for arbitrage
function check1X2Arbitrage() {
  console.log("\nChecking 1X2 market for arbitrage...");

  const mostbet1X2 = dataMostbet.odds["1X2"];
  const oneXbet1X2 = data1xbet.odds["1X2"];

  // Find best odds for each outcome from either bookmaker
  const bestHome = Math.max(mostbet1X2.W1, oneXbet1X2.W1);
  const bestDraw = Math.max(mostbet1X2.X, oneXbet1X2.X);
  const bestAway = Math.max(mostbet1X2.W2, oneXbet1X2.W2);

  // Determine which bookmaker offers the best odds for each outcome
  const homeBookmaker = mostbet1X2.W1 >= oneXbet1X2.W1 ? "Mostbet" : "1xBet";
  const drawBookmaker = mostbet1X2.X >= oneXbet1X2.X ? "Mostbet" : "1xBet";
  const awayBookmaker = mostbet1X2.W2 >= oneXbet1X2.W2 ? "Mostbet" : "1xBet";

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
    console.log(
      `Found 1X2 arbitrage! Home: ${bestHome} (${homeBookmaker}), Draw: ${bestDraw} (${drawBookmaker}), Away: ${bestAway} (${awayBookmaker})`
    );
    console.log(
      `Profit: ${result.profitPercent}%, Expected profit: ${result.expectedProfit}`
    );
    console.log(
      `Arbitrage condition: Sum of implied probabilities = ${(
        1 / bestHome +
        1 / bestDraw +
        1 / bestAway
      ).toFixed(4)} < 1`
    );
  } else {
    console.log("No 1X2 arbitrage found.");
    console.log(
      `Sum of implied probabilities = ${(
        1 / bestHome +
        1 / bestDraw +
        1 / bestAway
      ).toFixed(4)} >= 1`
    );
  }
}

// 2. Check Double Chance for arbitrage
function checkDoubleChanceArbitrage() {
  console.log("\nChecking Double Chance market for arbitrage...");

  const mostbetDC = dataMostbet.odds["Double Chance"];
  const oneXbetDC = data1xbet.odds["Double Chance"];

  // Find best odds for each outcome from either bookmaker
  const best1X = Math.max(mostbetDC["1X"], oneXbetDC["1X"]);
  const bestX2 = Math.max(mostbetDC["X2"], oneXbetDC["X2"]);
  const best12 = Math.max(mostbetDC["12"], oneXbetDC["12"]);

  // Determine which bookmaker offers the best odds for each outcome
  const oneXBookmaker =
    mostbetDC["1X"] >= oneXbetDC["1X"] ? "Mostbet" : "1xBet";
  const x2Bookmaker = mostbetDC["X2"] >= oneXbetDC["X2"] ? "Mostbet" : "1xBet";
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
    console.log(
      `Found Double Chance arbitrage! 1X: ${best1X} (${oneXBookmaker}), X2: ${bestX2} (${x2Bookmaker}), 12: ${best12} (${twelveBookmaker})`
    );
    console.log(
      `Profit: ${result.profitPercent}%, Expected profit: ${result.expectedProfit}`
    );
    console.log(
      `Arbitrage condition: Sum of implied probabilities = ${(
        1 / best1X +
        1 / bestX2 +
        1 / best12
      ).toFixed(4)} < 1`
    );
  } else {
    console.log("No Double Chance arbitrage found.");
    console.log(
      `Sum of implied probabilities = ${(
        1 / best1X +
        1 / bestX2 +
        1 / best12
      ).toFixed(4)} >= 1`
    );
  }
}

// 3. Check BTTS (Both Teams To Score) for arbitrage
function checkBTTSArbitrage() {
  console.log("\nChecking Both Teams To Score market for arbitrage...");

  // Check if the market exists in both bookmakers
  if (!dataMostbet.odds["Both Teams To Score"]) {
    console.log("Both Teams To Score market not available in Mostbet.");
    return;
  }

  const mostbetBTTS = dataMostbet.odds["Both Teams To Score"];

  // For this example, we'll use Mostbet odds and compare with theoretical 1xBet odds
  if (mostbetBTTS.Yes && mostbetBTTS.No) {
    console.log(`Mostbet BTTS: Yes=${mostbetBTTS.Yes}, No=${mostbetBTTS.No}`);

    // Calculate if there's an arbitrage opportunity within Mostbet's own odds
    const mostbetResult = arbitrageFunctions.arbitrageBTTS(
      mostbetBTTS.Yes,
      mostbetBTTS.No
    );

    if (mostbetResult.isArbitrage) {
      const opportunity = formatArbitrageResult(
        "Both Teams To Score (Mostbet)",
        ["Mostbet", "Mostbet"],
        [mostbetBTTS.Yes, mostbetBTTS.No],
        mostbetResult
      );

      arbitrageOpportunities.push(opportunity);
      console.log(
        `Found BTTS arbitrage within Mostbet! Yes: ${mostbetBTTS.Yes}, No: ${mostbetBTTS.No}`
      );
      console.log(
        `Profit: ${mostbetResult.profitPercent}%, Expected profit: ${mostbetResult.expectedProfit}`
      );
      console.log(
        `Arbitrage condition: Sum of implied probabilities = ${(
          1 / mostbetBTTS.Yes +
          1 / mostbetBTTS.No
        ).toFixed(4)} < 1`
      );
    } else {
      console.log("No BTTS arbitrage found within Mostbet.");
      console.log(
        `Sum of implied probabilities = ${(
          1 / mostbetBTTS.Yes +
          1 / mostbetBTTS.No
        ).toFixed(4)} >= 1`
      );
    }
  } else {
    console.log("Both Teams To Score market not available in complete form.");
  }
}

// 4. Check Over/Under Totals for arbitrage
function checkOverUnderArbitrage() {
  console.log("\nChecking Over/Under markets for arbitrage...");

  // Check main Total goals market
  const mostbetTotal = dataMostbet.odds["Total"];
  const oneXbetTotal = data1xbet.odds["Total"];

  // Look for common total lines between bookmakers
  const totalLines = new Set();

  // Collect all Over/Under lines from Mostbet
  for (const key in mostbetTotal) {
    if (key.startsWith("Total Over") || key.startsWith("Total Under")) {
      const match = key.match(/\((\d+\.?\d*)\)/);
      if (match) {
        totalLines.add(match[1]);
      }
    }
  }

  // Check each line for arbitrage
  totalLines.forEach((line) => {
    const overKey = `Total Over (${line})`;
    const underKey = `Total Under (${line})`;

    // Check if both bookmakers have this line
    if (
      mostbetTotal[overKey] &&
      oneXbetTotal[overKey] &&
      mostbetTotal[underKey] &&
      oneXbetTotal[underKey]
    ) {
      // Find best odds for over and under
      const bestOver = Math.max(mostbetTotal[overKey], oneXbetTotal[overKey]);
      const bestUnder = Math.max(
        mostbetTotal[underKey],
        oneXbetTotal[underKey]
      );

      // Determine which bookmaker offers the best odds
      const overBookmaker =
        mostbetTotal[overKey] >= oneXbetTotal[overKey] ? "Mostbet" : "1xBet";
      const underBookmaker =
        mostbetTotal[underKey] >= oneXbetTotal[underKey] ? "Mostbet" : "1xBet";

      // Check for arbitrage
      const result = arbitrageFunctions.arbitrageOverUnder(bestOver, bestUnder);

      if (result.isArbitrage) {
        const opportunity = formatArbitrageResult(
          `Total Goals (${line})`,
          [overBookmaker, underBookmaker],
          [bestOver, bestUnder],
          result
        );

        arbitrageOpportunities.push(opportunity);
        console.log(
          `Found Total Goals (${line}) arbitrage! Over: ${bestOver} (${overBookmaker}), Under: ${bestUnder} (${underBookmaker})`
        );
        console.log(
          `Profit: ${result.profitPercent}%, Expected profit: ${result.expectedProfit}`
        );
        console.log(
          `Arbitrage condition: Sum of implied probabilities = ${(
            1 / bestOver +
            1 / bestUnder
          ).toFixed(4)} < 1`
        );
      }
    }
  });

  // Also check corners, cards, fouls totals
  const marketTypes = [
    "Corners - Total",
    "Yellow Cards - Total",
    "Fouls - Total",
  ];

  marketTypes.forEach((marketType) => {
    if (dataMostbet.odds[marketType] && data1xbet.odds[marketType]) {
      console.log(`\nChecking ${marketType}...`);

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
            console.log(
              `Found ${marketType} (${line}) arbitrage! Over: ${bestOver} (${overBookmaker}), Under: ${bestUnder} (${underBookmaker})`
            );
            console.log(
              `Profit: ${result.profitPercent}%, Expected profit: ${result.expectedProfit}`
            );
            console.log(
              `Arbitrage condition: Sum of implied probabilities = ${(
                1 / bestOver +
                1 / bestUnder
              ).toFixed(4)} < 1`
            );
          }
        }
      });
    }
  });
}

// 5. Check Asian Handicap for arbitrage
function checkAsianHandicapArbitrage() {
  console.log("\nChecking Asian Handicap market for arbitrage...");

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
          const bestHomeOdds = Math.max(mostbetAH[homeKey], oneXbetAH[homeKey]);
          const bestAwayOdds = Math.max(mostbetAH[awayKey], oneXbetAH[awayKey]);

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
            console.log(
              `Found Asian Handicap arbitrage! ${homeTeam} (${homeHandicap}): ${bestHomeOdds} (${homeBookmaker}), ${awayTeam} (${awayHandicap}): ${bestAwayOdds} (${awayBookmaker})`
            );
            console.log(
              `Profit: ${result.profitPercent}%, Expected profit: ${result.expectedProfit}`
            );
            console.log(
              `Arbitrage condition: Sum of implied probabilities = ${(
                1 / bestHomeOdds +
                1 / bestAwayOdds
              ).toFixed(4)} < 1`
            );
          }
        }
      }
    });
  });

  if (arbitrageOpportunities.length === 0) {
    console.log("No Asian Handicap arbitrage found.");
  }
}

// Run all checks
check1X2Arbitrage();
checkDoubleChanceArbitrage();
checkBTTSArbitrage();
checkOverUnderArbitrage();
checkAsianHandicapArbitrage();

// Output summary
console.log("\n=== ARBITRAGE OPPORTUNITIES SUMMARY ===");
if (arbitrageOpportunities.length > 0) {
  console.log(
    `Found ${arbitrageOpportunities.length} arbitrage opportunities!`
  );

  // Sort by profit percentage descending
  arbitrageOpportunities.sort((a, b) => b.profitPercent - a.profitPercent);

  // Display top opportunities
  console.log("\nTop 5 arbitrage opportunities:");
  arbitrageOpportunities.slice(0, 5).forEach((opp, index) => {
    console.log(`\n${index + 1}. ${opp.market}`);
    console.log(
      `   Profit: ${opp.profitPercent}%, Expected profit: $${opp.expectedProfit}`
    );
    console.log(`   Bookmakers: ${opp.bookies.join(", ")}`);
    console.log(`   Odds: ${opp.odds.join(", ")}`);
    console.log(`   Stake distribution: $${opp.stakeDistribution.join(", $")}`);
    console.log(`   Arbitrage condition: ${opp.condition}`);
  });

  // Save all opportunities to a file
  const timestamp = new Date().toISOString().replace(/:/g, "-");
  const outputFile = `arbitrage-opportunities-${timestamp}.json`;

  fs.writeFileSync(outputFile, JSON.stringify(arbitrageOpportunities, null, 2));
  console.log(`\nAll arbitrage opportunities saved to ${outputFile}`);
} else {
  console.log(
    "No arbitrage opportunities found between 1xBet and Mostbet for this match."
  );
}
