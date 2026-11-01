using System;
using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using SlotGame.Core;
using SlotGame.Logic;

namespace SlotGame.Reels
{
    public enum ReelState
    {
        Idle,
        Accelerating,
        Spinning,
        Stopping,
        Bouncing
    }

    /// <summary>
    /// Manages an individual vertical reel column.
    /// Implements infinite recycling of symbol instances, realistic acceleration,
    /// high-speed spinning, seamless target symbol placement, and mechanical spring overshoot bounce.
    /// </summary>
    public class ReelStrip : MonoBehaviour
    {
        [Header("Configuration")]
        [SerializeField] private int reelIndex;
        [SerializeField] private RectTransform container;
        [SerializeField] private ReelSymbol symbolPrefab;
        [SerializeField] private int totalSymbolInstances = 6;

        public event Action<int, SymbolType> OnReelStopped;

        public ReelState State { get; private set; } = ReelState.Idle;
        public SymbolType CenterSymbol { get; private set; }

        private SlotMachineConfig _config;
        private RNGService _rng;
        private Dictionary<SymbolType, Sprite> _symbolSprites;
        private List<ReelSymbol> _symbols = new List<ReelSymbol>();

        private float _symbolHeight;
        private float _currentSpeed = 0f;
        private SymbolType _targetSymbol;
        private bool _stopRequested = false;
        private Coroutine _spinRoutine;

        public void Initialize(int index, SlotMachineConfig config, RNGService rng, Dictionary<SymbolType, Sprite> sprites)
        {
            reelIndex = index;
            _config = config;
            _rng = rng;
            _symbolSprites = sprites;
            _symbolHeight = config.symbolHeight;

            if (container == null)
                container = GetComponent<RectTransform>();

            BuildReelSymbols();
        }

        private void BuildReelSymbols()
        {
            // Clear existing children if any
            foreach (Transform child in container)
            {
                Destroy(child.gameObject);
            }
            _symbols.Clear();

            // Instantiate vertical stack of symbols
            // Center row is at y = 0.
            // Stack from +top to -bottom
            float startY = (_symbolHeight * (totalSymbolInstances - 1)) / 2f;
            for (int i = 0; i < totalSymbolInstances; i++)
            {
                ReelSymbol sym = Instantiate(symbolPrefab, container);
                RectTransform rt = sym.GetComponent<RectTransform>();
                rt.anchoredPosition = new Vector2(0, startY - (i * _symbolHeight));

                SymbolType initialSymbol = _rng.GetRandomSymbol();
                sym.SetSymbol(initialSymbol, _symbolSprites[initialSymbol]);
                _symbols.Add(sym);
            }

            // Payline center symbol is index 2 or 3
            int centerIdx = totalSymbolInstances / 2;
            CenterSymbol = _symbols[centerIdx].CurrentSymbol;
        }

        public void StartSpin()
        {
            if (State != ReelState.Idle) return;

            // Reset any previous win highlights
            foreach (var sym in _symbols)
            {
                sym.StopWinPulse();
            }

            _stopRequested = false;
            if (_spinRoutine != null)
                StopCoroutine(_spinRoutine);

            _spinRoutine = StartCoroutine(SpinLifecycle());
        }

        public void RequestStop(SymbolType outcomeSymbol)
        {
            _targetSymbol = outcomeSymbol;
            _stopRequested = true;
        }

        private IEnumerator SpinLifecycle()
        {
            State = ReelState.Accelerating;
            float elapsed = 0f;

            // 1. Acceleration Phase (ease-in with anticipation)
            while (elapsed < _config.accelerationDuration)
            {
                elapsed += Time.deltaTime;
                float t = elapsed / _config.accelerationDuration;
                // Ease-in quad curve
                _currentSpeed = Mathf.Lerp(0f, _config.maxSpinSpeed, t * t);
                MoveSymbols(_currentSpeed * Time.deltaTime);
                yield return null;
            }

            _currentSpeed = _config.maxSpinSpeed;
            State = ReelState.Spinning;
            elapsed = 0f;

            // 2. Full-speed Spin Phase (spins until stop requested + min duration met)
            while (!_stopRequested || elapsed < _config.minFullSpeedDuration)
            {
                elapsed += Time.deltaTime;
                MoveSymbols(_currentSpeed * Time.deltaTime);
                yield return null;
            }

            // 3. Deceleration Phase: Inject target symbol and ease to target stop
            State = ReelState.Stopping;
            yield return StartCoroutine(DecelerateAndAlignToTarget());

            // 4. Elastic Overshoot & Spring Bounce
            State = ReelState.Bouncing;
            yield return StartCoroutine(MechanicalOvershootBounce());

            State = ReelState.Idle;
            CenterSymbol = _targetSymbol;
            OnReelStopped?.Invoke(reelIndex, CenterSymbol);
        }

