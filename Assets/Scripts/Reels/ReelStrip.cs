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
    /// high-speed spinning, payline focus opacity dimming, and mechanical spring overshoot bounce.
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
            ApplyPaylineOpacityFocus();
        }

        private void BuildReelSymbols()
        {
            foreach (Transform child in container)
            {
                Destroy(child.gameObject);
            }
            _symbols.Clear();

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

            int centerIdx = totalSymbolInstances / 2;
            CenterSymbol = _symbols[centerIdx].CurrentSymbol;
        }

        public void StartSpin()
        {
            if (State != ReelState.Idle) return;

            // Restore full opacity and clear highlights during spin
            foreach (var sym in _symbols)
            {
                sym.StopWinPulse();
                sym.SetDimmed(false);
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

            // 1. Acceleration Phase
            while (elapsed < _config.accelerationDuration)
            {
                elapsed += Time.deltaTime;
                float t = elapsed / _config.accelerationDuration;
                _currentSpeed = Mathf.Lerp(0f, _config.maxSpinSpeed, t * t);
                MoveSymbols(_currentSpeed * Time.deltaTime);
                yield return null;
            }

            _currentSpeed = _config.maxSpinSpeed;
            State = ReelState.Spinning;
            elapsed = 0f;

            // 2. Full-speed Spin Phase
            while (!_stopRequested || elapsed < _config.minFullSpeedDuration)
            {
                elapsed += Time.deltaTime;
                MoveSymbols(_currentSpeed * Time.deltaTime);
                yield return null;
            }

            // 3. Deceleration Phase
            State = ReelState.Stopping;
            yield return StartCoroutine(DecelerateAndAlignToTarget());

            // 4. Elastic Overshoot & Spring Bounce
            State = ReelState.Bouncing;
            yield return StartCoroutine(MechanicalOvershootBounce());

            State = ReelState.Idle;
            CenterSymbol = _targetSymbol;

            // Dim neighboring non-payline symbols to emphasize the center outcome
            ApplyPaylineOpacityFocus();

            OnReelStopped?.Invoke(reelIndex, CenterSymbol);
        }

        private void MoveSymbols(float deltaY)
        {
            float bottomLimit = -(_symbolHeight * totalSymbolInstances) / 2f - (_symbolHeight * 0.5f);

            for (int i = 0; i < _symbols.Count; i++)
            {
                RectTransform rt = _symbols[i].GetComponent<RectTransform>();
                Vector2 pos = rt.anchoredPosition;
                pos.y -= deltaY;

                if (pos.y < bottomLimit)
                {
                    pos.y += (_symbolHeight * totalSymbolInstances);
                    SymbolType nextSym = _rng.GetRandomSymbol();
                    _symbols[i].SetSymbol(nextSym, _symbolSprites[nextSym]);
                }

                rt.anchoredPosition = pos;
            }
        }

        private IEnumerator DecelerateAndAlignToTarget()
        {
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

            targetSlot.SetSymbol(_targetSymbol, _symbolSprites[_targetSymbol]);

            RectTransform targetRT = targetSlot.GetComponent<RectTransform>();
            float distanceRemaining = targetRT.anchoredPosition.y;
            if (distanceRemaining < _symbolHeight * 2)
            {
                distanceRemaining += (_symbolHeight * totalSymbolInstances);
            }

            float initialDistance = distanceRemaining;
            float duration = _config.decelerationDuration;
            float elapsed = 0f;

            while (elapsed < duration)
            {
                elapsed += Time.deltaTime;
                float t = elapsed / duration;
                float easeOut = 1f - Mathf.Pow(1f - t, 3f);
                float stepTargetDist = (1f - easeOut) * initialDistance;
                float toMove = distanceRemaining - stepTargetDist;

                MoveSymbols(toMove);
                distanceRemaining = stepTargetDist;
                yield return null;
            }

            float finalOffset = targetRT.anchoredPosition.y;
            MoveSymbols(finalOffset);
        }

        private IEnumerator MechanicalOvershootBounce()
        {
            float bounceDuration = 0.22f;
            float overshoot = _config.bounceOvershoot;
            float elapsed = 0f;

            while (elapsed < bounceDuration)
            {
                elapsed += Time.deltaTime;
                float t = elapsed / bounceDuration;
                float offset = Mathf.Sin(t * Mathf.PI) * overshoot * Mathf.Exp(-t * 3f);

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

        /// <summary>
        /// Keeps the center payline symbol at full 100% opacity,
        /// while dimming the top and bottom neighboring symbols to 32% opacity.
        /// </summary>
        public void ApplyPaylineOpacityFocus()
        {
            foreach (var sym in _symbols)
            {
                float y = Mathf.Abs(sym.GetComponent<RectTransform>().anchoredPosition.y);
                bool isCenter = y < (_symbolHeight * 0.4f);
                sym.SetDimmed(!isCenter);
            }
        }

        public void HighlightWinningCenterSymbol()
        {
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
