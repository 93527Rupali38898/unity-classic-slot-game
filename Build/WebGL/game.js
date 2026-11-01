/**
 * Classic Slot Machine - WebGL / HTML5 Engine
 * Clean, decoupled Object-Oriented implementation matching Unity architecture.
 */

// --- CONFIGURATION & PAYTABLE ---
const CONFIG = {
    reelCount: 3,
    symbolHeight: 96,
    symbolWidth: 96,
    canvasWidth: 368,
    canvasHeight: 210,
    reelPositionsX: [20, 136, 252],
    startingBalance: 1000,
    defaultBet: 10,
    minBet: 5,
    maxBet: 100,
    betStep: 5,
    accelerationDuration: 0.3,
    minSpinDuration: 1.0,
    decelerationDuration: 0.45,
    reelStopDelay: 0.35,
    suspenseDelay: 0.85,
    maxSpinSpeed: 1800,
    bounceOvershoot: 18,
    freeSpinsAwarded: 5,
    freeSpinsMultiplier: 2,
    symbolWeights: [
        { id: 'cherry', name: 'Cherry', weight: 40, sprite: 'assets/symbol_cherry.png' },
        { id: 'bell',   name: 'Golden Bell', weight: 28, sprite: 'assets/symbol_bell.png' },
        { id: 'bar',    name: 'Triple BAR', weight: 20, sprite: 'assets/symbol_bar.png' },
        { id: 'seven',  name: 'Lucky Seven', weight: 12, sprite: 'assets/symbol_seven.png' }
    ],
    paytable: {
        'seven_3':  { mult: 100, title: 'GRAND JACKPOT! 777', isJackpot: true, freeSpins: 5 },
        'bar_3':    { mult: 50,  title: 'MEGA WIN! TRIPLE BAR', isJackpot: false },
        'bell_3':   { mult: 25,  title: 'BIG WIN! GOLDEN BELLS', isJackpot: false },
        'cherry_3': { mult: 10,  title: 'NICE WIN! CHERRIES', isJackpot: false },
        'cherry_2': { mult: 3,   title: 'MINI WIN! DOUBLE CHERRIES', isJackpot: false }
    }
};

// --- AUDIO MANAGER ---
class AudioManager {
    constructor() {
        this.ctx = null;
        this.isMuted = false;
        this.sounds = {};
        this.soundFiles = {
            button: 'assets/button_click.wav',
            lever: 'assets/lever_pull.wav',
            spin: 'assets/spin_loop.wav',
            stop: 'assets/reel_stop.wav',
            coin: 'assets/coin.wav',
            win: 'assets/win.wav',
            jackpot: 'assets/jackpot.wav'
        };
        this.spinLoopNode = null;
    }

