using UnityEngine;
using UnityEngine.UI;
using SlotGame.Audio;

namespace SlotGame.UI
{
    /// <summary>
    /// Modal dialog displaying paytable values, win rules, and bonus information
    /// framed with the provided casino popup graphics.
    /// </summary>
    public class PaytableModal : MonoBehaviour
    {
        [Header("Dialog Panel")]
        [SerializeField] private GameObject modalPanel;
        [SerializeField] private Button openButton;
        [SerializeField] private Button closeButton;

        private void Awake()
        {
            if (openButton != null)
                openButton.onClick.AddListener(Open);
            if (closeButton != null)
                closeButton.onClick.AddListener(Close);

            if (modalPanel != null)
                modalPanel.SetActive(false);
        }

        public void Open()
        {
            if (SoundManager.Instance != null)
                SoundManager.Instance.PlayButtonClick();

            if (modalPanel != null)
                modalPanel.SetActive(true);
        }

        public void Close()
        {
            if (SoundManager.Instance != null)
                SoundManager.Instance.PlayButtonClick();

            if (modalPanel != null)
                modalPanel.SetActive(false);
        }
    }
}
