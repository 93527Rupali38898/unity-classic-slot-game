using UnityEngine;
using UnityEngine.UI;
using SlotGame.Logic;

namespace SlotGame.UI
{
    /// <summary>
    /// Master UI manager orchestrating the player HUD, balance, bets,
    /// win announcements, and popups.
    /// </summary>
    public class UIManager : MonoBehaviour
    {
        [Header("HUD Displays")]
        [SerializeField] private Text balanceText;
        [SerializeField] private Text betText;
        [SerializeField] private Text winText;
        [SerializeField] private Text statusMessageText;
        [SerializeField] private GameObject freeSpinsBanner;
        [SerializeField] private Text freeSpinsCountText;

        [Header("Sub-Controllers")]
        [SerializeField] private SpinButtonController spinButtonController;
        [SerializeField] private AnimatedLever animatedLever;
        [SerializeField] private PaytableModal paytableModal;
        [SerializeField] private WinCelebrationPopup winPopup;

        public SpinButtonController SpinControls => spinButtonController;
        public AnimatedLever Lever => animatedLever;
        public WinCelebrationPopup WinPopup => winPopup;
        public PaytableModal Paytable => paytableModal;

        public void UpdateBalance(int balance)
        {
            if (balanceText != null)
                balanceText.text = $"CREDITS: {balance:N0}";
        }

        public void UpdateBet(int bet)
        {
            if (betText != null)
                betText.text = $"BET: {bet:N0}";
        }

        public void UpdateWin(int win)
        {
            if (winText != null)
                winText.text = $"WIN: {win:N0}";
        }

        public void SetStatusMessage(string message, Color? color = null)
        {
            if (statusMessageText != null)
            {
                statusMessageText.text = message;
                statusMessageText.color = color ?? Color.white;
            }
        }

        public void UpdateFreeSpinsUI(bool active, int remainingSpins)
        {
            if (freeSpinsBanner != null)
                freeSpinsBanner.SetActive(active);

            if (freeSpinsCountText != null)
                freeSpinsCountText.text = $"FREE SPINS: {remainingSpins}";
        }

        public void SetControlsInteractable(bool interactable)
        {
            if (spinButtonController != null)
                spinButtonController.SetInteractable(interactable);

            if (animatedLever != null)
                animatedLever.IsInteractable = interactable;
        }
    }
}