    init() {
        if (!this.ctx) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            this.ctx = new AudioContext();
            this.loadBuffers();
        } else if (this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    async loadBuffers() {
        for (const [key, path] of Object.entries(this.soundFiles)) {
            try {
                const res = await fetch(path);
                const arrayBuffer = await res.arrayBuffer();
                this.sounds[key] = await this.ctx.decodeAudioData(arrayBuffer);
            } catch (e) {
                // Fallback synth will handle if audio file fetch fails
            }
        }
    }

    play(name, pitch = 1.0, volume = 1.0) {
        if (this.isMuted) return;
        this.init();

        if (this.sounds[name]) {
            const source = this.ctx.createBufferSource();
            source.buffer = this.sounds[name];
            source.playbackRate.value = pitch;
            const gain = this.ctx.createGain();
            gain.gain.value = volume;
            source.connect(gain);
            gain.connect(this.ctx.destination);
            source.start(0);
        } else {
            this.fallbackSynth(name, pitch);
        }
    }

    playSpinLoop() {
        if (this.isMuted || this.spinLoopNode) return;
        this.init();

        if (this.sounds.spin) {
            const source = this.ctx.createBufferSource();
            source.buffer = this.sounds.spin;
            source.loop = true;
            const gain = this.ctx.createGain();
            gain.gain.value = 0.4;
            source.connect(gain);
            gain.connect(this.ctx.destination);
            source.start(0);
            this.spinLoopNode = { source, gain };
        }
    }

    stopSpinLoop() {
        if (this.spinLoopNode) {
            try {
                this.spinLoopNode.source.stop();
            } catch (e) {}
            this.spinLoopNode = null;
        }
    }

    fallbackSynth(type, pitch = 1.0) {
        if (!this.ctx || this.isMuted) return;
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.connect(gain);
        gain.connect(this.ctx.destination);

        if (type === 'button') {
            osc.frequency.setValueAtTime(800 * pitch, now);
            gain.gain.setValueAtTime(0.3, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.05);
            osc.start(now);
            osc.stop(now + 0.05);
        } else if (type === 'stop') {
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(140 * pitch, now);
            gain.gain.setValueAtTime(0.6, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.12);
            osc.start(now);
            osc.stop(now + 0.12);
        } else if (type === 'win') {
            [523.25, 659.25, 783.99, 1046.5].forEach((freq, idx) => {
                const o = this.ctx.createOscillator();
                const g = this.ctx.createGain();
                o.connect(g);
                g.connect(this.ctx.destination);
                o.frequency.setValueAtTime(freq, now + idx * 0.1);
                g.gain.setValueAtTime(0.4, now + idx * 0.1);
                g.gain.exponentialRampToValueAtTime(0.01, now + idx * 0.1 + 0.15);
                o.start(now + idx * 0.1);
                o.stop(now + idx * 0.1 + 0.15);
            });
        }
    }

    toggleMute() {
        this.isMuted = !this.isMuted;
        if (this.isMuted && this.spinLoopNode) {
            this.stopSpinLoop();
        }
        return this.isMuted;
    }
}

// --- RNG SERVICE ---
class RNGService {
    constructor(weights) {
        this.weights = weights;
        this.totalWeight = weights.reduce((acc, curr) => acc + curr.weight, 0);
    }

    getRandomSymbol() {
        const roll = Math.floor(Math.random() * this.totalWeight);
        let cumulative = 0;
        for (const item of this.weights) {
            cumulative += item.weight;
            if (roll < cumulative) {
                return item.id;
            }
        }
        return this.weights[this.weights.length - 1].id;
    }

    generateOutcome(reelCount) {
        const outcome = [];
        for (let i = 0; i < reelCount; i++) {
            outcome.push(this.getRandomSymbol());
        }
        return outcome;
    }
}

// --- REEL STRIP ---
class ReelStrip {
    constructor(index, x, config, rng, images) {
        this.index = index;
        this.x = x;
        this.config = config;
        this.rng = rng;
        this.images = images;

        this.symbols = [];
        this.totalSlots = 6;
        this.yOffset = 0;
        this.speed = 0;
        this.state = 'IDLE'; // IDLE, ACCEL, SPIN, STOPPING, BOUNCE
        this.targetSymbol = null;
        this.elapsed = 0;
        this.initialDistance = 0;
        this.distanceRemaining = 0;
        this.bounceElapsed = 0;

        // Initialize symbols stack
        for (let i = 0; i < this.totalSlots; i++) {
            this.symbols.push(this.rng.getRandomSymbol());
        }
    }

    startSpin() {
        this.state = 'ACCEL';
        this.elapsed = 0;
        this.speed = 0;
    }

    requestStop(outcomeSymbol) {
        this.targetSymbol = outcomeSymbol;
        this.stopRequested = true;
    }

