using System;
using System.Collections.Generic;
using UnityEngine;
using SlotGame.Logic;

namespace SlotGame.Core
{
    [Serializable]
    public class SymbolWeightConfig
    {
        public SymbolType symbol;
        [Tooltip("Relative probability weight. Higher = more frequent.")]
        [Range(1, 100)]
        public int weight = 25;
        public Sprite sprite;
    }

    [Serializable]
    public class PaytableEntry
    {
        public SymbolType symbol;
        public int matchCount = 3;
        [Tooltip("Multiplier applied to the active bet amount.")]
        public int payoutMultiplier;
        public string displayName;
    }

    /// <summary>
    /// ScriptableObject holding all configurable parameters for slot machine mechanics,
    /// economics, timing, and reel animation easing.
    /// </summary>
    [CreateAssetMenu(fileName = "SlotMachineConfig", menuName = "Slot Machine/Config", order = 1)]
    public class SlotMachineConfig : ScriptableObject
    {
        [Header("Reel Layout & Dimensions")]
        [Tooltip("Total number of spinning reel columns.")]
        public int reelCount = 3;
        [Tooltip("Number of visible symbols per reel window.")]
        public int visibleSymbolsPerReel = 3;
        [Tooltip("Height of each symbol tile in pixels.")]
        public float symbolHeight = 110f;
        [Tooltip("Width of each symbol tile in pixels.")]
        public float symbolWidth = 100f;

        [Header("Economy & Betting")]
        public int startingBalance = 1000;
        public int defaultBet = 10;
        public int minBet = 5;
        public int maxBet = 100;
        public int betStep = 5;

        [Header("Reel Animation Timings")]
        [Tooltip("Time in seconds to accelerate to peak spinning velocity.")]
        public float accelerationDuration = 0.3f;
        [Tooltip("Minimum duration in seconds a reel stays at full speed.")]
        public float minFullSpeedDuration = 1.0f;
        [Tooltip("Time in seconds to decelerate and snap onto the target symbol.")]
        public float decelerationDuration = 0.45f;
        [Tooltip("Staggered delay between consecutive reel stops.")]
        public float reelStopDelay = 0.35f;
        [Tooltip("Extra suspense delay before stopping Reel 3 if Reels 1 & 2 match.")]
        public float suspenseDelay = 0.8f;
        [Tooltip("Maximum spinning speed in pixels per second.")]
        public float maxSpinSpeed = 2200f;
        [Tooltip("Overshoot bounce distance in pixels for mechanical snap effect.")]
        public float bounceOvershoot = 28f;

        [Header("Probabilities & RNG Weights")]
        public List<SymbolWeightConfig> symbolWeights = new List<SymbolWeightConfig>
        {
            new SymbolWeightConfig { symbol = SymbolType.Cherry, weight = 40 },
            new SymbolWeightConfig { symbol = SymbolType.Bell, weight = 28 },
            new SymbolWeightConfig { symbol = SymbolType.Bar, weight = 20 },
            new SymbolWeightConfig { symbol = SymbolType.Seven, weight = 12 }
        };

        [Header("Payout Table Multipliers")]
        public List<PaytableEntry> paytable = new List<PaytableEntry>
        {
            new PaytableEntry { symbol = SymbolType.Seven, matchCount = 3, payoutMultiplier = 100, displayName = "Lucky 7s Jackpot" },
            new PaytableEntry { symbol = SymbolType.Bar, matchCount = 3, payoutMultiplier = 50, displayName = "Triple BAR" },
            new PaytableEntry { symbol = SymbolType.Bell, matchCount = 3, payoutMultiplier = 25, displayName = "Golden Bells" },
            new PaytableEntry { symbol = SymbolType.Cherry, matchCount = 3, payoutMultiplier = 10, displayName = "Cherry Trio" },
            new PaytableEntry { symbol = SymbolType.Cherry, matchCount = 2, payoutMultiplier = 3, displayName = "Double Cherries" }
        };

        [Header("Bonus Features")]
        [Tooltip("Number of free spins awarded on 3x Seven jackpot or bonus trigger.")]
        public int freeSpinsAwarded = 5;
        [Tooltip("Payout multiplier applied during Free Spins bonus mode.")]
        public int freeSpinsMultiplier = 2;
    }
}

