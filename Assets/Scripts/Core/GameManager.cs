using System.Collections;
using System.Collections.Generic;
using UnityEngine;
using SlotGame.Audio;
using SlotGame.Logic;
using SlotGame.Reels;
using SlotGame.UI;

namespace SlotGame.Core
{
    public enum GameState
    {
        Idle,
        Spinning,
        Evaluating,
        Celebration,
        FreeSpins
    }

    /// <summary>
    /// Central game manager coordinating player economy, state transitions,
    /// RNG outcome generation, payline evaluation, and auto-spin loops.
    /// </summary>
    public class GameManager : MonoBehaviour
    {
        public static GameManager Instance { get; private set; }

        [Header("Configuration")]
        [SerializeField] private SlotMachineConfig config;

        [Header("Scene References")]
        [SerializeField] private ReelController reelController;
        [SerializeField] private UIManager uiManager;

        [Header("Symbol Sprites")]
        [SerializeField] private Sprite cherrySprite;
        [SerializeField] private Sprite bellSprite;
        [SerializeField] private Sprite barSprite;
        [SerializeField] private Sprite sevenSprite;

        public GameState CurrentState { get; private set; } = GameState.Idle;
        public int Balance { get; private set; }
        public int CurrentBet { get; private set; }
        public int RemainingFreeSpins { get; private set; } = 0;
        public bool IsAutoSpinActive { get; private set; } = false;

        private RNGService _rng;
        private PayoutEvaluator _evaluator;
        private Dictionary<SymbolType, Sprite> _symbolSprites;
        private Coroutine _autoSpinRoutine;

        private void Awake()
        {
            if (Instance != null && Instance != this)
            {
                Destroy(gameObject);
                return;
            }
            Instance = this;

            InitializeConfigAndServices();
        }

        private void Start()
        {
            InitializeGame();
        }

        private void InitializeConfigAndServices()
        {
            if (config == null)
            {
                config = ScriptableObject.CreateInstance<SlotMachineConfig>();
            }

            // Map sprite dictionary
            _symbolSprites = new Dictionary<SymbolType, Sprite>
            {
                { SymbolType.Cherry, cherrySprite },
                { SymbolType.Bell, bellSprite },
                { SymbolType.Bar, barSprite },
                { SymbolType.Seven, sevenSprite }
            };

            _rng = new RNGService(config.symbolWeights);
            _evaluator = new PayoutEvaluator(config);

            Balance = config.startingBalance;
            CurrentBet = config.defaultBet;
        }

        private void InitializeGame()
        {
            if (reelController != null)
            {
                reelController.Initialize(config, _rng, _symbolSprites);
                reelController.OnIndividualReelStopped += HandleIndividualReelStopped;
                reelController.OnSuspenseStarted += HandleSuspenseStarted;
                reelController.OnAllReelsStopped += HandleAllReelsStopped;
            }

            if (uiManager != null)
            {
                uiManager.UpdateBalance(Balance);
                uiManager.UpdateBet(CurrentBet);
                uiManager.UpdateWin(0);
                uiManager.SetStatusMessage("PULL LEVER OR CLICK SPIN TO PLAY!");
                uiManager.UpdateFreeSpinsUI(false, 0);

                // Subscribe to UI events
                uiManager.SpinControls.OnSpinClicked += RequestSpin;
                uiManager.SpinControls.OnAutoSpinToggled += ToggleAutoSpin;
                uiManager.SpinControls.OnBetIncreased += IncreaseBet;
                uiManager.SpinControls.OnBetDecreased += DecreaseBet;
                uiManager.SpinControls.OnMaxBetClicked += SetMaxBet;

                if (uiManager.Lever != null)
                    uiManager.Lever.OnLeverPulled += RequestSpin;

                if (uiManager.WinPopup != null)
                    uiManager.WinPopup.OnClosed += HandleCelebrationClosed;
            }
        }

        public void RequestSpin()
        {
            if (CurrentState != GameState.Idle && CurrentState != GameState.FreeSpins)
                return;

            bool isFreeSpin = RemainingFreeSpins > 0;

            if (!isFreeSpin && Balance < CurrentBet)
            {
                uiManager.SetStatusMessage("INSUFFICIENT CREDITS! LOWER BET OR RECHARGE.", Color.red);
                StopAutoSpin();
                return;
            }

            // Deduct bet if not a free spin
            if (!isFreeSpin)
            {
                Balance -= CurrentBet;
            }
            else
            {
                RemainingFreeSpins--;
                uiManager.UpdateFreeSpinsUI(true, RemainingFreeSpins);
            }

            CurrentState = GameState.Spinning;
            uiManager.UpdateBalance(Balance);
            uiManager.UpdateWin(0);
            uiManager.SetControlsInteractable(false);
            uiManager.SetStatusMessage(isFreeSpin ? $"FREE SPIN IN PROGRESS! ({RemainingFreeSpins} REMAINING)" : "GOOD LUCK! REELS SPINNING...", Color.yellow);

            if (SoundManager.Instance != null)
                SoundManager.Instance.PlaySpinLoop();

            // Generate fair outcome via RNG
            SymbolType[] outcome = _rng.GenerateOutcome(config.reelCount);
            reelController.SpinReels(outcome);
        }

