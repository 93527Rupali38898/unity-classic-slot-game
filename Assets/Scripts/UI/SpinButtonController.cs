using System;
using UnityEngine;
using UnityEngine.UI;
using SlotGame.Audio;

namespace SlotGame.UI
{
    /// <summary>
    /// Controls the spin button and betting interface with full sprite state swapping,
    /// auto-spin toggling, and bet increment/decrement management.
    /// </summary>
    public class SpinButtonController : MonoBehaviour
    {
        [Header("Spin Button")]
        [SerializeField] private Button spinButton;
        [SerializeField] private Image spinButtonImage;
        [SerializeField] private Sprite normalSprite;
        [SerializeField] private Sprite hoverSprite;
        [SerializeField] private Sprite pressedSprite;
        [SerializeField] private Sprite disabledSprite;

        [Header("Control Buttons")]
        [SerializeField] private Button autoSpinButton;
        [SerializeField] private Text autoSpinText;
        [SerializeField] private Button betPlusButton;
        [SerializeField] private Button betMinusButton;
        [SerializeField] private Button maxBetButton;

        public event Action OnSpinClicked;
        public event Action OnAutoSpinToggled;
        public event Action OnBetIncreased;
        public event Action OnBetDecreased;
        public event Action OnMaxBetClicked;

        private bool _isAutoSpinActive = false;

        private void Awake()
        {
            if (spinButton != null)
                spinButton.onClick.AddListener(HandleSpinClick);
            if (autoSpinButton != null)
                autoSpinButton.onClick.AddListener(HandleAutoSpinClick);
            if (betPlusButton != null)
                betPlusButton.onClick.AddListener(HandleBetPlusClick);
            if (betMinusButton != null)
                betMinusButton.onClick.AddListener(HandleBetMinusClick);
            if (maxBetButton != null)
                maxBetButton.onClick.AddListener(HandleMaxBetClick);
        }

        private void HandleSpinClick()
        {
            if (SoundManager.Instance != null)
                SoundManager.Instance.PlayButtonClick();
            OnSpinClicked?.Invoke();
        }

        private void HandleAutoSpinClick()
        {
            if (SoundManager.Instance != null)
                SoundManager.Instance.PlayButtonClick();
            _isAutoSpinActive = !_isAutoSpinActive;
            UpdateAutoSpinUI();
            OnAutoSpinToggled?.Invoke();
        }

        private void HandleBetPlusClick()
        {
            if (SoundManager.Instance != null)
                SoundManager.Instance.PlayButtonClick();
            OnBetIncreased?.Invoke();
        }

        private void HandleBetMinusClick()
        {
            if (SoundManager.Instance != null)
                SoundManager.Instance.PlayButtonClick();
            OnBetDecreased?.Invoke();
        }

        private void HandleMaxBetClick()
        {
            if (SoundManager.Instance != null)
                SoundManager.Instance.PlayButtonClick();
            OnMaxBetClicked?.Invoke();
        }

        public void SetAutoSpin(bool active)
        {
            _isAutoSpinActive = active;
            UpdateAutoSpinUI();
        }

        private void UpdateAutoSpinUI()
        {
            if (autoSpinText != null)
            {
                autoSpinText.text = _isAutoSpinActive ? "AUTO [ON]" : "AUTO [OFF]";
                autoSpinText.color = _isAutoSpinActive ? new Color(0.2f, 1f, 0.4f) : Color.white;
            }
        }

        public void SetInteractable(bool interactable)
        {
            if (spinButton != null)
            {
                spinButton.interactable = interactable;
                if (spinButtonImage != null)
                {
                    spinButtonImage.sprite = interactable ? normalSprite : disabledSprite;
                }
            }

            if (betPlusButton != null) betPlusButton.interactable = interactable;
            if (betMinusButton != null) betMinusButton.interactable = interactable;
            if (maxBetButton != null) maxBetButton.interactable = interactable;
        }
    }
}