        /// <summary>
        /// Moves all symbol RectTransforms downward and recycles symbols exiting the bottom.
        /// </summary>
        private void MoveSymbols(float deltaY)
        {
            float bottomLimit = -(_symbolHeight * totalSymbolInstances) / 2f - (_symbolHeight * 0.5f);
            float topReset = bottomLimit + (_symbolHeight * totalSymbolInstances);

            for (int i = 0; i < _symbols.Count; i++)
            {
                RectTransform rt = _symbols[i].GetComponent<RectTransform>();
                Vector2 pos = rt.anchoredPosition;
                pos.y -= deltaY;

                // When a symbol drops below bottomLimit, recycle it to top
                if (pos.y < bottomLimit)
                {
                    pos.y += (_symbolHeight * totalSymbolInstances);
                    // Assign a new random symbol as it re-enters top
                    SymbolType nextSym = _rng.GetRandomSymbol();
                    _symbols[i].SetSymbol(nextSym, _symbolSprites[nextSym]);
                }

                rt.anchoredPosition = pos;
            }
        }

        /// <summary>
        /// Smoothly decelerates the reel until the target symbol lands on the payline (y = 0).
        /// </summary>
        private IEnumerator DecelerateAndAlignToTarget()
        {
            // Pick a symbol in the upper queue to become the target
            // Find symbol currently above the center
            ReelSymbol targetSlot = null;
            float highestY = float.MinValue;
            foreach (var sym in _symbols)
            {
                float y = sym.GetComponent<RectTransform>().anchoredPosition.y;
                if (y > highestY)
                {
                    highestY = y;
                    targetSlot = sym;
                }
            }

            // Set this symbol to the target outcome
            targetSlot.SetSymbol(_targetSymbol, _symbolSprites[_targetSymbol]);

            // Calculate distance remaining for this symbol to reach center (y = 0)
            RectTransform targetRT = targetSlot.GetComponent<RectTransform>();
            float distanceRemaining = targetRT.anchoredPosition.y;
            if (distanceRemaining < _symbolHeight * 2)
            {
                // Ensure at least 2 full symbol steps for pleasant visual deceleration
                distanceRemaining += (_symbolHeight * totalSymbolInstances);
            }

            float initialDistance = distanceRemaining;
            float duration = _config.decelerationDuration;
            float elapsed = 0f;

            while (elapsed < duration)
            {
                elapsed += Time.deltaTime;
                float t = elapsed / duration;
                // Ease-out cubic curve: 1 - (1 - t)^3
                float easeOut = 1f - Mathf.Pow(1f - t, 3f);
                float stepTargetDist = (1f - easeOut) * initialDistance;
                float toMove = distanceRemaining - stepTargetDist;

                MoveSymbols(toMove);
                distanceRemaining = stepTargetDist;
                yield return null;
            }

            // Snap exactly to 0
            float finalOffset = targetRT.anchoredPosition.y;
            MoveSymbols(finalOffset);
        }

        /// <summary>
        /// Realistic mechanical slot bounce: overshoots downward and rebounds back up.
        /// </summary>
        private IEnumerator MechanicalOvershootBounce()
        {
            float bounceDuration = 0.22f;
            float overshoot = _config.bounceOvershoot;
            float elapsed = 0f;

            while (elapsed < bounceDuration)
            {
                elapsed += Time.deltaTime;
                float t = elapsed / bounceDuration;
                // Damped sine wave: sin(pi * t) * exp(-3t)
                float offset = Mathf.Sin(t * Mathf.PI) * overshoot * Mathf.Exp(-t * 3f);

                // Apply transient bounce offset to container
                if (container != null)
                {
                    container.anchoredPosition = new Vector2(0, -offset);
                }
                yield return null;
            }

            if (container != null)
            {
                container.anchoredPosition = Vector2.zero;
            }
        }

        public void HighlightWinningCenterSymbol()
        {
            // Find symbol closest to center y = 0
            ReelSymbol center = null;
            float minDistance = float.MaxValue;
            foreach (var sym in _symbols)
            {
                float dist = Mathf.Abs(sym.GetComponent<RectTransform>().anchoredPosition.y);
                if (dist < minDistance)
                {
                    minDistance = dist;
                    center = sym;
                }
            }

            if (center != null)
            {
                center.PlayWinPulse();
            }
        }
    }
}

