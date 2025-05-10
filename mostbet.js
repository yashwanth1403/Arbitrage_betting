const axios = require("axios");
const fs = require("fs");

/**
 * Fetches data from MostBet API for a specific match
 * @param {string} matchId - The ID of the match to fetch
 * @returns {Promise<Object>} - The raw API response
 */
async function fetchOddsMostBet(matchId) {
  try {
    console.log("Fetching data from MostBet...");
    console.log("url", `https://mostbet-in62.com/api/v1/lines/${matchId}.json`);
    const response = await axios.get(
      `https://mostbet-in62.com/api/v1/lines/${matchId}.json`
    );
    return response.data;
  } catch (error) {
    console.error("Error fetching data from MostBet:", error.message);
    throw error;
  }
}

/**
 * Main function to get match information and odds
 * @param {string} matchId - The ID of the match to fetch
 * @returns {Promise<Object>} - Structured match data
 */
async function fetchMostBetData(matchId) {
  console.log("Fetching data from MostBet...");
  // Fetch data from MostBet API
  const data = await fetchOddsMostBet(matchId);

  // Create a structured object to store match information
  const matchInfo = {
    success: false,
    site: "mostbet",
    matchDetails: {},
    odds: {},
  };

  if (data && data.line && data.line.match) {
    matchInfo.success = true;

    // Extract match details
    matchInfo.matchDetails = {
      homeTeam: data.line.match.team1.title,
      awayTeam: data.line.match.team2.title,
      league: data.line_subcategory.title,
      matchTime: new Date(data.line.match.begin_at * 1000).toLocaleString(),
    };

    // Process markets and outcomes
    if (data.markets && data.outcome_groups) {
      // Process 1X2 market
      const market1X2 = data.outcome_groups.find(
        (group) => group.title === "1x2"
      );
      if (market1X2 && market1X2.outcomes) {
        matchInfo.odds["1X2"] = {};

        const w1Outcome = market1X2.outcomes.find(
          (outcome) => outcome.type_title === "W1"
        );
        const xOutcome = market1X2.outcomes.find(
          (outcome) => outcome.type_title === "X"
        );
        const w2Outcome = market1X2.outcomes.find(
          (outcome) => outcome.type_title === "W2"
        );

        if (w1Outcome) matchInfo.odds["1X2"]["W1"] = parseFloat(w1Outcome.odd);
        if (xOutcome) matchInfo.odds["1X2"]["X"] = parseFloat(xOutcome.odd);
        if (w2Outcome) matchInfo.odds["1X2"]["W2"] = parseFloat(w2Outcome.odd);
      }

      // Process Double Chance market
      const doubleChanceGroup = data.outcome_groups.find(
        (group) => group.title === "Double Chance"
      );
      if (doubleChanceGroup && doubleChanceGroup.outcomes) {
        matchInfo.odds["Double Chance"] = {};

        const outcomes1X = doubleChanceGroup.outcomes.find(
          (outcome) => outcome.type_title === "1X"
        );
        const outcomes12 = doubleChanceGroup.outcomes.find(
          (outcome) => outcome.type_title === "12"
        );
        const outcomesX2 = doubleChanceGroup.outcomes.find(
          (outcome) =>
            outcome.type_title === "X2" || outcome.type_title === "2X"
        );

        if (outcomes1X)
          matchInfo.odds["Double Chance"]["1X"] = parseFloat(outcomes1X.odd);
        if (outcomes12)
          matchInfo.odds["Double Chance"]["12"] = parseFloat(outcomes12.odd);
        if (outcomesX2)
          matchInfo.odds["Double Chance"]["X2"] = parseFloat(outcomesX2.odd);
      } else {
        // Fallback to the previous method
        const doubleChanceFallbackGroup = data.outcome_groups.find((group) => {
          return (
            group.outcomes &&
            group.outcomes.some(
              (outcome) =>
                outcome.type_title === "1X" ||
                outcome.type_title === "12" ||
                outcome.type_title === "X2" ||
                outcome.type_title === "2X"
            )
          );
        });

        if (doubleChanceFallbackGroup) {
          matchInfo.odds["Double Chance"] = {};

          const outcomes1X = doubleChanceFallbackGroup.outcomes.find(
            (outcome) => outcome.type_title === "1X"
          );
          const outcomes12 = doubleChanceFallbackGroup.outcomes.find(
            (outcome) => outcome.type_title === "12"
          );
          const outcomesX2 = doubleChanceFallbackGroup.outcomes.find(
            (outcome) =>
              outcome.type_title === "X2" || outcome.type_title === "2X"
          );

          if (outcomes1X)
            matchInfo.odds["Double Chance"]["1X"] = parseFloat(outcomes1X.odd);
          if (outcomes12)
            matchInfo.odds["Double Chance"]["12"] = parseFloat(outcomes12.odd);
          if (outcomesX2)
            matchInfo.odds["Double Chance"]["X2"] = parseFloat(outcomesX2.odd);
        }
      }

      // Process Asian Handicap market
      const asianHandicapGroup = data.outcome_groups.find(
        (group) => group.title === "Asian handicap"
      );
      if (asianHandicapGroup && asianHandicapGroup.outcomes) {
        matchInfo.odds["Asian Handicap"] = {};

        asianHandicapGroup.outcomes.forEach((outcome) => {
          if (
            outcome.type_title &&
            outcome.type_title.includes("Asian handicap")
          ) {
            // Extract team number (1 or 2) and handicap value
            const teamMatch = outcome.type_title.match(/Asian handicap (\d+)/);
            const valueMatch = outcome.type_title.match(/[+-]\d+\.\d+/);

            if (teamMatch && valueMatch) {
              const teamNumber = teamMatch[1];
              const handicapValue = valueMatch[0];
              const team =
                teamNumber === "1"
                  ? matchInfo.matchDetails.homeTeam
                  : matchInfo.matchDetails.awayTeam;

              matchInfo.odds["Asian Handicap"][`${team} (${handicapValue})`] =
                parseFloat(outcome.odd);
            }
          }
        });
      }

      // Process Asian Total market
      const asianTotalGroup = data.outcome_groups.find(
        (group) => group.title === "Asian Total"
      );
      if (asianTotalGroup && asianTotalGroup.outcomes) {
        matchInfo.odds["Asian Total"] = {};

        asianTotalGroup.outcomes.forEach((outcome) => {
          if (outcome.type_title) {
            // Extract the total value and over/under type
            const valueMatch = outcome.type_title.match(
              /Asian Total \((\d+\.\d+)\) (Over|Under)/
            );

            if (valueMatch && valueMatch.length === 3) {
              const totalValue = valueMatch[1];
              const overUnder = valueMatch[2];

              // Use the same naming convention as 1xBet
              const key = `Total ${overUnder} (${totalValue})`;
              matchInfo.odds["Asian Total"][key] = parseFloat(outcome.odd);
            }
          }
        });
      } else {
        // If no dedicated Asian Total group, search all outcome groups

        const asianTotalOutcomes = [];

        // Collect all Asian Total outcomes from all groups
        data.outcome_groups.forEach((group) => {
          if (group.outcomes) {
            group.outcomes.forEach((outcome) => {
              if (
                outcome.type_title &&
                outcome.type_title.includes("Asian Total")
              ) {
                asianTotalOutcomes.push(outcome);
              }
            });
          }
        });

        if (asianTotalOutcomes.length > 0) {
          matchInfo.odds["Asian Total"] = {};

          asianTotalOutcomes.forEach((outcome) => {
            const valueMatch = outcome.type_title.match(
              /Asian Total \((\d+\.\d+)\) (Over|Under)/
            );

            if (valueMatch && valueMatch.length === 3) {
              const totalValue = valueMatch[1];
              const overUnder = valueMatch[2];

              // Use the same naming convention as 1xBet
              const key = `Total ${overUnder} (${totalValue})`;
              matchInfo.odds["Asian Total"][key] = parseFloat(outcome.odd);
            }
          });
        }
      }

      // Process Both Teams To Score market
      const bothTeamsToScoreGroup = data.outcome_groups.find(
        (group) => group.title === "Both Teams To Score"
      );
      if (bothTeamsToScoreGroup && bothTeamsToScoreGroup.outcomes) {
        matchInfo.odds["Both Teams To Score"] = {};

        const yesOutcome = bothTeamsToScoreGroup.outcomes.find(
          (outcome) => outcome.type_title === "Yes" || outcome.alias === "yes"
        );
        const noOutcome = bothTeamsToScoreGroup.outcomes.find(
          (outcome) => outcome.type_title === "No" || outcome.alias === "no"
        );

        if (yesOutcome)
          matchInfo.odds["Both Teams To Score"]["Yes"] = parseFloat(
            yesOutcome.odd
          );
        if (noOutcome)
          matchInfo.odds["Both Teams To Score"]["No"] = parseFloat(
            noOutcome.odd
          );
      }

      // Process Fouls - Total Home Team market
      const foulsTotalHomeTeamGroup = data.outcome_groups.find(
        (group) => group.title === "Fouls - Total Home Team"
      );
      if (foulsTotalHomeTeamGroup && foulsTotalHomeTeamGroup.outcomes) {
        matchInfo.odds["Fouls - Total Home Team"] = {};

        foulsTotalHomeTeamGroup.outcomes.forEach((outcome) => {
          if (outcome.type_title && outcome.type_title.includes("Total")) {
            const totalValue =
              outcome.type_title.match(/Total \((\d+\.\d+)\)/)[1];
            const overUnder = outcome.type_title.includes("Over")
              ? "Over"
              : "Under";
            const key = `Total ${overUnder} (${totalValue})`;
            matchInfo.odds["Fouls - Total Home Team"][key] = parseFloat(
              outcome.odd
            );
          }
        });
      }

      // Process Offsides - 1X2 market
      const offsides1X2Group = data.outcome_groups.find(
        (group) => group.title === "Offsides - 1x2"
      );
      if (offsides1X2Group && offsides1X2Group.outcomes) {
        matchInfo.odds["Offsides - 1X2"] = {};

        const w1Outcome = offsides1X2Group.outcomes.find(
          (outcome) => outcome.type_title === "W1"
        );
        const xOutcome = offsides1X2Group.outcomes.find(
          (outcome) => outcome.type_title === "X"
        );
        const w2Outcome = offsides1X2Group.outcomes.find(
          (outcome) => outcome.type_title === "W2"
        );

        if (w1Outcome)
          matchInfo.odds["Offsides - 1X2"]["W1"] = parseFloat(w1Outcome.odd);
        if (xOutcome)
          matchInfo.odds["Offsides - 1X2"]["X"] = parseFloat(xOutcome.odd);
        if (w2Outcome)
          matchInfo.odds["Offsides - 1X2"]["W2"] = parseFloat(w2Outcome.odd);
      }

      // Process Offsides - Handicap market
      const offsidesHandicapGroup = data.outcome_groups.find(
        (group) => group.title === "Offsides - Handicap"
      );
      if (offsidesHandicapGroup && offsidesHandicapGroup.outcomes) {
        matchInfo.odds["Offsides - Handicap"] = {};

        offsidesHandicapGroup.outcomes.forEach((outcome) => {
          if (outcome.type_title && outcome.type_title.includes("Handicap")) {
            const teamMatch = outcome.type_title.match(/Handicap (\d+)/i);
            const valueMatch = outcome.type_title.match(/\(([+-]?\d+\.?\d*)\)/);

            if (teamMatch && teamMatch[1]) {
              const teamNumber = teamMatch[1];
              let handicapValue = "0.0";

              if (valueMatch && valueMatch[1]) {
                handicapValue = valueMatch[1];
              }

              const team =
                teamNumber === "1"
                  ? matchInfo.matchDetails.homeTeam
                  : matchInfo.matchDetails.awayTeam;

              matchInfo.odds["Offsides - Handicap"][
                `${team} (${handicapValue})`
              ] = parseFloat(outcome.odd);
            }
          }
        });
      }

      // Process Offsides - Total market
      const offsidesTotalGroup = data.outcome_groups.find(
        (group) => group.title === "Offsides - Total"
      );
      if (offsidesTotalGroup && offsidesTotalGroup.outcomes) {
        matchInfo.odds["Offsides - Total"] = {};

        offsidesTotalGroup.outcomes.forEach((outcome) => {
          if (outcome.type_title) {
            const valueMatch = outcome.type_title.match(
              /Total \((\d+\.?\d*)\) (Over|Under)/
            );

            if (valueMatch && valueMatch.length === 3) {
              const totalValue = valueMatch[1];
              const overUnder = valueMatch[2];
              const key = `Total ${overUnder} (${totalValue})`;
              matchInfo.odds["Offsides - Total"][key] = parseFloat(outcome.odd);
            }
          }
        });
      }

      // Process Offsides - Total Home team market
      const offsidesTotalHomeTeamGroup = data.outcome_groups.find(
        (group) => group.title === "Offsides - Total Home team"
      );
      if (offsidesTotalHomeTeamGroup && offsidesTotalHomeTeamGroup.outcomes) {
        matchInfo.odds["Offsides - Total Home Team"] = {};

        offsidesTotalHomeTeamGroup.outcomes.forEach((outcome) => {
          if (outcome.type_title) {
            const valueMatch = outcome.type_title.match(
              /Total \((\d+\.?\d*)\) (Over|Under)/
            );

            if (valueMatch && valueMatch.length === 3) {
              const totalValue = valueMatch[1];
              const overUnder = valueMatch[2];
              const key = `Total ${overUnder} (${totalValue})`;
              matchInfo.odds["Offsides - Total Home Team"][key] = parseFloat(
                outcome.odd
              );
            }
          }
        });
      }

      // Process Offsides - Total Away team market
      const offsidesTotalAwayTeamGroup = data.outcome_groups.find(
        (group) => group.title === "Offsides - Total Away team"
      );
      if (offsidesTotalAwayTeamGroup && offsidesTotalAwayTeamGroup.outcomes) {
        matchInfo.odds["Offsides - Total Away Team"] = {};

        offsidesTotalAwayTeamGroup.outcomes.forEach((outcome) => {
          if (outcome.type_title) {
            const valueMatch = outcome.type_title.match(
              /Total \((\d+\.?\d*)\) (Over|Under)/
            );

            if (valueMatch && valueMatch.length === 3) {
              const totalValue = valueMatch[1];
              const overUnder = valueMatch[2];
              const key = `Total ${overUnder} (${totalValue})`;
              matchInfo.odds["Offsides - Total Away Team"][key] = parseFloat(
                outcome.odd
              );
            }
          }
        });
      }

      // Process Fouls - Total Away Team market
      const foulsTotalAwayTeamGroup = data.outcome_groups.find(
        (group) => group.title === "Fouls - Total Away Team"
      );
      if (foulsTotalAwayTeamGroup && foulsTotalAwayTeamGroup.outcomes) {
        matchInfo.odds["Fouls - Total Away Team"] = {};

        foulsTotalAwayTeamGroup.outcomes.forEach((outcome) => {
          if (outcome.type_title && outcome.type_title.includes("Total")) {
            const totalValue =
              outcome.type_title.match(/Total \((\d+\.\d+)\)/)[1];
            const overUnder = outcome.type_title.includes("Over")
              ? "Over"
              : "Under";
            const key = `Total ${overUnder} (${totalValue})`;
            matchInfo.odds["Fouls - Total Away Team"][key] = parseFloat(
              outcome.odd
            );
          }
        });
      }

      // Process Throw-ins - 1X2 market
      const throwins1X2Group = data.outcome_groups.find(
        (group) => group.title === "Throw-ins - 1x2"
      );
      if (throwins1X2Group && throwins1X2Group.outcomes) {
        matchInfo.odds["Throw-ins - 1X2"] = {};

        const w1Outcome = throwins1X2Group.outcomes.find(
          (outcome) => outcome.type_title === "W1"
        );
        const xOutcome = throwins1X2Group.outcomes.find(
          (outcome) => outcome.type_title === "X"
        );
        const w2Outcome = throwins1X2Group.outcomes.find(
          (outcome) => outcome.type_title === "W2"
        );

        if (w1Outcome)
          matchInfo.odds["Throw-ins - 1X2"]["W1"] = parseFloat(w1Outcome.odd);
        if (xOutcome)
          matchInfo.odds["Throw-ins - 1X2"]["X"] = parseFloat(xOutcome.odd);
        if (w2Outcome)
          matchInfo.odds["Throw-ins - 1X2"]["W2"] = parseFloat(w2Outcome.odd);
      }

      // Process Throw-ins - Total market
      const throwinsTotalGroup = data.outcome_groups.find(
        (group) => group.title === "Throw-ins - Total"
      );
      if (throwinsTotalGroup && throwinsTotalGroup.outcomes) {
        matchInfo.odds["Throw-ins - Total"] = {};

        throwinsTotalGroup.outcomes.forEach((outcome) => {
          if (outcome.type_title) {
            const valueMatch = outcome.type_title.match(
              /Total \((\d+\.?\d*)\) (Over|Under)/
            );

            if (valueMatch && valueMatch.length === 3) {
              const totalValue = valueMatch[1];
              const overUnder = valueMatch[2];
              const key = `Total ${overUnder} (${totalValue})`;
              matchInfo.odds["Throw-ins - Total"][key] = parseFloat(
                outcome.odd
              );
            }
          }
        });
      }

      // Process Throw-ins - Handicap market
      const throwinsHandicapGroup = data.outcome_groups.find(
        (group) => group.title === "Throw-ins - Handicap"
      );
      if (throwinsHandicapGroup && throwinsHandicapGroup.outcomes) {
        matchInfo.odds["Throw-ins - Handicap"] = {};

        throwinsHandicapGroup.outcomes.forEach((outcome) => {
          if (outcome.type_title) {
            const teamMatch = outcome.type_title.match(/Handicap (\d+)/i);
            const valueMatch = outcome.type_title.match(/\(([+-]?\d+\.?\d*)\)/);

            if (teamMatch && teamMatch[1]) {
              const teamNumber = teamMatch[1];
              let handicapValue = "0.0";

              if (valueMatch && valueMatch[1]) {
                handicapValue = valueMatch[1];
              }

              const team =
                teamNumber === "1"
                  ? matchInfo.matchDetails.homeTeam
                  : matchInfo.matchDetails.awayTeam;

              matchInfo.odds["Throw-ins - Handicap"][
                `${team} (${handicapValue})`
              ] = parseFloat(outcome.odd);
            }
          }
        });
      }

      // Process Throw-ins - Total Home Team market
      const throwinsTotalHomeTeamGroup = data.outcome_groups.find(
        (group) => group.title === "Throw-ins - Total Home Team"
      );
      if (throwinsTotalHomeTeamGroup && throwinsTotalHomeTeamGroup.outcomes) {
        matchInfo.odds["Throw-ins - Total Home Team"] = {};

        throwinsTotalHomeTeamGroup.outcomes.forEach((outcome) => {
          if (outcome.type_title && outcome.type_title.includes("Total")) {
            const totalValue = outcome.type_title.match(
              /Total \((\d+\.?\d*)\)/
            )[1];
            const overUnder = outcome.type_title.includes("Over")
              ? "Over"
              : "Under";
            const key = `Total ${overUnder} (${totalValue})`;
            matchInfo.odds["Throw-ins - Total Home Team"][key] = parseFloat(
              outcome.odd
            );
          }
        });
      }

      // Process Throw-ins - Total Away Team market
      const throwinsTotalAwayTeamGroup = data.outcome_groups.find(
        (group) => group.title === "Throw-ins - Total Away Team"
      );
      if (throwinsTotalAwayTeamGroup && throwinsTotalAwayTeamGroup.outcomes) {
        matchInfo.odds["Throw-ins - Total Away Team"] = {};

        throwinsTotalAwayTeamGroup.outcomes.forEach((outcome) => {
          if (outcome.type_title && outcome.type_title.includes("Total")) {
            const totalValue = outcome.type_title.match(
              /Total \((\d+\.?\d*)\)/
            )[1];
            const overUnder = outcome.type_title.includes("Over")
              ? "Over"
              : "Under";
            const key = `Total ${overUnder} (${totalValue})`;
            matchInfo.odds["Throw-ins - Total Away Team"][key] = parseFloat(
              outcome.odd
            );
          }
        });
      }

      // Process Fouls - 1X2 market
      const fouls1X2Group = data.outcome_groups.find(
        (group) => group.title === "Fouls - 1x2"
      );
      if (fouls1X2Group && fouls1X2Group.outcomes) {
        matchInfo.odds["Fouls - 1X2"] = {};

        const w1Outcome = fouls1X2Group.outcomes.find(
          (outcome) => outcome.type_title === "W1"
        );
        const xOutcome = fouls1X2Group.outcomes.find(
          (outcome) => outcome.type_title === "X"
        );
        const w2Outcome = fouls1X2Group.outcomes.find(
          (outcome) => outcome.type_title === "W2"
        );

        if (w1Outcome)
          matchInfo.odds["Fouls - 1X2"]["W1"] = parseFloat(w1Outcome.odd);
        if (xOutcome)
          matchInfo.odds["Fouls - 1X2"]["X"] = parseFloat(xOutcome.odd);
        if (w2Outcome)
          matchInfo.odds["Fouls - 1X2"]["W2"] = parseFloat(w2Outcome.odd);

        console.log(
          "Fouls - 1X2 odds:",
          JSON.stringify(matchInfo.odds["Fouls - 1X2"], null, 2)
        );
      } else {
        // Fallback to searching for fouls 1X2 market in other groups
        console.log(
          "No dedicated Fouls - 1X2 group found, searching all groups"
        );

        // Look for groups that might contain Fouls 1X2 markets
        const foulsGroups = data.outcome_groups.filter((group) => {
          return (
            group.outcomes &&
            group.outcomes.some(
              (outcome) =>
                (outcome.type_title === "W1" ||
                  outcome.type_title === "X" ||
                  outcome.type_title === "W2") &&
                (group.title.toLowerCase().includes("foul") ||
                  group.id === 12705)
            )
          );
        });

        if (foulsGroups.length > 0) {
          matchInfo.odds["Fouls - 1X2"] = {};

          // Check all potential groups
          for (const group of foulsGroups) {
            const w1Outcome = group.outcomes.find(
              (outcome) => outcome.type_title === "W1"
            );
            const xOutcome = group.outcomes.find(
              (outcome) => outcome.type_title === "X"
            );
            const w2Outcome = group.outcomes.find(
              (outcome) => outcome.type_title === "W2"
            );

            if (w1Outcome)
              matchInfo.odds["Fouls - 1X2"]["W1"] = parseFloat(w1Outcome.odd);
            if (xOutcome)
              matchInfo.odds["Fouls - 1X2"]["X"] = parseFloat(xOutcome.odd);
            if (w2Outcome)
              matchInfo.odds["Fouls - 1X2"]["W2"] = parseFloat(w2Outcome.odd);

            // If we found all outcomes, break out of the loop
            if (w1Outcome && xOutcome && w2Outcome) break;
          }

          console.log(
            "Fouls - 1X2 odds (from search):",
            JSON.stringify(matchInfo.odds["Fouls - 1X2"], null, 2)
          );
        }
      }

      // Process Corners Handicap market
      const cornersHandicapGroup = data.outcome_groups.find(
        (group) => group.title === "Corners - Handicap"
      );
      if (cornersHandicapGroup && cornersHandicapGroup.outcomes) {
        matchInfo.odds["Corners - Handicap"] = {};

        cornersHandicapGroup.outcomes.forEach((outcome) => {
          if (outcome.type_title) {
            console.log(
              "Processing corners handicap outcome:",
              outcome.type_title,
              outcome.odd
            );

            // Extract team number and handicap value
            const teamMatch = outcome.type_title.match(/Handi[cс]ap (\d+)/i);
            const valueMatch = outcome.type_title.match(/\(([+-]?\d+\.?\d*)\)/);

            if (teamMatch && teamMatch[1]) {
              const teamNumber = teamMatch[1];
              let handicapValue = "0.0"; // Default value

              if (valueMatch && valueMatch[1]) {
                handicapValue = valueMatch[1];
              }

              const team =
                teamNumber === "1"
                  ? matchInfo.matchDetails.homeTeam
                  : matchInfo.matchDetails.awayTeam;

              // Use the same naming convention as 1xBet
              const key = `${team} (${handicapValue})`;
              matchInfo.odds["Corners - Handicap"][key] = parseFloat(
                outcome.odd
              );
            }
          }
        });
      }

      // Process Corners Home Team Total market
      const cornersHomeTeamTotalGroup = data.outcome_groups.find(
        (group) => group.title === "Corners - Home Team Total"
      );
      if (cornersHomeTeamTotalGroup && cornersHomeTeamTotalGroup.outcomes) {
        matchInfo.odds["Corners - Home Team Total"] = {};

        cornersHomeTeamTotalGroup.outcomes.forEach((outcome) => {
          if (outcome.type_title) {
            console.log(
              "Processing corners home team total outcome:",
              outcome.type_title,
              outcome.odd
            );

            // Extract the total value and over/under type
            const overMatch = outcome.type_title.match(
              /Total Over \((\d+\.?\d*)\)/
            );
            const underMatch = outcome.type_title.match(
              /Total Under \((\d+\.?\d*)\)/
            );

            if (overMatch && overMatch.length === 2) {
              const totalValue = overMatch[1];
              // Use the same naming convention as 1xBet
              const key = `Total Over (${totalValue})`;
              matchInfo.odds["Corners - Home Team Total"][key] = parseFloat(
                outcome.odd
              );
              console.log(
                `Added corners home team total: ${key} = ${parseFloat(
                  outcome.odd
                )}`
              );
            } else if (underMatch && underMatch.length === 2) {
              const totalValue = underMatch[1];
              // Use the same naming convention as 1xBet
              const key = `Total Under (${totalValue})`;
              matchInfo.odds["Corners - Home Team Total"][key] = parseFloat(
                outcome.odd
              );
              console.log(
                `Added corners home team total: ${key} = ${parseFloat(
                  outcome.odd
                )}`
              );
            }
          }
        });

        console.log(
          "Final Corners Home Team Total object:",
          JSON.stringify(matchInfo.odds["Corners - Home Team Total"], null, 2)
        );
      } else {
        // If no dedicated Corners Home Team Total group, search all outcome groups
        console.log(
          "No dedicated Corners Home Team Total group found, searching all groups"
        );
        const cornersHomeTeamTotalOutcomes = [];

        // Collect all Corners Home Team Total outcomes from all groups
        data.outcome_groups.forEach((group) => {
          if (group.outcomes) {
            group.outcomes.forEach((outcome) => {
              if (
                outcome.type_title &&
                (group.title.includes("Corners") ||
                  outcome.type_title.includes("Corners")) &&
                outcome.type_title.includes("Total") &&
                (group.title.includes("Home") ||
                  outcome.type_title.includes("Home"))
              ) {
                cornersHomeTeamTotalOutcomes.push(outcome);
              }
            });
          }
        });

        if (cornersHomeTeamTotalOutcomes.length > 0) {
          console.log(
            `Found ${cornersHomeTeamTotalOutcomes.length} corners home team total outcomes across all groups`
          );
          matchInfo.odds["Corners - Home Team Total"] = {};

          cornersHomeTeamTotalOutcomes.forEach((outcome) => {
            const overMatch = outcome.type_title.match(
              /Total Over \((\d+\.?\d*)\)/
            );
            const underMatch = outcome.type_title.match(
              /Total Under \((\d+\.?\d*)\)/
            );

            if (overMatch && overMatch.length === 2) {
              const totalValue = overMatch[1];
              // Use the same naming convention as 1xBet
              const key = `Total Over (${totalValue})`;
              matchInfo.odds["Corners - Home Team Total"][key] = parseFloat(
                outcome.odd
              );
              console.log(
                `Added corners home team total from search: ${key} = ${parseFloat(
                  outcome.odd
                )}`
              );
            } else if (underMatch && underMatch.length === 2) {
              const totalValue = underMatch[1];
              // Use the same naming convention as 1xBet
              const key = `Total Under (${totalValue})`;
              matchInfo.odds["Corners - Home Team Total"][key] = parseFloat(
                outcome.odd
              );
              console.log(
                `Added corners home team total from search: ${key} = ${parseFloat(
                  outcome.odd
                )}`
              );
            }
          });

          console.log(
            "Final Corners Home Team Total object from search:",
            JSON.stringify(matchInfo.odds["Corners - Home Team Total"], null, 2)
          );
        }
      }

      // Process Corners Away Team Total market
      const cornersAwayTeamTotalGroup = data.outcome_groups.find(
        (group) => group.title === "Corners - Away Team Total"
      );
      if (cornersAwayTeamTotalGroup && cornersAwayTeamTotalGroup.outcomes) {
        matchInfo.odds["Corners - Away Team Total"] = {};

        cornersAwayTeamTotalGroup.outcomes.forEach((outcome) => {
          if (outcome.type_title) {
            console.log(
              "Processing corners away team total outcome:",
              outcome.type_title,
              outcome.odd
            );

            // Extract the total value and over/under type
            const overMatch = outcome.type_title.match(
              /Total Over \((\d+\.?\d*)\)/
            );
            const underMatch = outcome.type_title.match(
              /Total Under \((\d+\.?\d*)\)/
            );

            if (overMatch && overMatch.length === 2) {
              const totalValue = overMatch[1];
              // Use the same naming convention as 1xBet
              const key = `Total Over (${totalValue})`;
              matchInfo.odds["Corners - Away Team Total"][key] = parseFloat(
                outcome.odd
              );
              console.log(
                `Added corners away team total: ${key} = ${parseFloat(
                  outcome.odd
                )}`
              );
            } else if (underMatch && underMatch.length === 2) {
              const totalValue = underMatch[1];
              // Use the same naming convention as 1xBet
              const key = `Total Under (${totalValue})`;
              matchInfo.odds["Corners - Away Team Total"][key] = parseFloat(
                outcome.odd
              );
              console.log(
                `Added corners away team total: ${key} = ${parseFloat(
                  outcome.odd
                )}`
              );
            }
          }
        });

        console.log(
          "Final Corners Away Team Total object:",
          JSON.stringify(matchInfo.odds["Corners - Away Team Total"], null, 2)
        );
      } else {
        // If no dedicated Corners Away Team Total group, search all outcome groups
        console.log(
          "No dedicated Corners Away Team Total group found, searching all groups"
        );
        const cornersAwayTeamTotalOutcomes = [];

        // Collect all Corners Away Team Total outcomes from all groups
        data.outcome_groups.forEach((group) => {
          if (group.outcomes) {
            group.outcomes.forEach((outcome) => {
              if (
                outcome.type_title &&
                (group.title.includes("Corners") ||
                  outcome.type_title.includes("Corners")) &&
                outcome.type_title.includes("Total") &&
                (group.title.includes("Away") ||
                  outcome.type_title.includes("Away"))
              ) {
                cornersAwayTeamTotalOutcomes.push(outcome);
              }
            });
          }
        });

        if (cornersAwayTeamTotalOutcomes.length > 0) {
          console.log(
            `Found ${cornersAwayTeamTotalOutcomes.length} corners away team total outcomes across all groups`
          );
          matchInfo.odds["Corners - Away Team Total"] = {};

          cornersAwayTeamTotalOutcomes.forEach((outcome) => {
            const overMatch = outcome.type_title.match(
              /Total Over \((\d+\.?\d*)\)/
            );
            const underMatch = outcome.type_title.match(
              /Total Under \((\d+\.?\d*)\)/
            );

            if (overMatch && overMatch.length === 2) {
              const totalValue = overMatch[1];
              // Use the same naming convention as 1xBet
              const key = `Total Over (${totalValue})`;
              matchInfo.odds["Corners - Away Team Total"][key] = parseFloat(
                outcome.odd
              );
              console.log(
                `Added corners away team total from search: ${key} = ${parseFloat(
                  outcome.odd
                )}`
              );
            } else if (underMatch && underMatch.length === 2) {
              const totalValue = underMatch[1];
              // Use the same naming convention as 1xBet
              const key = `Total Under (${totalValue})`;
              matchInfo.odds["Corners - Away Team Total"][key] = parseFloat(
                outcome.odd
              );
              console.log(
                `Added corners away team total from search: ${key} = ${parseFloat(
                  outcome.odd
                )}`
              );
            }
          });

          console.log(
            "Final Corners Away Team Total object from search:",
            JSON.stringify(matchInfo.odds["Corners - Away Team Total"], null, 2)
          );
        }
      }

      // Process Handicap market
      const handicapGroup = data.outcome_groups.find(
        (group) => group.title === "Handicap"
      );
      if (handicapGroup && handicapGroup.outcomes) {
        // Initialize the Handicap object if it doesn't exist
        if (!matchInfo.odds["Handicap"]) {
          matchInfo.odds["Handicap"] = {};
        }

        handicapGroup.outcomes.forEach((outcome) => {
          if (outcome.type_title) {
            // Debug the actual outcome data
            console.log(
              "Processing handicap outcome:",
              outcome.type_title,
              outcome.odd
            );

            // Extract team number and handicap value using a more specific approach
            const parts = outcome.type_title.split(" ");
            if (
              parts.length >= 3 &&
              parts[0] === "Handicap" &&
              (parts[1] === "1" || parts[1] === "2")
            ) {
              const teamNumber = parts[1];

              // Extract the handicap value from the parentheses
              let handicapValue = "";
              if (parts[2].startsWith("(") && parts[2].endsWith(")")) {
                // Format: "Handicap 1 (-2.5)"
                handicapValue = parts[2].substring(1, parts[2].length - 1);
              } else {
                // Try to find the handicap value in the string
                const valueMatch =
                  outcome.type_title.match(/\(([+-]?\d+\.?\d*)\)/);
                if (valueMatch) {
                  handicapValue = valueMatch[1];
                }
              }

              const team =
                teamNumber === "1"
                  ? matchInfo.matchDetails.homeTeam
                  : matchInfo.matchDetails.awayTeam;

              // Only add if we found a valid handicap value
              if (handicapValue) {
                const key = `${team} (${handicapValue})`;
                matchInfo.odds["Handicap"][key] = parseFloat(outcome.odd);
                console.log(
                  `Added handicap: ${key} = ${parseFloat(outcome.odd)}`
                );
              }
            }
          }
        });

        // Log the final handicap object to verify
        console.log(
          "Final Handicap object:",
          JSON.stringify(matchInfo.odds["Handicap"], null, 2)
        );
      } else {
        // If no dedicated handicap group, search all outcome groups
        console.log("No dedicated handicap group found, searching all groups");
        const handicapOutcomes = [];

        // Collect all handicap outcomes from all groups
        data.outcome_groups.forEach((group) => {
          if (group.outcomes) {
            group.outcomes.forEach((outcome) => {
              if (
                outcome.type_title &&
                outcome.type_title.includes("Handicap")
              ) {
                handicapOutcomes.push(outcome);
              }
            });
          }
        });

        if (handicapOutcomes.length > 0) {
          console.log(
            `Found ${handicapOutcomes.length} handicap outcomes across all groups`
          );
          // Initialize the Handicap object if it doesn't exist
          if (!matchInfo.odds["Handicap"]) {
            matchInfo.odds["Handicap"] = {};
          }

          handicapOutcomes.forEach((outcome) => {
            const teamMatch = outcome.type_title.match(/Handicap (\d+)/);
            const valueMatch = outcome.type_title.match(/([+-]?\d+\.?\d*)/);

            if (teamMatch && valueMatch) {
              const teamNumber = teamMatch[1];
              const handicapValue = valueMatch[1];

              const team =
                teamNumber === "1"
                  ? matchInfo.matchDetails.homeTeam
                  : matchInfo.matchDetails.awayTeam;

              const key = `${team} (${handicapValue})`;
              matchInfo.odds["Handicap"][key] = parseFloat(outcome.odd);
              console.log(
                `Added handicap from search: ${key} = ${parseFloat(
                  outcome.odd
                )}`
              );
            }
          });
        }
      }

      // Process Home Team Total market
      const homeTeamTotalGroup = data.outcome_groups.find(
        (group) => group.title === "Home Team Total"
      );
      if (homeTeamTotalGroup && homeTeamTotalGroup.outcomes) {
        matchInfo.odds["Home Team Total"] = {};

        homeTeamTotalGroup.outcomes.forEach((outcome) => {
          if (outcome.type_title) {
            if (outcome.type_title.includes("Total Over")) {
              const value = outcome.type_title.match(/\d+(\.\d+)?/);
              if (value) {
                matchInfo.odds["Home Team Total"][`Total Over (${value[0]})`] =
                  parseFloat(outcome.odd);
              }
            } else if (outcome.type_title.includes("Total Under")) {
              const value = outcome.type_title.match(/\d+(\.\d+)?/);
              if (value) {
                matchInfo.odds["Home Team Total"][`Total Under (${value[0]})`] =
                  parseFloat(outcome.odd);
              }
            }
          }
        }); // Added missing closing brace here
      }

      // Process Away Team Total market
      const awayTeamTotalGroup = data.outcome_groups.find(
        (group) => group.title === "Away Team Total"
      );
      if (awayTeamTotalGroup && awayTeamTotalGroup.outcomes) {
        matchInfo.odds["Away Team Total"] = {};

        awayTeamTotalGroup.outcomes.forEach((outcome) => {
          if (outcome.type_title) {
            if (outcome.type_title.includes("Total Over")) {
              const value = outcome.type_title.match(/\d+(\.\d+)?/);
              if (value) {
                matchInfo.odds["Away Team Total"][`Total Over (${value[0]})`] =
                  parseFloat(outcome.odd);
              }
            } else if (outcome.type_title.includes("Total Under")) {
              const value = outcome.type_title.match(/\d+(\.\d+)?/);
              if (value) {
                matchInfo.odds["Away Team Total"][`Total Under (${value[0]})`] =
                  parseFloat(outcome.odd);
              }
            }
          }
        }); // Added missing closing brace here
      }

      // Process Total (Over/Under) markets - IMPROVED VERSION
      const totalMarket = data.markets.find(
        (market) => market.title === "Total"
      );
      if (totalMarket) {
        // Find the outcome groups for totals
        const totalGroups = totalMarket.groups
          .map((groupId) =>
            data.outcome_groups.find((group) => group.id === groupId)
          )
          .filter(Boolean);

        matchInfo.odds["Total"] = {};

        // Process each total group
        totalGroups.forEach((group) => {
          if (group.outcomes) {
            // Skip any groups related to fouls to prevent mixing
            if (
              group.title &&
              (group.title.toLowerCase().includes("foul") ||
                group.title.toLowerCase().includes("card") ||
                group.title.toLowerCase().includes("corner"))
            ) {
              console.log(
                `Skipping group "${group.title}" as it appears to be related to a specific market type, not main Total`
              );
              return;
            }

            group.outcomes.forEach((outcome) => {
              // Only process outcomes that are specifically for Total Goals, not other markets
              // Check if the outcome should be included based on its attributes
              if (
                outcome.type_title &&
                (outcome.type_title.includes("Total Over") ||
                  outcome.type_title.includes("Total Under")) &&
                !outcome.type_title.toLowerCase().includes("foul") &&
                !outcome.type_title.toLowerCase().includes("card") &&
                !outcome.type_title.toLowerCase().includes("corner")
              ) {
                // Extract the total value
                const valueMatch = outcome.type_title.match(/\((\d+\.?\d*)\)/);
                if (valueMatch) {
                  const totalValue = valueMatch[1];

                  // Determine if it's Over or Under
                  if (outcome.type_title.includes("Total Over")) {
                    matchInfo.odds["Total"][`Total Over (${totalValue})`] =
                      parseFloat(outcome.odd);
                    console.log(
                      `Added to Total market: Total Over (${totalValue}) = ${parseFloat(
                        outcome.odd
                      )}`
                    );
                  } else if (outcome.type_title.includes("Total Under")) {
                    matchInfo.odds["Total"][`Total Under (${totalValue})`] =
                      parseFloat(outcome.odd);
                    console.log(
                      `Added to Total market: Total Under (${totalValue}) = ${parseFloat(
                        outcome.odd
                      )}`
                    );
                  }
                }
              }
            });
          }
        });

        // Additionally, check for Total outcomes directly in the data.outcome_groups
        // This handles the case where the JSON structure in the query is different
        const totalOutcomesFromJson = data.outcome_groups.find(
          (group) => group.title === "Total"
        );
        if (totalOutcomesFromJson && totalOutcomesFromJson.outcomes) {
          totalOutcomesFromJson.outcomes.forEach((outcome) => {
            if (outcome.type_title) {
              // Process "Total Over (X.X)" and "Total Under (X.X)" formats
              if (outcome.type_title.includes("Total Over")) {
                const valueMatch = outcome.type_title.match(/\((\d+\.?\d*)\)/);
                if (valueMatch) {
                  const totalValue = valueMatch[1];
                  matchInfo.odds["Total"][`Total Over (${totalValue})`] =
                    parseFloat(outcome.odd);
                  console.log(
                    `Added from direct group: Total Over (${totalValue}) = ${parseFloat(
                      outcome.odd
                    )}`
                  );
                }
              } else if (outcome.type_title.includes("Total Under")) {
                const valueMatch = outcome.type_title.match(/\((\d+\.?\d*)\)/);
                if (valueMatch) {
                  const totalValue = valueMatch[1];
                  matchInfo.odds["Total"][`Total Under (${totalValue})`] =
                    parseFloat(outcome.odd);
                  console.log(
                    `Added from direct group: Total Under (${totalValue}) = ${parseFloat(
                      outcome.odd
                    )}`
                  );
                }
              }
            }
          });
        }

        // If we still don't have any Total odds, try processing the outcomes directly from the user query format
        if (Object.keys(matchInfo.odds["Total"]).length === 0) {
          // Find all outcomes with Total Over/Under in type_title
          const allOutcomes = [];
          data.outcome_groups.forEach((group) => {
            if (group.outcomes) {
              group.outcomes.forEach((outcome) => {
                if (
                  outcome.type_title &&
                  (outcome.type_title === "Total Over (0.5)" ||
                    outcome.type_title === "Total Under (0.5)" ||
                    outcome.type_title === "Total Over (1.5)" ||
                    outcome.type_title === "Total Under (1.5)" ||
                    outcome.type_title === "Total Over (2.5)" ||
                    outcome.type_title === "Total Under (2.5)" ||
                    outcome.type_title === "Total Over (3.5)" ||
                    outcome.type_title === "Total Under (3.5)" ||
                    outcome.type_title === "Total Over (4.5)" ||
                    outcome.type_title === "Total Under (4.5)" ||
                    outcome.type_title === "Total Over (5.5)" ||
                    outcome.type_title === "Total Under (5.5)")
                ) {
                  allOutcomes.push(outcome);
                }
              });
            }
          });

          console.log(
            `Found ${allOutcomes.length} generic Total outcomes across all groups`
          );

          allOutcomes.forEach((outcome) => {
            matchInfo.odds["Total"][outcome.type_title] = parseFloat(
              outcome.odd
            );
            console.log(
              `Added from fallback search: ${outcome.type_title} = ${parseFloat(
                outcome.odd
              )}`
            );
          });
        }
      }

      // Process the Total market from the actual structure in the user's query
      // This will handle the direct extraction from the format provided in the user query
      if (data.outcome_groups) {
        const totalFromQuery = data.outcome_groups.find(
          (group) => group.title === "Total"
        );
        if (totalFromQuery && totalFromQuery.outcomes) {
          if (!matchInfo.odds["Total"]) {
            matchInfo.odds["Total"] = {};
          }

          totalFromQuery.outcomes.forEach((outcome) => {
            if (outcome.type_title) {
              // Check if this is a valid total market outcome (not related to fouls, cards, etc.)
              if (
                (outcome.type_title.startsWith("Total Over") ||
                  outcome.type_title.startsWith("Total Under")) &&
                !outcome.type_title.toLowerCase().includes("foul") &&
                !outcome.type_title.toLowerCase().includes("card") &&
                !outcome.type_title.toLowerCase().includes("corner")
              ) {
                matchInfo.odds["Total"][outcome.type_title] = parseFloat(
                  outcome.odd
                );
                console.log(
                  `Added directly from query format: ${
                    outcome.type_title
                  } = ${parseFloat(outcome.odd)}`
                );
              }
            }
          });
        }
      }

      // If we have a direct array of outcomes with type_title for Total Over/Under
      // This handles the exact format shown in the user query
      if (data.outcomes) {
        const totalOutcomes = data.outcomes.filter(
          (outcome) =>
            outcome.type_title &&
            (outcome.type_title.startsWith("Total Over") ||
              outcome.type_title.startsWith("Total Under"))
        );

        if (totalOutcomes.length > 0) {
          if (!matchInfo.odds["Total"]) {
            matchInfo.odds["Total"] = {};
          }

          totalOutcomes.forEach((outcome) => {
            matchInfo.odds["Total"][outcome.type_title] = parseFloat(
              outcome.odd
            );
            console.log(
              `Added from direct outcomes array: ${
                outcome.type_title
              } = ${parseFloat(outcome.odd)}`
            );
          });
        }
      }

      // Process Corners markets
      const cornersMarket = data.markets.find(
        (market) => market.title === "Corners"
      );
      if (cornersMarket) {
        // Store corners data temporarily like in 1xBet
        matchInfo.tempCornersData = {};

        // Find the outcome groups for corners
        const cornersGroups = cornersMarket.groups
          .map((groupId) =>
            data.outcome_groups.find((group) => group.id === groupId)
          )
          .filter(Boolean);

        // Process corners 1X2
        const corners1X2Group = cornersGroups.find(
          (group) =>
            group.outcomes &&
            group.outcomes.some(
              (outcome) => ["W1", "X", "Х", "W2"].includes(outcome.type_title) // Added Cyrillic "Х"
            )
        );

        if (corners1X2Group) {
          matchInfo.tempCornersData["Corners - 1X2"] = {};

          const w1Outcome = corners1X2Group.outcomes.find(
            (o) => o.type_title === "W1"
          );
          // Look for both Latin "X" and Cyrillic "Х"
          const xOutcome = corners1X2Group.outcomes.find(
            (o) => o.type_title === "X" || o.type_title === "Х"
          );
          const w2Outcome = corners1X2Group.outcomes.find(
            (o) => o.type_title === "W2"
          );

          if (w1Outcome)
            matchInfo.tempCornersData["Corners - 1X2"]["W1"] = parseFloat(
              w1Outcome.odd
            );
          if (xOutcome)
            matchInfo.tempCornersData["Corners - 1X2"]["X"] = parseFloat(
              xOutcome.odd
            );
          if (w2Outcome)
            matchInfo.tempCornersData["Corners - 1X2"]["W2"] = parseFloat(
              w2Outcome.odd
            );
        }

        // Process corners total
        const cornersTotalGroup = cornersGroups.find(
          (group) =>
            group.outcomes &&
            group.outcomes.some(
              (outcome) =>
                outcome.type_title &&
                (outcome.type_title.includes("Total Over") ||
                  outcome.type_title.includes("Total Under"))
            )
        );

        if (cornersTotalGroup) {
          matchInfo.tempCornersData["Corners - Total"] = {};

          cornersTotalGroup.outcomes.forEach((outcome) => {
            if (
              outcome.type_title &&
              outcome.type_title.includes("Total Over")
            ) {
              const value = outcome.type_title.match(/\d+(\.\d+)?/);
              if (value) {
                matchInfo.tempCornersData["Corners - Total"][
                  `Total Over (${value[0]})`
                ] = parseFloat(outcome.odd);
              }
            } else if (
              outcome.type_title &&
              outcome.type_title.includes("Total Under")
            ) {
              const value = outcome.type_title.match(/\d+(\.\d+)?/);
              if (value) {
                matchInfo.tempCornersData["Corners - Total"][
                  `Total Under (${value[0]})`
                ] = parseFloat(outcome.odd);
              }
            }
          });
        }

        // Process corners handicap
        const cornersHandicapGroup = cornersGroups.find(
          (group) =>
            group.outcomes &&
            group.outcomes.some(
              (outcome) =>
                outcome.type_title && outcome.type_title.includes("Handicap")
            )
        );

        if (cornersHandicapGroup) {
          matchInfo.tempCornersData["Corners - Handicap"] = {};

          cornersHandicapGroup.outcomes.forEach((outcome) => {
            if (outcome.type_title && outcome.type_title.includes("Handicap")) {
              const teamMatch = outcome.type_title.match(
                /(Team 1|Team 2|Home|Away)/i
              );
              const valueMatch = outcome.type_title.match(/[+-]?\d+(\.\d+)?/);

              if (teamMatch && valueMatch) {
                const team =
                  teamMatch[0].includes("1") || teamMatch[0].includes("Home")
                    ? matchInfo.matchDetails.homeTeam
                    : matchInfo.matchDetails.awayTeam;

                matchInfo.tempCornersData["Corners - Handicap"][
                  `${team} (${valueMatch[0]})`
                ] = parseFloat(outcome.odd);
              }
            }
          });
        }
      }

      // Process Yellow Cards markets
      const yellowCardsMarket = data.markets.find(
        (market) => market.title === "Yellow cards"
      );
      if (yellowCardsMarket) {
        // Store yellow cards data temporarily like in 1xBet
        matchInfo.tempYellowCardsData = {};

        // Find the outcome groups for yellow cards
        const yellowCardsGroups = yellowCardsMarket.groups
          .map((groupId) =>
            data.outcome_groups.find((group) => group.id === groupId)
          )
          .filter(Boolean);

        // Process yellow cards 1X2
        const yellowCards1X2Group = data.outcome_groups.find(
          (group) => group.title === "Yellow Cards - 1x2"
        );
        if (yellowCards1X2Group && yellowCards1X2Group.outcomes) {
          matchInfo.tempYellowCardsData["Yellow Cards - 1X2"] = {};

          const w1Outcome = yellowCards1X2Group.outcomes.find(
            (outcome) => outcome.type_title === "W1"
          );
          const xOutcome = yellowCards1X2Group.outcomes.find(
            (outcome) => outcome.type_title === "X"
          );
          const w2Outcome = yellowCards1X2Group.outcomes.find(
            (outcome) => outcome.type_title === "W2"
          );

          if (w1Outcome)
            matchInfo.tempYellowCardsData["Yellow Cards - 1X2"]["W1"] =
              parseFloat(w1Outcome.odd);
          if (xOutcome)
            matchInfo.tempYellowCardsData["Yellow Cards - 1X2"]["X"] =
              parseFloat(xOutcome.odd);
          if (w2Outcome)
            matchInfo.tempYellowCardsData["Yellow Cards - 1X2"]["W2"] =
              parseFloat(w2Outcome.odd);
        }

        // Process yellow cards total
        const yellowCardsTotalGroup = data.outcome_groups.find(
          (group) => group.title === "Yellow Cards - Total"
        );
        if (yellowCardsTotalGroup && yellowCardsTotalGroup.outcomes) {
          matchInfo.tempYellowCardsData["Yellow Cards - Total"] = {};

          yellowCardsTotalGroup.outcomes.forEach((outcome) => {
            if (outcome.type_title) {
              if (outcome.type_title.includes("Total Over")) {
                const value = outcome.type_title.match(/\d+(\.\d+)?/);
                if (value) {
                  matchInfo.tempYellowCardsData["Yellow Cards - Total"][
                    `Total Over (${value[0]})`
                  ] = parseFloat(outcome.odd);
                }
              } else if (outcome.type_title.includes("Total Under")) {
                const value = outcome.type_title.match(/\d+(\.\d+)?/);
                if (value) {
                  matchInfo.tempYellowCardsData["Yellow Cards - Total"][
                    `Total Under (${value[0]})`
                  ] = parseFloat(outcome.odd);
                }
              }
            }
          });
        } else {
          // Fallback to the previous method
          const yellowCardsTotalFallbackGroup = yellowCardsGroups.find(
            (group) =>
              group.outcomes &&
              group.outcomes.some(
                (outcome) =>
                  outcome.type_title &&
                  (outcome.type_title.includes("Total Over") ||
                    outcome.type_title.includes("Total Under"))
              )
          );

          if (yellowCardsTotalFallbackGroup) {
            matchInfo.tempYellowCardsData["Yellow Cards - Total"] = {};

            yellowCardsTotalFallbackGroup.outcomes.forEach((outcome) => {
              if (
                outcome.type_title &&
                outcome.type_title.includes("Total Over")
              ) {
                const value = outcome.type_title.match(/\d+(\.\d+)?/);
                if (value) {
                  matchInfo.tempYellowCardsData["Yellow Cards - Total"][
                    `Total Over (${value[0]})`
                  ] = parseFloat(outcome.odd);
                }
              } else if (
                outcome.type_title &&
                outcome.type_title.includes("Total Under")
              ) {
                const value = outcome.type_title.match(/\d+(\.\d+)?/);
                if (value) {
                  matchInfo.tempYellowCardsData["Yellow Cards - Total"][
                    `Total Under (${value[0]})`
                  ] = parseFloat(outcome.odd);
                }
              }
            });
          }
        }

        // Process yellow cards home team total
        const yellowCardsHomeTeamTotalGroup = data.outcome_groups.find(
          (group) => group.title === "Yellow Cards - Home Team Total"
        );
        if (
          yellowCardsHomeTeamTotalGroup &&
          yellowCardsHomeTeamTotalGroup.outcomes
        ) {
          matchInfo.tempYellowCardsData["Yellow Cards - Home Team Total"] = {};

          yellowCardsHomeTeamTotalGroup.outcomes.forEach((outcome) => {
            if (outcome.type_title) {
              if (outcome.type_title.includes("Total Over")) {
                const value = outcome.type_title.match(/\d+(\.\d+)?/);
                if (value) {
                  matchInfo.tempYellowCardsData[
                    "Yellow Cards - Home Team Total"
                  ][`Over (${value[0]})`] = parseFloat(outcome.odd);
                }
              } else if (outcome.type_title.includes("Total Under")) {
                const value = outcome.type_title.match(/\d+(\.\d+)?/);
                if (value) {
                  matchInfo.tempYellowCardsData[
                    "Yellow Cards - Home Team Total"
                  ][`Under (${value[0]})`] = parseFloat(outcome.odd);
                }
              }
            }
          });
        }

        // Process yellow cards away team total
        const yellowCardsAwayTeamTotalGroup = data.outcome_groups.find(
          (group) => group.title === "Yellow Cards - Away Team Total"
        );
        if (
          yellowCardsAwayTeamTotalGroup &&
          yellowCardsAwayTeamTotalGroup.outcomes
        ) {
          matchInfo.tempYellowCardsData["Yellow Cards - Away Team Total"] = {};

          yellowCardsAwayTeamTotalGroup.outcomes.forEach((outcome) => {
            if (outcome.type_title) {
              if (outcome.type_title.includes("Total Over")) {
                const value = outcome.type_title.match(/\d+(\.\d+)?/);
                if (value) {
                  matchInfo.tempYellowCardsData[
                    "Yellow Cards - Away Team Total"
                  ][`Over (${value[0]})`] = parseFloat(outcome.odd);
                }
              } else if (outcome.type_title.includes("Total Under")) {
                const value = outcome.type_title.match(/\d+(\.\d+)?/);
                if (value) {
                  matchInfo.tempYellowCardsData[
                    "Yellow Cards - Away Team Total"
                  ][`Under (${value[0]})`] = parseFloat(outcome.odd);
                }
              }
            }
          });
        }

        // Process yellow cards handicap
        const yellowCardsHandicapGroup = data.outcome_groups.find(
          (group) => group.title === "Yellow cards - Handicap"
        );
        if (yellowCardsHandicapGroup && yellowCardsHandicapGroup.outcomes) {
          matchInfo.tempYellowCardsData["Yellow Cards - Handicap"] = {};

          yellowCardsHandicapGroup.outcomes.forEach((outcome) => {
            if (outcome.type_title && outcome.type_title.includes("Handicap")) {
              const teamMatch = outcome.type_title.match(/Handicap (\d+)/);
              const valueMatch = outcome.type_title.match(/[+-]?\d+(\.\d+)?/);

              if (teamMatch && valueMatch) {
                const teamNumber = teamMatch[1];
                const handicapValue = valueMatch[0];
                const team =
                  teamNumber === "1"
                    ? matchInfo.matchDetails.homeTeam
                    : matchInfo.matchDetails.awayTeam;

                matchInfo.tempYellowCardsData["Yellow Cards - Handicap"][
                  `${team} (${handicapValue})`
                ] = parseFloat(outcome.odd);
              }
            }
          });
        } else {
          // Fallback to the previous method
          const yellowCardsHandicapFallbackGroup = yellowCardsGroups.find(
            (group) =>
              group.outcomes &&
              group.outcomes.some(
                (outcome) =>
                  outcome.type_title && outcome.type_title.includes("Handicap")
              )
          );

          if (yellowCardsHandicapFallbackGroup) {
            matchInfo.tempYellowCardsData["Yellow Cards - Handicap"] = {};

            yellowCardsHandicapFallbackGroup.outcomes.forEach((outcome) => {
              if (
                outcome.type_title &&
                outcome.type_title.includes("Handicap")
              ) {
                const teamMatch = outcome.type_title.match(
                  /(Team 1|Team 2|Home|Away|Handicap \d+)/i
                );
                const valueMatch = outcome.type_title.match(/[+-]?\d+(\.\d+)?/);

                if (teamMatch) {
                  let team;
                  if (
                    teamMatch[0].includes("1") ||
                    teamMatch[0].includes("Home")
                  ) {
                    team = matchInfo.matchDetails.homeTeam;
                  } else if (
                    teamMatch[0].includes("2") ||
                    teamMatch[0].includes("Away")
                  ) {
                    team = matchInfo.matchDetails.awayTeam;
                  }

                  if (team && valueMatch) {
                    matchInfo.tempYellowCardsData["Yellow Cards - Handicap"][
                      `${team} (${valueMatch[0]})`
                    ] = parseFloat(outcome.odd);
                  }
                }
              }
            });
          }
        }
      }
    }
  }

  // Now you can use the structured data
  console.log("Fetching data from MostBet...");

  // Merge temporary data into the main odds object
  if (matchInfo.tempCornersData) {
    Object.keys(matchInfo.tempCornersData).forEach((key) => {
      matchInfo.odds[key] = matchInfo.tempCornersData[key];
    });
    // Remove the temporary object after merging
    delete matchInfo.tempCornersData;
  }

  if (matchInfo.tempYellowCardsData) {
    Object.keys(matchInfo.tempYellowCardsData).forEach((key) => {
      matchInfo.odds[key] = matchInfo.tempYellowCardsData[key];
    });
    // Remove the temporary object after merging
    delete matchInfo.tempYellowCardsData;
  }

  // Process Fouls markets
  const foulsMarket = data.markets.find((market) => market.title === "Fouls");
  if (foulsMarket) {
    // Find the outcome groups for fouls
    // Find all groups related to fouls
    const foulsGroups = data.outcome_groups.filter(
      (group) =>
        group.title &&
        (group.title.includes("Fouls") || group.title === "Fouls")
    );

    // Process fouls total
    const foulsTotalGroup = data.outcome_groups.find(
      (group) => group.title === "Fouls - Total"
    );
    if (foulsTotalGroup && foulsTotalGroup.outcomes) {
      matchInfo.odds["Fouls - Total"] = {};

      foulsTotalGroup.outcomes.forEach((outcome) => {
        if (outcome.type_title) {
          console.log(
            "Processing fouls total outcome:",
            outcome.type_title,
            outcome.odd
          );

          // Handle the format "Total (20.5) Over" or "Total (20.5) Under"
          const totalMatch = outcome.type_title.match(
            /Total \((\d+\.?\d*)\) (Over|Under)/i
          );
          if (totalMatch && totalMatch.length === 3) {
            const totalValue = totalMatch[1];
            const overUnder = totalMatch[2];

            // Use the same naming convention as 1xBet
            const key = `Total ${overUnder} (${totalValue})`;
            matchInfo.odds["Fouls - Total"][key] = parseFloat(outcome.odd);
            console.log(
              `Added fouls total: ${key} = ${parseFloat(outcome.odd)}`
            );
          }
        }
      });

      console.log(
        "Final Fouls Total object:",
        JSON.stringify(matchInfo.odds["Fouls - Total"], null, 2)
      );
    } else {
      // If no dedicated group, search all outcome groups
      console.log("No dedicated Fouls Total group found, searching all groups");

      // Look for any group that might contain Fouls Total
      const foulsTotalOutcomes = [];

      data.outcome_groups.forEach((group) => {
        if (
          group.title &&
          group.title.includes("Fouls") &&
          (group.title.includes("Total") || group.title === "Total")
        ) {
          if (group.outcomes) {
            foulsTotalOutcomes.push(...group.outcomes);
          }
        } else if (group.outcomes) {
          group.outcomes.forEach((outcome) => {
            if (
              outcome.type_title &&
              outcome.type_title.includes("Total") &&
              (group.title.includes("Fouls") ||
                outcome.type_title.includes("Fouls"))
            ) {
              foulsTotalOutcomes.push(outcome);
            }
          });
        }
      });

      if (foulsTotalOutcomes.length > 0) {
        console.log(
          `Found ${foulsTotalOutcomes.length} fouls total outcomes across all groups`
        );
        matchInfo.odds["Fouls - Total"] = {};

        foulsTotalOutcomes.forEach((outcome) => {
          console.log(
            "Processing fouls total outcome from search:",
            outcome.type_title,
            outcome.odd
          );

          // Handle various formats
          const totalMatch = outcome.type_title.match(
            /Total \((\d+\.?\d*)\) (Over|Under)/i
          );
          if (totalMatch && totalMatch.length === 3) {
            const totalValue = totalMatch[1];
            const overUnder = totalMatch[2];

            // Use the same naming convention as 1xBet
            const key = `Total ${overUnder} (${totalValue})`;
            matchInfo.odds["Fouls - Total"][key] = parseFloat(outcome.odd);
            console.log(
              `Added fouls total from search: ${key} = ${parseFloat(
                outcome.odd
              )}`
            );
          }
        });

        console.log(
          "Final Fouls Total object from search:",
          JSON.stringify(matchInfo.odds["Fouls - Total"], null, 2)
        );
      }
    }

    // Process fouls handicap - IMPROVED VERSION
    const foulsHandicapGroup = foulsGroups.find(
      (group) =>
        group.title === "Fouls - Handicap" ||
        (group.outcomes &&
          group.outcomes.some(
            (outcome) =>
              outcome.type_title && outcome.type_title.includes("Handicap")
          ))
    );

    if (foulsHandicapGroup) {
      console.log("Found Fouls Handicap group:", foulsHandicapGroup.title);
      matchInfo.odds["Fouls - Handicap"] = {};

      foulsHandicapGroup.outcomes.forEach((outcome) => {
        console.log(
          "Processing fouls handicap outcome:",
          outcome.type_title,
          outcome.odd
        );

        if (outcome.type_title && outcome.type_title.includes("Handicap")) {
          // Try different regex patterns to extract team and handicap value
          let teamNumber = null;
          let handicapValue = null;

          // Pattern 1: "Handicap 1 (+1.5)"
          const pattern1 = outcome.type_title.match(
            /Handicap (\d+) \(([+-]?\d+\.?\d*)\)/
          );
          if (pattern1) {
            teamNumber = pattern1[1];
            handicapValue = pattern1[2];
          } else {
            // Pattern 2: "Handicap 1"
            const pattern2 = outcome.type_title.match(/Handicap (\d+)/);
            if (pattern2) {
              teamNumber = pattern2[1];
              // Look for handicap value separately
              const valueMatch = outcome.type_title.match(/[+-]?\d+\.?\d+/);
              if (valueMatch) {
                handicapValue = valueMatch[0];
              }
            } else {
              // Pattern 3: "Team 1" or "Home"
              const pattern3 = outcome.type_title.match(
                /(Team 1|Team 2|Home|Away)/i
              );
              if (pattern3) {
                teamNumber =
                  pattern3[0].includes("1") || pattern3[0].includes("Home")
                    ? "1"
                    : "2";
                // Look for handicap value separately
                const valueMatch = outcome.type_title.match(/[+-]?\d+\.?\d+/);
                if (valueMatch) {
                  handicapValue = valueMatch[0];
                }
              }
            }
          }

          if (teamNumber && handicapValue) {
            const team =
              teamNumber === "1"
                ? matchInfo.matchDetails.homeTeam
                : matchInfo.matchDetails.awayTeam;

            const key = `${team} (${handicapValue})`;
            matchInfo.odds["Fouls - Handicap"][key] = parseFloat(outcome.odd);
            console.log(
              `Added fouls handicap: ${key} = ${parseFloat(outcome.odd)}`
            );
          }
        }
      });

      console.log(
        "Final Fouls Handicap object:",
        JSON.stringify(matchInfo.odds["Fouls - Handicap"], null, 2)
      );
    } else {
      // If no dedicated Fouls Handicap group, search all outcome groups
      console.log(
        "No dedicated Fouls Handicap group found, searching all groups"
      );

      // Look for any group that might contain Fouls Handicap
      const foulsHandicapOutcomes = [];

      data.outcome_groups.forEach((group) => {
        if (
          group.title &&
          group.title.includes("Fouls") &&
          group.title.includes("Handicap")
        ) {
          if (group.outcomes) {
            foulsHandicapOutcomes.push(...group.outcomes);
          }
        } else if (group.outcomes) {
          group.outcomes.forEach((outcome) => {
            if (
              outcome.type_title &&
              outcome.type_title.includes("Fouls") &&
              outcome.type_title.includes("Handicap")
            ) {
              foulsHandicapOutcomes.push(outcome);
            }
          });
        }
      });

      if (foulsHandicapOutcomes.length > 0) {
        console.log(
          `Found ${foulsHandicapOutcomes.length} fouls handicap outcomes across all groups`
        );
        matchInfo.odds["Fouls - Handicap"] = {};

        foulsHandicapOutcomes.forEach((outcome) => {
          console.log(
            "Processing fouls handicap outcome from search:",
            outcome.type_title,
            outcome.odd
          );

          // Try different regex patterns to extract team and handicap value
          let teamNumber = null;
          let handicapValue = null;

          // Pattern 1: "Handicap 1 (+1.5)"
          const pattern1 = outcome.type_title.match(
            /Handicap (\d+) \(([+-]?\d+\.?\d*)\)/
          );
          if (pattern1) {
            teamNumber = pattern1[1];
            handicapValue = pattern1[2];
          } else {
            // Pattern 2: "Handicap 1"
            const pattern2 = outcome.type_title.match(/Handicap (\d+)/);
            if (pattern2) {
              teamNumber = pattern2[1];
              // Look for handicap value separately
              const valueMatch = outcome.type_title.match(/[+-]?\d+\.?\d+/);
              if (valueMatch) {
                handicapValue = valueMatch[0];
              }
            } else {
              // Pattern 3: "Team 1" or "Home"
              const pattern3 = outcome.type_title.match(
                /(Team 1|Team 2|Home|Away)/i
              );
              if (pattern3) {
                teamNumber =
                  pattern3[0].includes("1") || pattern3[0].includes("Home")
                    ? "1"
                    : "2";
                // Look for handicap value separately
                const valueMatch = outcome.type_title.match(/[+-]?\d+\.?\d+/);
                if (valueMatch) {
                  handicapValue = valueMatch[0];
                }
              }
            }
          }

          if (teamNumber && handicapValue) {
            const team =
              teamNumber === "1"
                ? matchInfo.matchDetails.homeTeam
                : matchInfo.matchDetails.awayTeam;

            const key = `${team} (${handicapValue})`;
            matchInfo.odds["Fouls - Handicap"][key] = parseFloat(outcome.odd);
            console.log(
              `Added fouls handicap from search: ${key} = ${parseFloat(
                outcome.odd
              )}`
            );
          }
        });

        console.log(
          "Final Fouls Handicap object from search:",
          JSON.stringify(matchInfo.odds["Fouls - Handicap"], null, 2)
        );
      }
    }
  }

  // Add any other temporary data objects you might have
  // For example, if you have tempOffsidesData, tempThrowInsData, etc.
  const timestamp = new Date().toISOString().replace(/:/g, "-");
  const filename = `match_data_mostbet.json`;

  fs.writeFile(filename, JSON.stringify(matchInfo, null, 2), (err) => {
    if (err) {
      console.error("Error writing file:", err);
    } else {
      console.log(`Match data successfully saved to ${filename}`);
    }
  });
  console.log(JSON.stringify(matchInfo, null, 2));

  return matchInfo; // Return the object for use elsewhere
}

// Export the functions for use in other files
module.exports = {
  fetchMostBetData,
};