    update(dt) {
        if (this.state === 'IDLE') return;

        if (this.state === 'ACCEL') {
            this.elapsed += dt;
            const t = Math.min(1.0, this.elapsed / this.config.accelerationDuration);
            this.speed = this.config.maxSpinSpeed * (t * t);
            this.yOffset += this.speed * dt;

            if (t >= 1.0) {
                this.state = 'SPIN';
                this.speed = this.config.maxSpinSpeed;
                this.elapsed = 0;
            }
        } else if (this.state === 'SPIN') {
            this.elapsed += dt;
            this.yOffset += this.speed * dt;

            if (this.stopRequested && this.elapsed >= this.config.minSpinDuration) {
                this.state = 'STOPPING';
                this.elapsed = 0;

                // Set symbol above center to target
                this.symbols[0] = this.targetSymbol;
                // Calculate remaining distance to center line
                this.distanceRemaining = (this.totalSlots * this.config.symbolHeight) - (this.yOffset % (this.totalSlots * this.config.symbolHeight));
                this.initialDistance = this.distanceRemaining;
            }
        } else if (this.state === 'STOPPING') {
            this.elapsed += dt;
            const t = Math.min(1.0, this.elapsed / this.config.decelerationDuration);
            // Ease-out cubic
            const ease = 1 - Math.pow(1 - t, 3);
            const targetStep = (1 - ease) * this.initialDistance;
            const delta = this.distanceRemaining - targetStep;
            this.yOffset += delta;
            this.distanceRemaining = targetStep;

            if (t >= 1.0) {
                this.state = 'BOUNCE';
                this.bounceElapsed = 0;
                this.baseY = this.yOffset;
            }
        } else if (this.state === 'BOUNCE') {
            this.bounceElapsed += dt;
            const bounceDuration = 0.22;
            const t = this.bounceElapsed / bounceDuration;

            if (t >= 1.0) {
                this.state = 'IDLE';
                this.yOffset = this.baseY;
                if (this.onStopCallback) this.onStopCallback(this.index, this.targetSymbol);
            } else {
                // Damped sine wave
                const offset = Math.sin(t * Math.PI) * this.config.bounceOvershoot * Math.exp(-t * 3);
                this.yOffset = this.baseY + offset;
            }
        }

        // Handle loop wrap
        const stripHeight = this.totalSlots * this.config.symbolHeight;
        while (this.yOffset >= stripHeight) {
            this.yOffset -= stripHeight;
            // Shift array and push new symbol
            this.symbols.pop();
            this.symbols.unshift(this.rng.getRandomSymbol());
        }
    }

    render(ctx) {
        const h = this.config.symbolHeight;
        const w = this.config.symbolWidth;
        const centerY = this.config.canvasHeight / 2;

        for (let i = 0; i < this.totalSlots; i++) {
            const symId = this.symbols[i];
            const img = this.images[symId];
            if (!img) continue;

            const yPos = (i * h) + (this.yOffset % (this.totalSlots * h)) - (2 * h);

            if (yPos > -h && yPos < this.config.canvasHeight + h) {
                ctx.drawImage(img, this.x, yPos, w, h);
            }
        }
    }
}

// --- PAYOUT EVALUATOR ---
class PayoutEvaluator {
    static evaluate(outcome, bet, bonusMultiplier = 1) {
        const [s0, s1, s2] = outcome;

        // 1. Check 3-of-a-kind
        if (s0 === s1 && s1 === s2) {
            const ruleKey = `${s0}_3`;
            const rule = CONFIG.paytable[ruleKey];
            if (rule) {
                const totalMult = rule.mult * bonusMultiplier;
                return {
                    isWin: true,
                    amount: bet * totalMult,
                    title: rule.title,
                    isJackpot: !!rule.isJackpot,
                    freeSpins: rule.freeSpins || 0
                };
            }
        }

        // 2. Check 2-Cherries anywhere on payline
        const cherryCount = outcome.filter(s => s === 'cherry').length;
        if (cherryCount >= 2) {
            const rule = CONFIG.paytable['cherry_2'];
            const totalMult = rule.mult * bonusMultiplier;
            return {
                isWin: true,
                amount: bet * totalMult,
                title: rule.title,
                isJackpot: false,
                freeSpins: 0
            };
        }

        return { isWin: false, amount: 0, title: 'No Win', isJackpot: false, freeSpins: 0 };
    }
}

// --- MASTER GAME APPLICATION ---
class SlotGameApp {
    constructor() {
        this.balance = CONFIG.startingBalance;
        this.bet = CONFIG.defaultBet;
        this.lastWin = 0;
        this.remainingFreeSpins = 0;
        this.isAutoSpin = false;
        this.isSpinning = false;

        this.canvas = document.getElementById('slotCanvas');
        this.ctx = this.canvas.getContext('2d');

        this.audio = new AudioManager();
        this.rng = new RNGService(CONFIG.symbolWeights);

        this.images = {};
        this.reels = [];
        this.lastTime = 0;

        this.initDOM();
        this.preloadAssets().then(() => {
            this.initReels();
            this.startLoop();
            this.updateHUD();
        });
    }

