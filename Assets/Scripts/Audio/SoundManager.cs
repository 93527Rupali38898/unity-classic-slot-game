using UnityEngine;

namespace SlotGame.Audio
{
    /// <summary>
    /// Manages sound effects and procedural pitch modulation for mechanical realism and suspense.
    /// </summary>
    public class SoundManager : MonoBehaviour
    {
        public static SoundManager Instance { get; private set; }

        [Header("Audio Sources")]
        [SerializeField] private AudioSource sfxSource;
        [SerializeField] private AudioSource loopSource;

        [Header("Audio Clips")]
        [SerializeField] private AudioClip buttonClickClip;
        [SerializeField] private AudioClip leverPullClip;
        [SerializeField] private AudioClip spinLoopClip;
        [SerializeField] private AudioClip reelStopClip;
        [SerializeField] private AudioClip coinChimeClip;
        [SerializeField] private AudioClip winClip;
        [SerializeField] private AudioClip jackpotClip;

        private void Awake()
        {
            if (Instance != null && Instance != this)
            {
                Destroy(gameObject);
                return;
            }
            Instance = this;

            if (sfxSource == null)
                sfxSource = gameObject.AddComponent<AudioSource>();
            if (loopSource == null)
            {
                loopSource = gameObject.AddComponent<AudioSource>();
                loopSource.loop = true;
            }
        }

        public void PlayButtonClick()
        {
            PlayClip(buttonClickClip, 1.0f);
        }

        public void PlayLeverPull()
        {
            PlayClip(leverPullClip, 1.0f);
        }

        public void PlaySpinLoop()
        {
            if (spinLoopClip != null && loopSource != null)
            {
                loopSource.clip = spinLoopClip;
                loopSource.volume = 0.5f;
                loopSource.Play();
            }
        }

        public void StopSpinLoop()
        {
            if (loopSource != null && loopSource.isPlaying)
            {
                loopSource.Stop();
            }
        }

        public void PlayReelStop(int reelIndex)
        {
            // Pitch increases subtly with each reel (1.0 -> 1.08 -> 1.16) for ascending excitement
            float pitch = 1.0f + (reelIndex * 0.08f);
            PlayClipWithPitch(reelStopClip, 0.85f, pitch);
        }

        public void PlayCoin()
        {
            PlayClip(coinChimeClip, 0.7f);
        }

        public void PlayWin()
        {
            PlayClip(winClip, 1.0f);
        }

        public void PlayJackpot()
        {
            PlayClip(jackpotClip, 1.0f);
        }

        private void PlayClip(AudioClip clip, float volume)
        {
            if (clip != null && sfxSource != null)
            {
                sfxSource.pitch = 1.0f;
                sfxSource.PlayOneShot(clip, volume);
            }
        }

        private void PlayClipWithPitch(AudioClip clip, float volume, float pitch)
        {
            if (clip != null && sfxSource != null)
            {
                sfxSource.pitch = pitch;
                sfxSource.PlayOneShot(clip, volume);
            }
        }
    }
}

