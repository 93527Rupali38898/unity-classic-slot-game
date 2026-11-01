using System;
using System.Collections.Generic;
using System.Security.Cryptography;
using SlotGame.Logic;

namespace SlotGame.Core
{
    /// <summary>
    /// Fair Random Number Generator (RNG) Service.
    /// Employs System.Security.Cryptography.RandomNumberGenerator for true unpredictability
    /// and tamper-proof outcome generation conforming to casino standards.
    /// </summary>
    public class RNGService
    {
        private readonly RandomNumberGenerator _cryptoRng;
        private readonly List<SymbolWeightConfig> _weights;
        private readonly int _totalWeight;

        public RNGService(List<SymbolWeightConfig> weights)
        {
            _cryptoRng = RandomNumberGenerator.Create();
            _weights = weights ?? throw new ArgumentNullException(nameof(weights));

            _totalWeight = 0;
            foreach (var item in _weights)
            {
                _totalWeight += item.weight;
            }

            if (_totalWeight <= 0)
            {
                throw new InvalidOperationException("Total symbol weight must be greater than zero.");
            }
        }

        /// <summary>
        /// Generates a random integer in the range [min, max) using cryptographic randomness.
        /// </summary>
        public int NextInt(int min, int max)
        {
            if (min >= max)
                throw new ArgumentOutOfRangeException(nameof(min), "min must be strictly less than max.");

            long range = (long)max - min;
            byte[] buffer = new byte[4];
            _cryptoRng.GetBytes(buffer);
            uint randomUInt = BitConverter.ToUInt32(buffer, 0);

            return (int)(min + (randomUInt % range));
        }

        /// <summary>
        /// Selects a random symbol according to configured weights.
        /// </summary>
        public SymbolType GetRandomSymbol()
        {
            int roll = NextInt(0, _totalWeight);
            int cumulative = 0;

            for (int i = 0; i < _weights.Count; i++)
            {
                cumulative += _weights[i].weight;
                if (roll < cumulative)
                {
                    return _weights[i].symbol;
                }
            }

            return _weights[_weights.Count - 1].symbol;
        }

        /// <summary>
        /// Generates the target symbol outcomes for all reels on a spin.
        /// </summary>
        public SymbolType[] GenerateOutcome(int reelCount)
        {
            SymbolType[] outcome = new SymbolType[reelCount];
            for (int i = 0; i < reelCount; i++)
            {
                outcome[i] = GetRandomSymbol();
            }
            return outcome;
        }

        /// <summary>
        /// Deterministic forced outcome generator for testing and validation.
        /// </summary>
        public SymbolType[] GenerateForcedOutcome(SymbolType symbol, int reelCount)
        {
            SymbolType[] outcome = new SymbolType[reelCount];
            for (int i = 0; i < reelCount; i++)
            {
                outcome[i] = symbol;
            }
            return outcome;
        }
    }
}