    initDOM() {
        this.dom = {
            balance: document.getElementById('balanceDisplay'),
            bet: document.getElementById('betDisplay'),
            win: document.getElementById('winDisplay'),
            controlBet: document.getElementById('controlBetDisplay'),
            status: document.getElementById('statusMarquee'),
            freeSpinsBadge: document.getElementById('freeSpinsBadge'),
            freeSpinsCount: document.getElementById('freeSpinsCount'),
            btnSpin: document.getElementById('btnSpin'),
            btnAutoSpin: document.getElementById('btnAutoSpin'),
            btnBetPlus: document.getElementById('btnBetPlus'),
            btnBetMinus: document.getElementById('btnBetMinus'),
            btnMaxBet: document.getElementById('btnMaxBet'),
            btnPaytable: document.getElementById('btnPaytable'),
            btnSound: document.getElementById('btnSoundToggle'),
            leverHotspot: document.getElementById('leverHotspot'),
            leverSprite: document.getElementById('leverSprite'),
            paytableModal: document.getElementById('paytableModal'),
            btnClosePaytable: document.getElementById('btnClosePaytable'),
            celebrationModal: document.getElementById('celebrationModal'),
            celebrationTitle: document.getElementById('celebrationTitle'),
            celebrationAmount: document.getElementById('celebrationAmount'),
            btnCollect: document.getElementById('btnCollect')
        };

        // Event listeners
        this.dom.btnSpin.addEventListener('click', () => this.handleSpinRequest());
        this.dom.leverHotspot.addEventListener('click', () => this.handleLeverPull());
        this.dom.btnAutoSpin.addEventListener('click', () => this.toggleAutoSpin());
        this.dom.btnBetPlus.addEventListener('click', () => this.adjustBet(CONFIG.betStep));
        this.dom.btnBetMinus.addEventListener('click', () => this.adjustBet(-CONFIG.betStep));
        this.dom.btnMaxBet.addEventListener('click', () => this.setMaxBet());
        this.dom.btnPaytable.addEventListener('click', () => this.openPaytable());
        this.dom.btnClosePaytable.addEventListener('click', () => this.closePaytable());
        this.dom.btnCollect.addEventListener('click', () => this.closeCelebration());
        this.dom.btnSound.addEventListener('click', () => {
            const muted = this.audio.toggleMute();
            this.dom.btnSound.textContent = muted ? '🔇' : '🔊';
        });
    }

    async preloadAssets() {
        const assetMap = {
            seven: 'assets/symbol_seven.png',
            bar: 'assets/symbol_bar.png',
            bell: 'assets/symbol_bell.png',
            cherry: 'assets/symbol_cherry.png'
        };

        const promises = Object.entries(assetMap).map(([id, src]) => {
            return new Promise((resolve) => {
                const img = new Image();
                img.onload = () => {
                    this.images[id] = img;
                    resolve();
                };
                img.onerror = () => resolve();
                img.src = src;
            });
        });

        await Promise.all(promises);
    }

    initReels() {
        this.reels = [];
        for (let i = 0; i < CONFIG.reelCount; i++) {
            const reel = new ReelStrip(i, CONFIG.reelPositionsX[i], CONFIG, this.rng, this.images);
            reel.onStopCallback = (idx, symbol) => this.handleReelStopped(idx, symbol);
            this.reels.push(reel);
        }
    }

