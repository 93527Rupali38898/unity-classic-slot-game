using System;
using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using SlotGame.Core;
using SlotGame.Logic;

namespace SlotGame.Reels
{
    /// <summary>
    /// Master coordinator for all reel columns.
    /// Manages staggered stopping, anticipation / suspense detection,
    /// audio cues, and outcome aggregation.
    /// </summary>
    public class ReelController : MonoBehaviour
    {
        [Header("Reel Columns")]
        [SerializeField] private List<ReelStrip> reels = new List<ReelStrip>();

        public event Action<int, SymbolType> OnIndividualReelStopped;
        public event Action<SymbolType[]> OnAllReelsStopped;
        public event Action OnSuspenseStarted;

        private SlotMachineConfig _config;
        private RNGService _rng;
        private SymbolType[] _currentOutcome;
        private int _stoppedReelCount = 0;
        private Coroutine _stoppingSequenceRoutine;

        public bool IsSpinning { get; private set; }

        public void Initialize(SlotMachineConfig config, RNGService rng, Dictionary<SymbolType, Sprite> symbolSprites)
        {
            _config = config;
            _rng = rng;

            for (int i = 0; i < reels.Count; i++)
            {
                int index = i;
                reels[i].Initialize(index, config, rng, symbolSprites);
                reels[i].OnReelStopped += HandleReelStopped;
            }
        }

        public void SpinReels(SymbolType[] targetOutcome)
        {
            if (IsSpinning) return;

            IsSpinning = true;
            _stoppedReelCount = 0;
            _currentOutcome = targetOutcome;

            // Start all reels spinning
            for (int i = 0; i < reels.Count; i++)
            {
                reels[i].StartSpin();
            }

            if (_stoppingSequenceRoutine != null)
                StopCoroutine(_stoppingSequenceRoutine);

            _stoppingSequenceRoutine = StartCoroutine(StaggeredStopSequence());
        }

        private IEnumerator StaggeredStopSequence()
        {
            // Allow minimum spin time
            yield return new WaitForSeconds(_config.minFullSpeedDuration);

            // Reel 0 stops
            reels[0].RequestStop(_currentOutcome[0]);

            // Stagger delay for Reel 1
            yield return new WaitForSeconds(_config.reelStopDelay);
            reels[1].RequestStop(_currentOutcome[1]);

            // Check for Suspense Anticipation before stopping Reel 2!
            // If reels 0 and 1 match, we have potential for a 3-of-a-kind jackpot/win!
            bool potentialBigWin = (_currentOutcome.Length >= 3 && _currentOutcome[0] == _currentOutcome[1]);
            if (potentialBigWin)
            {
                OnSuspenseStarted?.Invoke();
                yield return new WaitForSeconds(_config.suspenseDelay);
            }
            else
            {
                yield return new WaitForSeconds(_config.reelStopDelay);
            }

            if (reels.Count > 2)
            {
                reels[2].RequestStop(_currentOutcome[2]);
            }
        }

        private void HandleReelStopped(int reelIndex, SymbolType landedSymbol)
        {
            OnIndividualReelStopped?.Invoke(reelIndex, landedSymbol);

            _stoppedReelCount++;
            if (_stoppedReelCount >= reels.Count)
            {
                IsSpinning = false;
                OnAllReelsStopped?.Invoke(_currentOutcome);
            }
        }

        public void HighlightWins(List<int> winningReelIndices)
        {
            if (winningReelIndices == null || winningReelIndices.Count == 0)
            {
                // Highlight all reels
                for (int i = 0; i < reels.Count; i++)
                {
                    reels[i].HighlightWinningCenterSymbol();
                }
            }
            else
            {
                foreach (int idx in winningReelIndices)
                {
                    if (idx >= 0 && idx < reels.Count)
                    {
                        reels[idx].HighlightWinningCenterSymbol();
                    }
                }
            }
        }
    }
}
