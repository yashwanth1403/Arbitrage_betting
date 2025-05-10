// Import required libraries
const axios = require("axios");
const fs = require("fs");

// Function to fetch data from 1xBet API
async function fetchOdds1xBet(matchId) {
  try {
    console.log("Fetching data from 1xBet...");
    console.log(
      "url",
      `https://ind.1x-bet.mobi/LineFeed/GetGameZip?id=${matchId}&lng=en&isSubGames=true&GroupEvents=true&allEventsGroupSubGames=true&countevents=250&partner=71&country=71&fcountry=71&marketType=1&gr=35&isNewBuilder=true`
    );
    const response = await axios.get(
      `https://ind.1x-bet.mobi/LineFeed/GetGameZip?id=${matchId}&lng=en&isSubGames=true&GroupEvents=true&allEventsGroupSubGames=true&countevents=250&partner=71&country=71&fcountry=71&marketType=1&gr=35&isNewBuilder=true`
    );
    // Return the data without console.log
    return response.data;
  } catch (error) {
    console.error("Error fetching data from 1xBet:", error.message);
    return null;
  }
}

// Main function to execute the API call
async function fetch1xBetData(matchId) {
  console.log("Fetching data from 1xBet...");
  const data = await fetchOdds1xBet(matchId);

  // Create an object to store all the extracted information
  const matchInfo = {
    success: false,
    site: "1xbet",
    matchDetails: {},
    odds: {},
  };

  if (data && data.Value) {
    matchInfo.success = true;

    // Extract match details
    matchInfo.matchDetails = {
      homeTeam: data.Value.O1,
      awayTeam: data.Value.O2,
      league: data.Value.L,
      matchTime: new Date(data.Value.S * 1000).toLocaleString(),
    };

    // Extract subgame information if available
    if (data.Value.SG && Array.isArray(data.Value.SG)) {
      // Find corners market
      const cornersMarket = data.Value.SG.find((sg) => sg.TG === "Corners");
      if (cornersMarket) {
        matchInfo.matchDetails.cornersMarketId = cornersMarket.CI;

        // We'll fetch corners data but store it temporarily
        try {
          const cornersResponse = await axios.get(
            `https://ind.1x-bet.mobi/LineFeed/GetGameZip?id=${cornersMarket.CI}&lng=en&isSubGames=true&GroupEvents=true&allEventsGroupSubGames=true&countevents=250&partner=71&country=71&fcountry=71&marketType=1&gr=35&isNewBuilder=true`
          );

          if (
            cornersResponse.data &&
            cornersResponse.data.Value &&
            cornersResponse.data.Value.GE
          ) {
            // Store corners data temporarily
            matchInfo.tempCornersData = {};

            // Find the Corners 1X2 market (G: 1)
            const corners1X2 = cornersResponse.data.Value.GE.find(
              (market) => market.G === 1
            );

            if (corners1X2 && corners1X2.E && corners1X2.E.length > 0) {
              matchInfo.tempCornersData["Corners - 1X2"] = {
                W1:
                  corners1X2.E[0] && corners1X2.E[0][0]
                    ? corners1X2.E[0][0].C
                    : null,
                X:
                  corners1X2.E[1] && corners1X2.E[1][0]
                    ? corners1X2.E[1][0].C
                    : null,
                W2:
                  corners1X2.E[2] && corners1X2.E[2][0]
                    ? corners1X2.E[2][0].C
                    : null,
              };
            }

            // Find the Corners Total market if it exists
            const cornersTotal = cornersResponse.data.Value.GE.find(
              (market) => market.G === 17
            );

            if (cornersTotal && cornersTotal.E && cornersTotal.E.length >= 2) {
              matchInfo.tempCornersData["Corners - Total"] = {};

              // Process Over options
              if (cornersTotal.E[0] && cornersTotal.E[0].length > 0) {
                cornersTotal.E[0].forEach((option) => {
                  if (option.P && option.C) {
                    matchInfo.tempCornersData["Corners - Total"][
                      `Total Over (${option.P})`
                    ] = option.C;
                  }
                });
              }

              // Process Under options
              if (cornersTotal.E[1] && cornersTotal.E[1].length > 0) {
                cornersTotal.E[1].forEach((option) => {
                  if (option.P && option.C) {
                    matchInfo.tempCornersData["Corners - Total"][
                      `Total Under (${option.P})`
                    ] = option.C;
                  }
                });
              }
            }

            // Find the Corners Home Team Total market (G: 15)
            const cornersHomeTotal = cornersResponse.data.Value.GE.find(
              (market) => market.G === 15
            );

            if (
              cornersHomeTotal &&
              cornersHomeTotal.E &&
              cornersHomeTotal.E.length >= 2
            ) {
              // Extract Home Team Total odds for over and under
              matchInfo.tempCornersData["Corners - Home Team Total"] = {};

              // Process Over options (T: 11)
              if (cornersHomeTotal.E[0] && cornersHomeTotal.E[0].length > 0) {
                cornersHomeTotal.E[0].forEach((option) => {
                  if (option.P && option.C) {
                    matchInfo.tempCornersData["Corners - Home Team Total"][
                      `Total Over (${option.P})`
                    ] = option.C;
                  }
                });
              }

              // Process Under options (T: 12)
              if (cornersHomeTotal.E[1] && cornersHomeTotal.E[1].length > 0) {
                cornersHomeTotal.E[1].forEach((option) => {
                  if (option.P && option.C) {
                    matchInfo.tempCornersData["Corners - Home Team Total"][
                      `Total Under (${option.P})`
                    ] = option.C;
                  }
                });
              }
            }

            // Find the Corners Away Team Total market (G: 62)
            const cornersAwayTotal = cornersResponse.data.Value.GE.find(
              (market) => market.G === 62
            );

            if (
              cornersAwayTotal &&
              cornersAwayTotal.E &&
              cornersAwayTotal.E.length >= 2
            ) {
              // Extract Away Team Total odds for over and under
              matchInfo.tempCornersData["Corners - Away Team Total"] = {};

              // Process Over options (T: 13)
              if (cornersAwayTotal.E[0] && cornersAwayTotal.E[0].length > 0) {
                cornersAwayTotal.E[0].forEach((option) => {
                  if (option.P && option.C) {
                    matchInfo.tempCornersData["Corners - Away Team Total"][
                      `Total Over (${option.P})`
                    ] = option.C;
                  }
                });
              }

              // Process Under options (T: 14)
              if (cornersAwayTotal.E[1] && cornersAwayTotal.E[1].length > 0) {
                cornersAwayTotal.E[1].forEach((option) => {
                  if (option.P && option.C) {
                    matchInfo.tempCornersData["Corners - Away Team Total"][
                      `Total Under (${option.P})`
                    ] = option.C;
                  }
                });
              }
            }

            // Find the Corners Handicap market (G: 2)
            const cornersHandicap = cornersResponse.data.Value.GE.find(
              (market) => market.G === 2
            );

            if (
              cornersHandicap &&
              cornersHandicap.E &&
              cornersHandicap.E.length >= 2
            ) {
              // Extract Corners Handicap odds for home and away teams
              matchInfo.tempCornersData["Corners - Handicap"] = {};

              // Process Home team handicaps (T: 7)
              if (cornersHandicap.E[0] && cornersHandicap.E[0].length > 0) {
                cornersHandicap.E[0].forEach((option) => {
                  const handicapValue = option.P !== undefined ? option.P : 0;
                  if (option.C) {
                    matchInfo.tempCornersData["Corners - Handicap"][
                      `${data.Value.O1} (${handicapValue})`
                    ] = option.C;
                  }
                });
              }

              // Process Away team handicaps (T: 8)
              if (cornersHandicap.E[1] && cornersHandicap.E[1].length > 0) {
                cornersHandicap.E[1].forEach((option) => {
                  const handicapValue = option.P !== undefined ? option.P : 0;
                  if (option.C) {
                    matchInfo.tempCornersData["Corners - Handicap"][
                      `${data.Value.O2} (${handicapValue})`
                    ] = option.C;
                  }
                });
              }
            }
          }
        } catch (error) {
          console.error("Error fetching corners data:", error.message);
        }
      }

      // Find Offsides market
      const offsidesMarket = data.Value.SG.find((sg) => sg.TG === "Offsides");
      if (offsidesMarket) {
        matchInfo.matchDetails.offsidesMarketId = offsidesMarket.CI;

        // We'll fetch offsides data but store it temporarily
        try {
          const offsidesResponse = await axios.get(
            `https://ind.1x-bet.mobi/LineFeed/GetGameZip?id=${offsidesMarket.CI}&lng=en&isSubGames=true&GroupEvents=true&allEventsGroupSubGames=true&countevents=250&partner=71&country=71&fcountry=71&marketType=1&gr=35&isNewBuilder=true`
          );

          // Process offsides data...
          if (
            offsidesResponse.data &&
            offsidesResponse.data.Value &&
            offsidesResponse.data.Value.GE
          ) {
            // Store offsides data temporarily
            matchInfo.tempOffsidesData = {};

            // Find the Offsides 1X2 market (G: 1)
            const offsides1X2 = offsidesResponse.data.Value.GE.find(
              (market) => market.G === 1
            );

            if (offsides1X2 && offsides1X2.E && offsides1X2.E.length > 0) {
              matchInfo.tempOffsidesData["Offsides - 1X2"] = {
                W1:
                  offsides1X2.E[0] && offsides1X2.E[0][0]
                    ? offsides1X2.E[0][0].C
                    : null,
                X:
                  offsides1X2.E[1] && offsides1X2.E[1][0]
                    ? offsides1X2.E[1][0].C
                    : null,
                W2:
                  offsides1X2.E[2] && offsides1X2.E[2][0]
                    ? offsides1X2.E[2][0].C
                    : null,
              };
            }

            // Find the Offsides Total market if it exists (G: 17)
            const offsidesTotal = offsidesResponse.data.Value.GE.find(
              (market) => market.G === 17
            );

            if (
              offsidesTotal &&
              offsidesTotal.E &&
              offsidesTotal.E.length >= 2
            ) {
              matchInfo.tempOffsidesData["Offsides - Total"] = {};

              // Process Over options
              if (offsidesTotal.E[0] && offsidesTotal.E[0].length > 0) {
                offsidesTotal.E[0].forEach((option) => {
                  if (option.P && option.C) {
                    matchInfo.tempOffsidesData["Offsides - Total"][
                      `Total Over (${option.P})`
                    ] = option.C;
                  }
                });
              }

              // Process Under options
              if (offsidesTotal.E[1] && offsidesTotal.E[1].length > 0) {
                offsidesTotal.E[1].forEach((option) => {
                  if (option.P && option.C) {
                    matchInfo.tempOffsidesData["Offsides - Total"][
                      `Total Under (${option.P})`
                    ] = option.C;
                  }
                });
              }
            }

            // Find the Offsides Away Team Total market (G: 62)
            const offsidesAwayTotal = offsidesResponse.data.Value.GE.find(
              (market) => market.G === 62
            );

            if (
              offsidesAwayTotal &&
              offsidesAwayTotal.E &&
              offsidesAwayTotal.E.length >= 2
            ) {
              // Extract Away Team Total odds for over and under
              matchInfo.tempOffsidesData["Offsides - Away Team Total"] = {};

              // Process Over options (T: 13)
              if (offsidesAwayTotal.E[0] && offsidesAwayTotal.E[0].length > 0) {
                offsidesAwayTotal.E[0].forEach((option) => {
                  if (option.P && option.C) {
                    matchInfo.tempOffsidesData["Offsides - Away Team Total"][
                      `Total Over (${option.P})`
                    ] = option.C;
                  }
                });
              }

              // Process Under options (T: 14)
              if (offsidesAwayTotal.E[1] && offsidesAwayTotal.E[1].length > 0) {
                offsidesAwayTotal.E[1].forEach((option) => {
                  if (option.P && option.C) {
                    matchInfo.tempOffsidesData["Offsides - Away Team Total"][
                      `Total Under (${option.P})`
                    ] = option.C;
                  }
                });
              }
            }

            // Find the Offsides Handicap market (G: 2)
            const offsidesHandicap = offsidesResponse.data.Value.GE.find(
              (market) => market.G === 2
            );

            if (
              offsidesHandicap &&
              offsidesHandicap.E &&
              offsidesHandicap.E.length >= 2
            ) {
              // Extract Offsides Handicap odds for home and away teams
              matchInfo.tempOffsidesData["Offsides - Handicap"] = {};

              // Process Home team handicaps (T: 7)
              if (offsidesHandicap.E[0] && offsidesHandicap.E[0].length > 0) {
                offsidesHandicap.E[0].forEach((option) => {
                  const handicapValue = option.P !== undefined ? option.P : 0;
                  if (option.C) {
                    matchInfo.tempOffsidesData["Offsides - Handicap"][
                      `${data.Value.O1} (${handicapValue})`
                    ] = option.C;
                  }
                });
              }

              // Process Away team handicaps (T: 8)
              if (offsidesHandicap.E[1] && offsidesHandicap.E[1].length > 0) {
                offsidesHandicap.E[1].forEach((option) => {
                  const handicapValue = option.P !== undefined ? option.P : 0;
                  if (option.C) {
                    matchInfo.tempOffsidesData["Offsides - Handicap"][
                      `${data.Value.O2} (${handicapValue})`
                    ] = option.C;
                  }
                });
              }
            }
          }
        } catch (error) {
          console.error("Error fetching offsides data:", error.message);
        }
      }

      // Find Throw-ins market
      const throwInsMarket = data.Value.SG.find((sg) => sg.TG === "Throw-ins");
      if (throwInsMarket) {
        matchInfo.matchDetails.throwInsMarketId = throwInsMarket.CI;

        // We'll fetch throw-ins data but store it temporarily
        try {
          const throwInsResponse = await axios.get(
            `https://ind.1x-bet.mobi/LineFeed/GetGameZip?id=${throwInsMarket.CI}&lng=en&isSubGames=true&GroupEvents=true&allEventsGroupSubGames=true&countevents=250&partner=71&country=71&fcountry=71&marketType=1&gr=35&isNewBuilder=true`
          );

          if (
            throwInsResponse.data &&
            throwInsResponse.data.Value &&
            throwInsResponse.data.Value.GE
          ) {
            // Store throw-ins data temporarily
            matchInfo.tempThrowInsData = {};

            // Find the Throw-ins 1X2 market (G: 1)
            const throwIns1X2 = throwInsResponse.data.Value.GE.find(
              (market) => market.G === 1
            );

            if (throwIns1X2 && throwIns1X2.E && throwIns1X2.E.length > 0) {
              matchInfo.tempThrowInsData["Throw-ins - 1X2"] = {
                W1:
                  throwIns1X2.E[0] && throwIns1X2.E[0][0]
                    ? throwIns1X2.E[0][0].C
                    : null,
                X:
                  throwIns1X2.E[1] && throwIns1X2.E[1][0]
                    ? throwIns1X2.E[1][0].C
                    : null,
                W2:
                  throwIns1X2.E[2] && throwIns1X2.E[2][0]
                    ? throwIns1X2.E[2][0].C
                    : null,
              };
            }

            // Find the Throw-ins Total market if it exists (G: 17)
            const throwInsTotal = throwInsResponse.data.Value.GE.find(
              (market) => market.G === 17
            );

            if (
              throwInsTotal &&
              throwInsTotal.E &&
              throwInsTotal.E.length >= 2
            ) {
              matchInfo.tempThrowInsData["Throw-ins - Total"] = {};

              // Process Over options
              if (throwInsTotal.E[0] && throwInsTotal.E[0].length > 0) {
                throwInsTotal.E[0].forEach((option) => {
                  if (option.P && option.C) {
                    matchInfo.tempThrowInsData["Throw-ins - Total"][
                      `Total Over (${option.P})`
                    ] = option.C;
                  }
                });
              }

              // Process Under options
              if (throwInsTotal.E[1] && throwInsTotal.E[1].length > 0) {
                throwInsTotal.E[1].forEach((option) => {
                  if (option.P && option.C) {
                    matchInfo.tempThrowInsData["Throw-ins - Total"][
                      `Total Under (${option.P})`
                    ] = option.C;
                  }
                });
              }
            }

            // Find the Throw-ins Home Team Total market (G: 15)
            const throwInsHomeTotal = throwInsResponse.data.Value.GE.find(
              (market) => market.G === 15
            );

            if (
              throwInsHomeTotal &&
              throwInsHomeTotal.E &&
              throwInsHomeTotal.E.length >= 2
            ) {
              // Extract Home Team Total odds for over and under
              matchInfo.tempThrowInsData["Throw-ins - Home Team Total"] = {};

              // Process Over options (T: 11)
              if (throwInsHomeTotal.E[0] && throwInsHomeTotal.E[0].length > 0) {
                throwInsHomeTotal.E[0].forEach((option) => {
                  if (option.P && option.C) {
                    matchInfo.tempThrowInsData["Throw-ins - Home Team Total"][
                      `Total Over (${option.P})`
                    ] = option.C;
                  }
                });
              }

              // Process Under options (T: 12)
              if (throwInsHomeTotal.E[1] && throwInsHomeTotal.E[1].length > 0) {
                throwInsHomeTotal.E[1].forEach((option) => {
                  if (option.P && option.C) {
                    matchInfo.tempThrowInsData["Throw-ins - Home Team Total"][
                      `Total Under (${option.P})`
                    ] = option.C;
                  }
                });
              }
            }

            // Find the Throw-ins Away Team Total market (G: 62)
            const throwInsAwayTotal = throwInsResponse.data.Value.GE.find(
              (market) => market.G === 62
            );

            if (
              throwInsAwayTotal &&
              throwInsAwayTotal.E &&
              throwInsAwayTotal.E.length >= 2
            ) {
              // Extract Away Team Total odds for over and under
              matchInfo.tempThrowInsData["Throw-ins - Away Team Total"] = {};

              // Process Over options (T: 13)
              if (throwInsAwayTotal.E[0] && throwInsAwayTotal.E[0].length > 0) {
                throwInsAwayTotal.E[0].forEach((option) => {
                  if (option.P && option.C) {
                    matchInfo.tempThrowInsData["Throw-ins - Away Team Total"][
                      `Total Over (${option.P})`
                    ] = option.C;
                  }
                });
              }

              // Process Under options (T: 14)
              if (throwInsAwayTotal.E[1] && throwInsAwayTotal.E[1].length > 0) {
                throwInsAwayTotal.E[1].forEach((option) => {
                  if (option.P && option.C) {
                    matchInfo.tempThrowInsData["Throw-ins - Away Team Total"][
                      `Total Under (${option.P})`
                    ] = option.C;
                  }
                });
              }
            }

            // Find the Throw-ins Handicap market (G: 2)
            const throwInsHandicap = throwInsResponse.data.Value.GE.find(
              (market) => market.G === 2
            );

            if (
              throwInsHandicap &&
              throwInsHandicap.E &&
              throwInsHandicap.E.length >= 2
            ) {
              // Extract Throw-ins Handicap odds for home and away teams
              matchInfo.tempThrowInsData["Throw-ins - Handicap"] = {};

              // Process Home team handicaps (T: 7)
              if (throwInsHandicap.E[0] && throwInsHandicap.E[0].length > 0) {
                throwInsHandicap.E[0].forEach((option) => {
                  const handicapValue = option.P !== undefined ? option.P : 0;
                  if (option.C) {
                    matchInfo.tempThrowInsData["Throw-ins - Handicap"][
                      `${data.Value.O1} (${handicapValue})`
                    ] = option.C;
                  }
                });
              }

              // Process Away team handicaps (T: 8)
              if (throwInsHandicap.E[1] && throwInsHandicap.E[1].length > 0) {
                throwInsHandicap.E[1].forEach((option) => {
                  const handicapValue = option.P !== undefined ? option.P : 0;
                  if (option.C) {
                    matchInfo.tempThrowInsData["Throw-ins - Handicap"][
                      `${data.Value.O2} (${handicapValue})`
                    ] = option.C;
                  }
                });
              }
            }
          }
        } catch (error) {
          console.error("Error fetching throw-ins data:", error.message);
        }
      }

      // Extract 1X2 market odds
      if (data.Value.GE && data.Value.GE.length > 0) {
        // Find the 1X2 market (G: 1)
        const market1X2 = data.Value.GE.find((market) => market.G === 1);

        if (market1X2 && market1X2.E && market1X2.E.length > 0) {
          matchInfo.odds["1X2"] = {
            W1:
              market1X2.E[0] && market1X2.E[0][0] ? market1X2.E[0][0].C : null,
            X: market1X2.E[1] && market1X2.E[1][0] ? market1X2.E[1][0].C : null,
            W2:
              market1X2.E[2] && market1X2.E[2][0] ? market1X2.E[2][0].C : null,
          };
        }

        // Find the Double Chance market (G: 8)
        const marketDoubleChance = data.Value.GE.find(
          (market) => market.G === 8
        );

        if (
          marketDoubleChance &&
          marketDoubleChance.E &&
          marketDoubleChance.E.length > 0
        ) {
          matchInfo.odds["Double Chance"] = {
            "1X":
              marketDoubleChance.E[0] && marketDoubleChance.E[0][0]
                ? marketDoubleChance.E[0][0].C
                : null,
            12:
              marketDoubleChance.E[1] && marketDoubleChance.E[1][0]
                ? marketDoubleChance.E[1][0].C
                : null,
            X2:
              marketDoubleChance.E[2] && marketDoubleChance.E[2][0]
                ? marketDoubleChance.E[2][0].C
                : null,
          };
        }

        // Find the Total (Over/Under) market (G: 17)
        const marketTotal = data.Value.GE.find((market) => market.G === 17);

        if (marketTotal && marketTotal.E && marketTotal.E.length >= 2) {
          // Extract Over/Under odds for different goal lines
          matchInfo.odds["Total"] = {};

          // Process Over options (T: 9)
          if (marketTotal.E[0] && marketTotal.E[0].length > 0) {
            marketTotal.E[0].forEach((option) => {
              if (option.P && option.C) {
                matchInfo.odds["Total"][`Total Over (${option.P})`] = option.C;
              }
            });
          }

          // Process Under options (T: 10)
          if (marketTotal.E[1] && marketTotal.E[1].length > 0) {
            marketTotal.E[1].forEach((option) => {
              if (option.P && option.C) {
                matchInfo.odds["Total"][`Total Under (${option.P})`] = option.C;
              }
            });
          }
        }

        // Find the Handicap market (G: 2)
        const marketHandicap = data.Value.GE.find((market) => market.G === 2);

        if (
          marketHandicap &&
          marketHandicap.E &&
          marketHandicap.E.length >= 2
        ) {
          // Extract Handicap odds for home and away teams
          matchInfo.odds["Handicap"] = {};

          // Process Home team handicaps (T: 7)
          if (marketHandicap.E[0] && marketHandicap.E[0].length > 0) {
            marketHandicap.E[0].forEach((option) => {
              const handicapValue = option.P !== undefined ? option.P : 0;
              if (option.C) {
                matchInfo.odds["Handicap"][
                  `${data.Value.O1} (${handicapValue})`
                ] = option.C;
              }
            });
          }

          // Process Away team handicaps (T: 8)
          if (marketHandicap.E[1] && marketHandicap.E[1].length > 0) {
            marketHandicap.E[1].forEach((option) => {
              const handicapValue = option.P !== undefined ? option.P : 0;
              if (option.C) {
                matchInfo.odds["Handicap"][
                  `${data.Value.O2} (${handicapValue})`
                ] = option.C;
              }
            });
          }
        }

        // Find the Asian Handicap market (G: 2854)
        const marketAsianHandicap = data.Value.GE.find(
          (market) => market.G === 2854
        );

        if (
          marketAsianHandicap &&
          marketAsianHandicap.E &&
          marketAsianHandicap.E.length >= 2
        ) {
          // Extract Asian Handicap odds for home and away teams
          matchInfo.odds["Asian Handicap"] = {};

          // Process Home team Asian handicaps (T: 3829)
          if (marketAsianHandicap.E[0] && marketAsianHandicap.E[0].length > 0) {
            marketAsianHandicap.E[0].forEach((option) => {
              const handicapValue = option.P !== undefined ? option.P : 0;
              if (option.C) {
                matchInfo.odds["Asian Handicap"][
                  `${data.Value.O1} (${handicapValue})`
                ] = option.C;
              }
            });
          }

          // Process Away team Asian handicaps (T: 3830)
          if (marketAsianHandicap.E[1] && marketAsianHandicap.E[1].length > 0) {
            marketAsianHandicap.E[1].forEach((option) => {
              const handicapValue = option.P !== undefined ? option.P : 0;
              if (option.C) {
                matchInfo.odds["Asian Handicap"][
                  `${data.Value.O2} (${handicapValue})`
                ] = option.C;
              }
            });
          }
        }

        // Find the Home Team Total market (G: 15)
        const marketHomeTotal = data.Value.GE.find((market) => market.G === 15);

        if (
          marketHomeTotal &&
          marketHomeTotal.E &&
          marketHomeTotal.E.length >= 2
        ) {
          // Extract Home Team Total odds for over and under
          matchInfo.odds["Home Team Total"] = {};

          // Process Over options (T: 11)
          if (marketHomeTotal.E[0] && marketHomeTotal.E[0].length > 0) {
            marketHomeTotal.E[0].forEach((option) => {
              if (option.P && option.C) {
                matchInfo.odds["Home Team Total"][`Total Over (${option.P})`] =
                  option.C;
              }
            });
          }

          // Process Under options (T: 12)
          if (marketHomeTotal.E[1] && marketHomeTotal.E[1].length > 0) {
            marketHomeTotal.E[1].forEach((option) => {
              if (option.P && option.C) {
                matchInfo.odds["Home Team Total"][`Total Under (${option.P})`] =
                  option.C;
              }
            });
          }
        }

        // Find the Away Team Total market (G: 62)
        const marketAwayTotal = data.Value.GE.find((market) => market.G === 62);

        if (
          marketAwayTotal &&
          marketAwayTotal.E &&
          marketAwayTotal.E.length >= 2
        ) {
          // Extract Away Team Total odds for over and under
          matchInfo.odds["Away Team Total"] = {};

          // Process Over options (T: 13)
          if (marketAwayTotal.E[0] && marketAwayTotal.E[0].length > 0) {
            marketAwayTotal.E[0].forEach((option) => {
              if (option.P && option.C) {
                matchInfo.odds["Away Team Total"][`Total Over (${option.P})`] =
                  option.C;
              }
            });
          }

          // Process Under options (T: 14)
          if (marketAwayTotal.E[1] && marketAwayTotal.E[1].length > 0) {
            marketAwayTotal.E[1].forEach((option) => {
              if (option.P && option.C) {
                matchInfo.odds["Away Team Total"][`Total Under (${option.P})`] =
                  option.C;
              }
            });
          }
        }
      }
    }

    // Add corners data at the end of the odds object
    if (matchInfo.tempCornersData) {
      // Add each corners market directly to the odds object (not nested)
      Object.keys(matchInfo.tempCornersData).forEach((key) => {
        matchInfo.odds[key] = matchInfo.tempCornersData[key];
      });

      // Remove the temporary corners data
      delete matchInfo.tempCornersData;
    }

    // Add yellow cards data at the end of the odds object
    if (matchInfo.tempYellowCardsData) {
      // Add each yellow cards market directly to the odds object (not nested)
      Object.keys(matchInfo.tempYellowCardsData).forEach((key) => {
        matchInfo.odds[key] = matchInfo.tempYellowCardsData[key];
      });

      // Remove the temporary yellow cards data
      delete matchInfo.tempYellowCardsData;
    }

    // Add fouls data at the end of the odds object
    if (matchInfo.tempFoulsData) {
      // Add each fouls market directly to the odds object (not nested)
      Object.keys(matchInfo.tempFoulsData).forEach((key) => {
        matchInfo.odds[key] = matchInfo.tempFoulsData[key];
      });

      // Remove the temporary fouls data
      delete matchInfo.tempFoulsData;
    }

    // Add offsides data at the end of the odds object
    if (matchInfo.tempOffsidesData) {
      // Add each offsides market directly to the odds object (not nested)
      Object.keys(matchInfo.tempOffsidesData).forEach((key) => {
        matchInfo.odds[key] = matchInfo.tempOffsidesData[key];
      });

      // Remove the temporary offsides data
      delete matchInfo.tempOffsidesData;
    }

    // Add throw-ins data at the end of the odds object
    if (matchInfo.tempThrowInsData) {
      // Add each throw-ins market directly to the odds object (not nested)
      Object.keys(matchInfo.tempThrowInsData).forEach((key) => {
        matchInfo.odds[key] = matchInfo.tempThrowInsData[key];
      });

      // Remove the temporary throw-ins data
      delete matchInfo.tempThrowInsData;
    }

    return matchInfo;
  }
}

// Export the functions for use in other files
module.exports = {
  fetch1xBetData,
};