    startLoop() {
        const loop = (timestamp) => {
            if (!this.lastTime) this.lastTime = timestamp;
            const dt = Math.min(0.1, (timestamp - this.lastTime) / 1000);
            this.lastTime = timestamp;

            this.update(dt);
            this.render();

            requestAnimationFrame(loop);
        };
        requestAnimationFrame(loop);
    }

    update(dt) {
        for (const reel of this.reels) {
            reel.update(dt);
        }
    }

    render() {
        this.ctx.clearRect(0, 0, CONFIG.canvasWidth, CONFIG.canvasHeight);
        for (const reel of this.reels) {
            reel.render(this.ctx);
        }
    }

    handleLeverPull() {
        if (this.isSpinning) return;
        this.audio.play('lever');

        // Animate lever handle: up -> mid -> down -> mid -> up
        const sprite = this.dom.leverSprite;
        sprite.style.backgroundImage = "url('assets/lever_mid.png')";
        setTimeout(() => {
            sprite.style.backgroundImage = "url('assets/lever_down.png')";
            setTimeout(() => {
                sprite.style.backgroundImage = "url('assets/lever_mid.png')";
                setTimeout(() => {
                    sprite.style.backgroundImage = "url('assets/lever_up.png')";
                }, 80);
            }, 120);
        }, 80);

        this.handleSpinRequest();
    }

    handleSpinRequest() {
        if (this.isSpinning) return;

        const isFree = this.remainingFreeSpins > 0;

        if (!isFree && this.balance < this.bet) {
            this.dom.status.textContent = 'INSUFFICIENT CREDITS! LOWER BET OR RECHARGE.';
            this.dom.status.style.color = '#ff4d4d';
            this.stopAutoSpin();
            return;
        }

        if (!isFree) {
            this.balance -= this.bet;
        } else {
            this.remainingFreeSpins--;
            this.dom.freeSpinsCount.textContent = this.remainingFreeSpins;
            if (this.remainingFreeSpins <= 0) {
                this.dom.freeSpinsBadge.style.display = 'none';
            }
        }

        this.isSpinning = true;
        this.stoppedCount = 0;
        this.currentOutcome = this.rng.generateOutcome(CONFIG.reelCount);

        this.updateHUD();
        this.setControlsDisabled(true);
        this.dom.status.textContent = isFree ? `FREE SPIN (${this.remainingFreeSpins + 1}) - 2X MULTIPLIER!` : 'REELS SPINNING... GOOD LUCK!';
        this.dom.status.style.color = '#ffd700';

        this.audio.play('button');
        this.audio.playSpinLoop();

        // Start all reels
        for (const reel of this.reels) {
            reel.startSpin();
        }

        // Staggered stop schedule
        setTimeout(() => {
            this.reels[0].requestStop(this.currentOutcome[0]);

            setTimeout(() => {
                this.reels[1].requestStop(this.currentOutcome[1]);

                // Anticipation Suspense check: if reels 0 and 1 match!
                const isSuspense = (this.currentOutcome[0] === this.currentOutcome[1]);
                const delay = isSuspense ? (CONFIG.reelStopDelay + CONFIG.suspenseDelay) : CONFIG.reelStopDelay;

                if (isSuspense) {
                    this.dom.status.textContent = 'MATCH DETECTED! SUSPENSE BUILDING...';
                    this.dom.status.style.color = '#ff9900';
                }

                setTimeout(() => {
                    this.reels[2].requestStop(this.currentOutcome[2]);
                }, delay * 1000);

            }, CONFIG.reelStopDelay * 1000);

        }, CONFIG.minSpinDuration * 1000);
    }

    handleReelStopped(reelIndex, symbol) {
        this.audio.play('stop', 1.0 + (reelIndex * 0.08));
        this.stoppedCount++;

        if (this.stoppedCount >= CONFIG.reelCount) {
            this.audio.stopSpinLoop();
            this.finalizeSpin();
        }
    }

