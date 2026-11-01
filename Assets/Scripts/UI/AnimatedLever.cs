using System;
using System.Collections;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.UI;
using SlotGame.Audio;

namespace SlotGame.UI
{
    /// <summary>
    /// Interactive mechanical lever component on the slot cabinet.
    /// Supports click/drag interactions, authentic 3-frame sprite animation,
    /// audio triggers, and spin initiation.
    /// </summary>
    public class AnimatedLever : MonoBehaviour, IPointerClickHandler, IPointerDownHandler
    {
        [Header("Sprites")]
        [SerializeField] private Image leverImage;
        [SerializeField] private Sprite leverUpSprite;
        [SerializeField] private Sprite leverMidSprite;
        [SerializeField] private Sprite leverDownSprite;

        public event Action OnLeverPulled;

        public bool IsInteractable { get; set; } = true;

        private Coroutine _animationRoutine;

        private void Awake()
        {
            if (leverImage == null)
                leverImage = GetComponent<Image>();

            SetRestingState();
        }

        public void SetRestingState()
        {
            if (leverImage != null && leverUpSprite != null)
            {
                leverImage.sprite = leverUpSprite;
            }
        }

        public void OnPointerDown(PointerEventData eventData)
        {
            if (!IsInteractable) return;
            PullLever();
        }

        public void OnPointerClick(PointerEventData eventData)
        {
            // Handled in pointer down for snappy tactile feel
        }

        /// <summary>
        /// Animates the lever pull down and spring rebound.
        /// </summary>
        public void PullLever()
        {
            if (!IsInteractable) return;

            IsInteractable = false;

            if (SoundManager.Instance != null)
                SoundManager.Instance.PlayLeverPull();

            if (_animationRoutine != null)
                StopCoroutine(_animationRoutine);

            _animationRoutine = StartCoroutine(AnimatePullSequence());
            OnLeverPulled?.Invoke();
        }

        private IEnumerator AnimatePullSequence()
        {
            // 1. Move to Mid
            if (leverImage != null && leverMidSprite != null)
                leverImage.sprite = leverMidSprite;
            yield return new WaitForSeconds(0.08f);

            // 2. Move to Down
            if (leverImage != null && leverDownSprite != null)
                leverImage.sprite = leverDownSprite;
            yield return new WaitForSeconds(0.12f);

            // 3. Spring rebound: Mid
            if (leverImage != null && leverMidSprite != null)
                leverImage.sprite = leverMidSprite;
            yield return new WaitForSeconds(0.08f);

            // 4. Return to Up
            SetRestingState();
        }
    }
}

