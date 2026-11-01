using System;
using System.Collections.Generic;
using SlotGame.Core;

namespace SlotGame.Logic
{
    [Serializable]
    public class SpinResult
    {
        public bool isWin;
        public int winAmount;
        public int baseMultiplier;
        public int effectiveMultiplier;
        public SymbolType? winningSymbol;
        public string winTitle;
        public bool isJackpot;
        public bool triggersFreeSpins;
        public int freeSpinsAwarded;
    }

    /// <summary>
    /// Evaluates payline symbol combinations against the configured paytable rules.
    /// Supports full matching (3-of-a-kind), partial matching (2 Cherries),
    /// Jackpot detection, and Free Spins triggers.
    /// </summary>
    public class PayoutEvaluator
    {
        private readonly SlotMachineConfig _config;

        public PayoutEvaluator(SlotMachineConfig config)
        {
            _config = config ?? throw new ArgumentNullException(nameof(config));
        }

        /// <summary>
        /// Evaluates the center payline outcome.
        /// </summary>
        /// <param name="outcome">Symbols stopping on the center payline.</param>
        /// <param name="betAmount">Current active bet.</param>
        /// <param name="activeBonusMultiplier">Bonus multiplier (e.g., 2 during Free Spins).</param>
        /// <returns>SpinResult with comprehensive win details.</returns>
        public SpinResult Evaluate(SymbolType[] outcome, int betAmount, int activeBonusMultiplier = 1)
        {
            var result = new SpinResult
            {
                isWin = false,
                winAmount = 0,
                baseMultiplier = 0,
                effectiveMultiplier = 0,
                winningSymbol = null,
                winTitle = "No Win",
                isJackpot = false,
                triggersFreeSpins = false,
                freeSpinsAwarded = 0
            };

            if (outcome == null || outcome.Length == 0)
                return result;

            int reelCount = outcome.Length;

            // Count occurrences of each symbol
            var counts = new Dictionary<SymbolType, int>();
            foreach (var s in outcome)
            {
                if (!counts.ContainsKey(s))
                    counts[s] = 0;
                counts[s]++;
            }

            // 1. Check for 3-of-a-kind match (Full row matching)
            bool allMatch = true;
            SymbolType first = outcome[0];
            for (int i = 1; i < reelCount; i++)
            {
                if (outcome[i] != first)
                {
                    allMatch = false;
                    break;
                }
            }

            if (allMatch)
            {
                int multiplier = GetMultiplier(first, reelCount);
                int totalMult = multiplier * Math.Max(1, activeBonusMultiplier);

                result.isWin = true;
                result.winningSymbol = first;
                result.baseMultiplier = multiplier;
                result.effectiveMultiplier = totalMult;
                result.winAmount = betAmount * totalMult;

                if (first == SymbolType.Seven)
                {
                    result.isJackpot = true;
                    result.winTitle = "GRAND JACKPOT! 777";
                    result.triggersFreeSpins = true;
                    result.freeSpinsAwarded = _config.freeSpinsAwarded;
                }
                else if (first == SymbolType.Bar)
                {
                    result.winTitle = "MEGA WIN! TRIPLE BAR";
                }
                else if (first == SymbolType.Bell)
                {
                    result.winTitle = "BIG WIN! GOLDEN BELLS";
                }
                else
                {
                    result.winTitle = "NICE WIN! CHERRIES";
                }

                return result;
            }

            // 2. Check for partial win condition: 2 Cherries anywhere on payline
            if (counts.ContainsKey(SymbolType.Cherry) && counts[SymbolType.Cherry] >= 2)
            {
                int multiplier = GetMultiplier(SymbolType.Cherry, 2);
                int totalMult = multiplier * Math.Max(1, activeBonusMultiplier);

                result.isWin = true;
                result.winningSymbol = SymbolType.Cherry;
                result.baseMultiplier = multiplier;
                result.effectiveMultiplier = totalMult;
                result.winAmount = betAmount * totalMult;
                result.winTitle = "MINI WIN! DOUBLE CHERRIES";
                return result;
            }

            return result;
        }

        private int GetMultiplier(SymbolType symbol, int matchCount)
        {
            foreach (var entry in _config.paytable)
            {
                if (entry.symbol == symbol && entry.matchCount == matchCount)
                {
                    return entry.payoutMultiplier;
                }
            }
            return 0;
        }
    }
}