        private void HandleIndividualReelStopped(int reelIndex, SymbolType landedSymbol)
        {
            if (SoundManager.Instance != null)
            {
                SoundManager.Instance.PlayReelStop(reelIndex);
            }
        }

        private void HandleSuspenseStarted()
        {
            uiManager.SetStatusMessage("MATCH DETECTED! SUSPENSE BUILDING...", new Color(1f, 0.8f, 0.2f));
        }

        private void HandleAllReelsStopped(SymbolType[] outcome)
        {
            if (SoundManager.Instance != null)
                SoundManager.Instance.StopSpinLoop();

            CurrentState = GameState.Evaluating;

            int bonusMultiplier = RemainingFreeSpins > 0 ? config.freeSpinsMultiplier : 1;
            SpinResult result = _evaluator.Evaluate(outcome, CurrentBet, bonusMultiplier);

            if (result.isWin)
            {
                Balance += result.winAmount;
                uiManager.UpdateBalance(Balance);
                uiManager.UpdateWin(result.winAmount);

                reelController.HighlightWins(null);

                // Handle Free Spins trigger
                if (result.triggersFreeSpins)
                {
                    RemainingFreeSpins += result.freeSpinsAwarded;
                    uiManager.UpdateFreeSpinsUI(true, RemainingFreeSpins);
                }

                // If jackpot or large win, open celebration popup
                if (result.isJackpot || result.baseMultiplier >= 25)
                {
                    CurrentState = GameState.Celebration;
                    uiManager.SetStatusMessage(result.winTitle, new Color(1f, 0.85f, 0.2f));
                    uiManager.WinPopup.Show(result.winTitle, result.winAmount, result.isJackpot);
                    return; // Wait for popup to close
                }
                else
                {
                    if (SoundManager.Instance != null)
                        SoundManager.Instance.PlayWin();
                    uiManager.SetStatusMessage($"{result.winTitle}! WON {result.winAmount:N0} CREDITS!", Color.green);
                }
            }
            else
            {
                uiManager.SetStatusMessage("TRY AGAIN! FORTUNE FAVORS THE BOLD.");
            }

            FinalizeSpinLifecycle();
        }

        private void HandleCelebrationClosed()
        {
            FinalizeSpinLifecycle();
        }

        private void FinalizeSpinLifecycle()
        {
            if (RemainingFreeSpins > 0)
            {
                CurrentState = GameState.FreeSpins;
                uiManager.SetControlsInteractable(false);
                StartCoroutine(AutoSpinNextTick(1.2f));
                return;
            }

            uiManager.UpdateFreeSpinsUI(false, 0);
            CurrentState = GameState.Idle;
            uiManager.SetControlsInteractable(true);

            if (IsAutoSpinActive)
            {
                StartCoroutine(AutoSpinNextTick(1.5f));
            }
        }

        private IEnumerator AutoSpinNextTick(float delay)
        {
            yield return new WaitForSeconds(delay);
            if (IsAutoSpinActive || RemainingFreeSpins > 0)
            {
                RequestSpin();
            }
        }

        public void ToggleAutoSpin()
        {
            IsAutoSpinActive = !IsAutoSpinActive;
            uiManager.SpinControls.SetAutoSpin(IsAutoSpinActive);

            if (IsAutoSpinActive && CurrentState == GameState.Idle)
            {
                RequestSpin();
            }
        }

        public void StopAutoSpin()
        {
            IsAutoSpinActive = false;
            if (uiManager != null && uiManager.SpinControls != null)
                uiManager.SpinControls.SetAutoSpin(false);
        }

        public void IncreaseBet()
        {
            if (CurrentState != GameState.Idle) return;
            CurrentBet = Mathf.Min(CurrentBet + config.betStep, config.maxBet);
            uiManager.UpdateBet(CurrentBet);
        }

        public void DecreaseBet()
        {
            if (CurrentState != GameState.Idle) return;
            CurrentBet = Mathf.Max(CurrentBet - config.betStep, config.minBet);
            uiManager.UpdateBet(CurrentBet);
        }

        public void SetMaxBet()
        {
            if (CurrentState != GameState.Idle) return;
            CurrentBet = config.maxBet;
            uiManager.UpdateBet(CurrentBet);
        }
    }
}
