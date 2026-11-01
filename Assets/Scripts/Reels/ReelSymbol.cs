using System.Collections;
using UnityEngine;
using UnityEngine.UI;
using SlotGame.Logic;

namespace SlotGame.Reels
{
    /// <summary>
    /// Visual component representing a single symbol on a reel.
    /// Supports sprite assignment, win highlighting, and scale pulsation.
    /// </summary>
    public class ReelSymbol : MonoBehaviour
    {
        [SerializeField] private Image symbolImage;
        [SerializeField] private RectTransform rectTransform;

        public SymbolType CurrentSymbol { get; private set; }
        private Coroutine _pulseRoutine;
        private Vector3 _originalScale;

        private void Awake()
        {
            if (rectTransform == null)
                rectTransform = GetComponent<RectTransform>();
            if (symbolImage == null)
                symbolImage = GetComponentInChildren<Image>();

            _originalScale = rectTransform != null ? rectTransform.localScale : Vector3.one;
        }

        public void SetSymbol(SymbolType symbol, Sprite sprite)
        {
            CurrentSymbol = symbol;
            if (symbolImage != null && sprite != null)
            {
                symbolImage.sprite = sprite;
                symbolImage.enabled = true;
            }
        }

        public void PlayWinPulse()
        {
            StopWinPulse();
            _pulseRoutine = StartCoroutine(PulseAnimation());
        }

        public void StopWinPulse()
        {
            if (_pulseRoutine != null)
            {
                StopCoroutine(_pulseRoutine);
                _pulseRoutine = null;
            }
            if (rectTransform != null)
            {
                rectTransform.localScale = _originalScale;
            }
            if (symbolImage != null)
            {
                symbolImage.color = Color.white;
            }
        }

        private IEnumerator PulseAnimation()
        {
            float duration = 0.5f;
            while (true)
            {
                float elapsed = 0f;
                while (elapsed < duration)
                {
                    elapsed += Time.deltaTime;
                    float t = Mathf.Sin((elapsed / duration) * Mathf.PI);
                    float scale = 1f + (t * 0.22f);
                    if (rectTransform != null)
                        rectTransform.localScale = _originalScale * scale;

                    if (symbolImage != null)
                    {
                        // Golden flash highlight
                        symbolImage.color = Color.Lerp(Color.white, new Color(1f, 0.92f, 0.4f, 1f), t);
                    }
                    yield return null;
                }
            }
        }
    }
}
