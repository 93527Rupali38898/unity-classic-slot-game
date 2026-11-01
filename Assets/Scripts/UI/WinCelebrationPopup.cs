using System;
using System.Collections;
using UnityEngine;
using UnityEngine.UI;
using SlotGame.Audio;

namespace SlotGame.UI
{
    /// <summary>
    /// Dramatic celebration modal for Jackpots and Big Wins,
    /// featuring animated score counting, particle effects, and coin audio chimes.
    /// </summary>
    public class WinCelebrationPopup : MonoBehaviour
    {
        [Header("Popup UI")]
        [SerializeField] private GameObject popupRoot;
        [SerializeField] private Text titleText;
        [SerializeField] private Text winAmountText;
        [SerializeField] private Button collectButton;

        public event Action OnClosed;

        private Coroutine _countRoutine;

        private void Awake()
        {
            if (collectButton != null)
                collectButton.onClick.AddListener(Close);

            if (popupRoot != null)
                popupRoot.SetActive(false);
        }

        public void Show(string title, int amount, bool isJackpot)
        {
            if (popupRoot != null)
                popupRoot.SetActive(true);

            if (titleText != null)
                titleText.text = title;

            if (_countRoutine != null)
                StopCoroutine(_countRoutine);

            _countRoutine = StartCoroutine(AnimateWinCount(amount, isJackpot));
        }

        private IEnumerator AnimateWinCount(int targetAmount, bool isJackpot)
        {
            float duration = isJackpot ? 2.5f : 1.5f;
            float elapsed = 0f;
            int current = 0;

            if (SoundManager.Instance != null)
            {
                if (isJackpot) SoundManager.Instance.PlayJackpot();
                else SoundManager.Instance.PlayWin();
            }

            while (elapsed < duration)
            {
                elapsed += Time.deltaTime;
                float t = elapsed / duration;
                current = (int)Mathf.Lerp(0, targetAmount, t);

                if (winAmountText != null)
                    winAmountText.text = $"+{current:N0} COINS";

                if (SoundManager.Instance != null && UnityEngine.Random.value < 0.3f)
                    SoundManager.Instance.PlayCoin();

                yield return null;
            }

            if (winAmountText != null)
                winAmountText.text = $"+{targetAmount:N0} COINS";
        }

        public void Close()
        {
            if (SoundManager.Instance != null)
                SoundManager.Instance.PlayButtonClick();

            if (popupRoot != null)
                popupRoot.SetActive(false);

            OnClosed?.Invoke();
        }
    }
}
