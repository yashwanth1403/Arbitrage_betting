// Helper function to calculate implied probability
function impliedProbability(odds) {
  return 1 / odds;
}

// Generic arbitrage calculator for n outcomes
function checkArbitrage(oddsArray) {
  const totalImplied = oddsArray.reduce(
    (sum, odds) => sum + impliedProbability(odds),
    0
  );

  // Calculate stake distribution for a default stake of 1000
  const defaultStake = 1000;
  const stakeDistribution = [];
  let calculatedReturn = 0;

  if (totalImplied < 1) {
    // Calculate optimal stake for each outcome
    for (const odds of oddsArray) {
      const impliedProb = impliedProbability(odds);
      const optimalStake = (impliedProb / totalImplied) * defaultStake;
      stakeDistribution.push(Math.round(optimalStake * 100) / 100); // Round to 2 decimal places
    }

    // Calculate the actual return based on stake distribution
    calculatedReturn = stakeDistribution[0] * oddsArray[0]; // All returns should be equal
    const actualROI = ((calculatedReturn - defaultStake) / defaultStake) * 100;

    return {
      isArbitrage: true,
      profitPercent: Math.round(actualROI * 100) / 100, // Use the actual ROI as profit percent
      totalStake: defaultStake,
      stakeDistribution: stakeDistribution,
      expectedReturn: Math.round(calculatedReturn * 100) / 100,
      expectedProfit: Math.round((calculatedReturn - defaultStake) * 100) / 100,
    };
  }

  return {
    isArbitrage: false,
    profitPercent: 0,
    actualROI: 0,
    totalStake: defaultStake,
    stakeDistribution: [],
    expectedReturn: 0,
    expectedProfit: 0,
  };
}

// 1. Match Result (1X2)
function arbitrageMatchResult(homeOdds, drawOdds, awayOdds) {
  return checkArbitrage([homeOdds, drawOdds, awayOdds]);
}

// 2. Double Chance (1X, X2, 12)
function arbitrageDoubleChance(odds1X, oddsX2, odds12) {
  return checkArbitrage([odds1X, oddsX2, odds12]);
}

// 3. Draw No Bet
function arbitrageDrawNoBet(homeOdds, awayOdds) {
  return checkArbitrage([homeOdds, awayOdds]);
}

// 4. Over/Under (e.g., goals, corners, fouls, cards)
function arbitrageOverUnder(overOdds, underOdds) {
  return checkArbitrage([overOdds, underOdds]);
}

// 5. Both Teams to Score (BTTS)
function arbitrageBTTS(yesOdds, noOdds) {
  return checkArbitrage([yesOdds, noOdds]);
}

// 6. Which Team Will Have More (Corners, Fouls, Cards)
function arbitrageWhichTeam(teamAOdds, teamBOdds) {
  return checkArbitrage([teamAOdds, teamBOdds]);
}

// 7. Exact Number (Goals, Corners, Fouls, Cards)
function arbitrageExactNumber(...oddsArray) {
  return checkArbitrage(oddsArray);
}

// 8. First/Last Event (Corner, Card, Goal)
function arbitrageFirstLast(teamAOdds, teamBOdds, noEventOdds) {
  return checkArbitrage([teamAOdds, teamBOdds, noEventOdds]);
}

// Export the functions for use in other files
module.exports = {
  impliedProbability,
  checkArbitrage,
  arbitrageMatchResult,
  arbitrageDoubleChance,
  arbitrageDrawNoBet,
  arbitrageOverUnder,
  arbitrageBTTS,
  arbitrageWhichTeam,
  arbitrageExactNumber,
  arbitrageFirstLast,
};

// Example usage:
const result = arbitrageMatchResult(2.1, 3.5, 3.6);
console.log("Match Result:", result);

const doubleChanceResult = arbitrageDoubleChance(1.35, 1.4, 1.3);
console.log("Double Chance:", doubleChanceResult);

const drawNoBetResult = arbitrageDrawNoBet(1.8, 2.1);
console.log("Draw No Bet:", drawNoBetResult);

const overUnderGoalsResult = arbitrageOverUnder(1.99, 2.65);
console.log("Over/Under Goals:", overUnderGoalsResult);

const bttsResult = arbitrageBTTS(1.95, 1.95);
console.log("Both Teams To Score:", bttsResult);

const cornersWhichTeamResult = arbitrageWhichTeam(2.0, 2.0);
console.log("Which Team More Corners:", cornersWhichTeamResult);

const foulsOverUnderResult = arbitrageOverUnder(1.85, 2.0);
console.log("Over/Under Fouls:", foulsOverUnderResult);

const yellowCardsExactNumberResult = arbitrageExactNumber(7.0, 5.5, 4.0, 3.5);
console.log("Exact Number of Yellow Cards:", yellowCardsExactNumberResult);

const firstCornerResult = arbitrageFirstLast(2.1, 2.1, 8.0);
console.log("First Team to Win a Corner:", firstCornerResult);