    finalizeSpin() {
        const bonusMult = this.remainingFreeSpins > 0 ? CONFIG.freeSpinsMultiplier : 1;
        const result = PayoutEvaluator.evaluate(this.currentOutcome, this.bet, bonusMult);

        if (result.isWin) {
            this.balance += result.amount;
            this.lastWin = result.amount;
            this.dom.win.textContent = result.amount.toLocaleString();
            this.dom.win.classList.add('win-highlight');

            if (result.freeSpins > 0) {
                this.remainingFreeSpins += result.freeSpins;
                this.dom.freeSpinsBadge.style.display = 'block';
                this.dom.freeSpinsCount.textContent = this.remainingFreeSpins;
            }

            if (result.isJackpot || result.amount >= this.bet * 25) {
                this.showCelebration(result.title, result.amount, result.isJackpot);
                return;
            } else {
                this.audio.play('win');
                this.dom.status.textContent = `${result.title}! +${result.amount.toLocaleString()} CREDITS!`;
                this.dom.status.style.color = '#2eff8b';
            }
        } else {
            this.dom.status.textContent = 'TRY AGAIN! FORTUNE FAVORS THE BOLD.';
            this.dom.status.style.color = '#bfa5e6';
            this.dom.win.classList.remove('win-highlight');
        }

        this.concludeTurn();
    }

    showCelebration(title, amount, isJackpot) {
        if (isJackpot) this.audio.play('jackpot');
        else this.audio.play('win');

        this.dom.celebrationTitle.textContent = title;
        this.dom.celebrationAmount.textContent = `+${amount.toLocaleString()} COINS`;
        this.dom.celebrationModal.style.display = 'flex';
    }

    closeCelebration() {
        this.audio.play('button');
        this.dom.celebrationModal.style.display = 'none';
        this.concludeTurn();
    }

    concludeTurn() {
        this.isSpinning = false;
        this.updateHUD();

        if (this.remainingFreeSpins > 0) {
            setTimeout(() => this.handleSpinRequest(), 1200);
            return;
        }

        this.setControlsDisabled(false);

        if (this.isAutoSpin) {
            setTimeout(() => {
                if (this.isAutoSpin) this.handleSpinRequest();
            }, 1500);
        }
    }

    adjustBet(delta) {
        if (this.isSpinning) return;
        this.audio.play('button');
        this.bet = Math.max(CONFIG.minBet, Math.min(CONFIG.maxBet, this.bet + delta));
        this.updateHUD();
    }

    setMaxBet() {
        if (this.isSpinning) return;
        this.audio.play('button');
        this.bet = CONFIG.maxBet;
        this.updateHUD();
    }

    toggleAutoSpin() {
        this.audio.play('button');
        this.isAutoSpin = !this.isAutoSpin;
        this.dom.btnAutoSpin.classList.toggle('active', this.isAutoSpin);
        this.dom.btnAutoSpin.textContent = this.isAutoSpin ? 'AUTO [ON]' : 'AUTO SPIN';

        if (this.isAutoSpin && !this.isSpinning) {
            this.handleSpinRequest();
        }
    }

    stopAutoSpin() {
        this.isAutoSpin = false;
        this.dom.btnAutoSpin.classList.remove('active');
        this.dom.btnAutoSpin.textContent = 'AUTO SPIN';
    }

    openPaytable() {
        this.audio.play('button');
        this.dom.paytableModal.style.display = 'flex';
    }

    closePaytable() {
        this.audio.play('button');
        this.dom.paytableModal.style.display = 'none';
    }

    setControlsDisabled(disabled) {
        this.dom.btnSpin.disabled = disabled;
        this.dom.btnBetPlus.disabled = disabled;
        this.dom.btnBetMinus.disabled = disabled;
        this.dom.btnMaxBet.disabled = disabled;
        this.dom.leverHotspot.style.pointerEvents = disabled ? 'none' : 'auto';
    }

    updateHUD() {
        this.dom.balance.textContent = this.balance.toLocaleString();
        this.dom.bet.textContent = this.bet.toLocaleString();
        this.dom.controlBet.textContent = this.bet.toString();
    }
}

// Instantiate application on window load
window.addEventListener('DOMContentLoaded', () => {
    new SlotGameApp();
});
