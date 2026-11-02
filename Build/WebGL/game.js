/**
 * Classic Slot Machine - WebGL / HTML5 Engine
 * Clean, decoupled Object-Oriented implementation matching Unity architecture.
 */

// --- CONFIGURATION & ECONOMY ---
const CONFIG = {
    reelCount: 3,
    symbolWidth: 78,
    symbolHeight: 78,
    slotStepH: 84, // 78px symbol + 6px breathing room
    canvasWidth: 368,
    canvasHeight: 210,
    reelPositionsX: [18, 146, 274],
    paylineCenterY: 66, // (210 - 78) / 2 = 66px
    startingBalance: 1000,
    defaultBet: 10,
    minBet: 5,
    maxBet: 100,
    betStep: 5,
    accelerationDuration: 0.28,
    minSpinDuration: 0.9,
    decelerationDuration: 0.42,
    reelStopDelay: 0.32,
    suspenseDelay: 0.85,
    maxSpinSpeed: 1550,
    bounceOvershoot: 14,
    freeSpinsAwarded: 5,
    freeSpinsMultiplier: 2,
    symbolWeights: [
        { id: 'cherry', name: 'Cherry', label: 'CHERRY', weight: 40, sprite: 'assets/symbol_cherry.png' },
        { id: 'bell',   name: 'Golden Bell', label: 'BELL', weight: 28, sprite: 'assets/symbol_bell.png' },
        { id: 'bar',    name: 'Triple BAR', label: 'BAR', weight: 20, sprite: 'assets/symbol_bar.png' },
        { id: 'seven',  name: 'Lucky Seven', label: '7', weight: 12, sprite: 'assets/symbol_seven.png' }
    ],
    paytable: {
        'seven_3':  { mult: 100, title: 'GRAND JACKPOT!', isJackpot: true, freeSpins: 5 },
        'bar_3':    { mult: 50,  title: 'MEGA WIN!', isJackpot: false },
        'bell_3':   { mult: 25,  title: 'BIG WIN!', isJackpot: false },
        'cherry_3': { mult: 10,  title: 'NICE WIN!', isJackpot: false },
        'cherry_2': { mult: 3,   title: 'MINI WIN (2x CHERRIES)!', isJackpot: false }
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
                // Synthesizer handles audio if fetch is blocked
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
            gain.gain.value = 0.35;
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
        } else if (type === 'lever') {
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(160 * pitch, now);
            gain.gain.setValueAtTime(0.5, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
            osc.start(now);
            osc.stop(now + 0.15);
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

// --- FAIR RNG SERVICE ---
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

// --- CELEBRATION SPARKLE PARTICLE ---
class SparkleParticle {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        const angle = Math.random() * Math.PI * 2;
        const speed = 25 + Math.random() * 65;
        this.vx = Math.cos(angle) * speed;
        this.vy = Math.sin(angle) * speed;
        this.size = 2.5 + Math.random() * 3.5;
        this.life = 0;
        this.maxLife = 0.6 + Math.random() * 0.7;
        this.color = Math.random() > 0.3 ? '#ffd700' : '#ffffff';
    }

    update(dt) {
        this.life += dt;
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        this.vy += 30 * dt; // subtle gravity
    }

    render(ctx) {
        const progress = this.life / this.maxLife;
        if (progress >= 1) return;
        const alpha = Math.sin(progress * Math.PI);

        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = this.color;
        ctx.shadowColor = '#ffd700';
        ctx.shadowBlur = 6;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size * (1 - progress * 0.4), 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

// --- CINEMATIC WIN SPOTLIGHT & DARK VEIL MANAGER ---
class WinSpotlightManager {
    constructor(config, images) {
        this.config = config;
        this.images = images;
        this.isActive = false;
        this.veilAlpha = 0;
        this.targetVeilAlpha = 0;
        this.winningReels = [];
        this.outcome = [];
        this.particles = [];
        this.timer = 0;
        this.beamPulse = 0;
    }

    start(winningReels, outcome) {
        this.isActive = true;
        this.targetVeilAlpha = 0.76;
        this.winningReels = winningReels || [];
        this.outcome = outcome || [];
        this.timer = 0;
        this.particles = [];

        // Spawn sparkle particles on each winning symbol center
        this.winningReels.forEach(idx => {
            const centerX = this.config.reelPositionsX[idx] + this.config.symbolWidth / 2;
            const centerY = this.config.paylineCenterY + this.config.symbolHeight / 2;
            for (let i = 0; i < 18; i++) {
                this.particles.push(new SparkleParticle(centerX, centerY));
            }
        });
    }

    stop() {
        this.isActive = false;
        this.targetVeilAlpha = 0;
        this.particles = [];
    }

    update(dt) {
        // Smooth transition of the darkness veil
        const lerpSpeed = this.isActive ? 4.5 : 6.0;
        this.veilAlpha += (this.targetVeilAlpha - this.veilAlpha) * Math.min(1.0, dt * lerpSpeed);

        if (this.isActive) {
            this.timer += dt;
            this.beamPulse += dt * 5;

            // Continuous gentle sparkle spawn during win
            if (Math.random() < 0.28 && this.winningReels.length > 0) {
                const randReel = this.winningReels[Math.floor(Math.random() * this.winningReels.length)];
                const rx = this.config.reelPositionsX[randReel] + Math.random() * this.config.symbolWidth;
                const ry = this.config.paylineCenterY + Math.random() * this.config.symbolHeight;
                this.particles.push(new SparkleParticle(rx, ry));
            }
        }

        // Update active particles
        for (let i = this.particles.length - 1; i >= 0; i--) {
            this.particles[i].update(dt);
            if (this.particles[i].life >= this.particles[i].maxLife) {
                this.particles.splice(i, 1);
            }
        }
    }

    render(ctx) {
        if (this.veilAlpha <= 0.01) return;

        ctx.save();

        // 1. CINEMATIC DARK VEIL (Shrouds the entire non-winning reel area in darkness!)
        ctx.fillStyle = `rgba(5, 2, 12, ${this.veilAlpha})`;
        ctx.fillRect(0, 0, this.config.canvasWidth, this.config.canvasHeight);

        // 2. RE-RENDER ONLY THE WINNING SYMBOLS IN ILLUMINATED GOLDEN SPOTLIGHTS!
        const W = this.config.symbolWidth;
        const H = this.config.symbolHeight;
        const drawY = this.config.paylineCenterY;

        this.winningReels.forEach(idx => {
            const symId = this.outcome[idx];
            const img = this.images[symId];
            if (!img) return;

            const posX = this.config.reelPositionsX[idx];
            const centerX = posX + W / 2;
            const centerY = drawY + H / 2;

            // Soft radial spotlight glow behind winning symbol
            const spotlight = ctx.createRadialGradient(centerX, centerY, 15, centerX, centerY, 55);
            spotlight.addColorStop(0, 'rgba(255, 215, 0, 0.45)');
            spotlight.addColorStop(0.6, 'rgba(255, 215, 0, 0.18)');
            spotlight.addColorStop(1, 'rgba(255, 215, 0, 0)');
            ctx.fillStyle = spotlight;
            ctx.beginPath();
            ctx.arc(centerX, centerY, 55, 0, Math.PI * 2);
            ctx.fill();

            // Pulsating scale bounce
            const pulse = 1.0 + Math.sin(this.timer * 7) * 0.07;
            const glowW = W * pulse;
            const glowH = H * pulse;
            const glowX = posX - (glowW - W) / 2;
            const glowY = drawY - (glowH - H) / 2;

            // Draw glowing golden border badge
            ctx.shadowColor = '#ffd700';
            ctx.shadowBlur = 20;
            ctx.strokeStyle = '#ffd700';
            ctx.lineWidth = 2.5;
            ctx.fillStyle = 'rgba(255, 215, 0, 0.15)';
            const pad = 5;

            if (ctx.roundRect) {
                ctx.beginPath();
                ctx.roundRect(posX - pad, drawY - pad, W + pad * 2, H + pad * 2, 8);
                ctx.fill();
                ctx.stroke();
            } else {
                ctx.fillRect(posX - pad, drawY - pad, W + pad * 2, H + pad * 2);
                ctx.strokeRect(posX - pad, drawY - pad, W + pad * 2, H + pad * 2);
            }

            // Draw winning symbol crisp at 100% full brightness
            ctx.drawImage(img, glowX, glowY, glowW, glowH);
        });

        // 3. GLOWING ENERGY BEAM CONNECTING WINNING SYMBOLS
        if (this.winningReels.length >= 2) {
            ctx.beginPath();
            const startX = this.config.reelPositionsX[this.winningReels[0]] + W / 2;
            const endX = this.config.reelPositionsX[this.winningReels[this.winningReels.length - 1]] + W / 2;
            const beamY = drawY + H / 2;

            ctx.strokeStyle = 'rgba(255, 215, 0, 0.9)';
            ctx.lineWidth = 2.5;
            ctx.shadowColor = '#ffd700';
            ctx.shadowBlur = 14;
            ctx.setLineDash([8, 4]);
            ctx.lineDashOffset = -this.beamPulse * 10;
            ctx.moveTo(startX, beamY);
            ctx.lineTo(endX, beamY);
            ctx.stroke();
            ctx.setLineDash([]); // reset
        }

        // 4. RENDER GOLDEN SPARKLE PARTICLES
        for (const p of this.particles) {
            p.render(ctx);
        }

        ctx.restore();
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

        this.symbols = ['seven', 'bar', 'bell', 'cherry', 'seven', 'bar', 'bell', 'cherry'];
        this.state = 'IDLE'; // IDLE, ACCEL, SPIN, DECEL, BOUNCE
        this.yOffset = 0;
        this.speed = 0;
        this.elapsed = 0;
        this.targetSymbol = null;
        this.stopRequested = false;

        this.startOffset = 0;
        this.targetOffset = 0;
        this.bounceElapsed = 0;
    }

    startSpin() {
        this.state = 'ACCEL';
        this.elapsed = 0;
        this.speed = 0;
        this.stopRequested = false;
    }

    requestStop(outcomeSymbol) {
        this.targetSymbol = outcomeSymbol;
        this.stopRequested = true;
    }

    update(dt) {
        const H = this.config.slotStepH; // 84px

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
                this.state = 'DECEL';
                this.elapsed = 0;

                const decelTime = this.config.decelerationDuration;
                const minDistance = this.speed * decelTime * 0.5;
                const currentY = this.yOffset;
                this.startOffset = currentY;

                // Snap exact multiple of H for perfect payline alignment
                this.targetOffset = Math.ceil((currentY + minDistance) / H) * H;

                // Inject target symbol at center payline slot
                const centerIdx = (Math.floor(this.targetOffset / H) + this.symbols.length * 100) % this.symbols.length;
                this.symbols[centerIdx] = this.targetSymbol;

                const prevIdx = (centerIdx - 1 + this.symbols.length) % this.symbols.length;
                const nextIdx = (centerIdx + 1) % this.symbols.length;
                if (!this.symbols[prevIdx]) this.symbols[prevIdx] = this.rng.getRandomSymbol();
                if (!this.symbols[nextIdx]) this.symbols[nextIdx] = this.rng.getRandomSymbol();
            }
        } else if (this.state === 'DECEL') {
            this.elapsed += dt;
            const t = Math.min(1.0, this.elapsed / this.config.decelerationDuration);
            const easeOut = 1 - Math.pow(1 - t, 3);
            this.yOffset = this.startOffset + (this.targetOffset - this.startOffset) * easeOut;

            if (t >= 1.0) {
                this.state = 'BOUNCE';
                this.bounceElapsed = 0;
                this.yOffset = this.targetOffset;
            }
        } else if (this.state === 'BOUNCE') {
            this.bounceElapsed += dt;
            const bounceDuration = 0.20;
            const t = this.bounceElapsed / bounceDuration;

            if (t >= 1.0) {
                this.state = 'IDLE';
                this.yOffset = this.targetOffset;
                if (this.onStopCallback) {
                    this.onStopCallback(this.index, this.targetSymbol);
                }
            } else {
                const offset = Math.sin(t * Math.PI) * this.config.bounceOvershoot * Math.exp(-t * 3.8);
                this.yOffset = this.targetOffset + offset;
            }
        }
    }

    render(ctx) {
        const H = this.config.slotStepH; // 84px
        const W = this.config.symbolWidth; // 78px
        const symH = this.config.symbolHeight; // 78px
        const centerY = this.config.paylineCenterY; // 66px

        const totalSymbols = this.symbols.length;
        const currentScrollIndex = Math.floor(this.yOffset / H);
        const subOffset = this.yOffset % H;

        // Render slots: -2, -1 (top), 0 (center payline), 1 (bottom), 2
        for (let row = -2; row <= 2; row++) {
            const symIndex = (currentScrollIndex - row + totalSymbols * 100) % totalSymbols;
            const symId = this.symbols[symIndex];
            const img = this.images[symId];

            if (!img) continue;

            const drawY = centerY + (row * H) + subOffset;

            if (drawY > -symH && drawY < this.config.canvasHeight + symH) {
                ctx.save();

                if (row === 0) {
                    // Center active payline: 100% full vibrant opacity
                    ctx.globalAlpha = this.state === 'IDLE' ? 1.0 : 0.88;
                } else {
                    // Neighboring top and bottom rows: dimmed so player immediately sees center focus!
                    ctx.globalAlpha = this.state === 'IDLE' ? 0.26 : 0.45;
                }

                ctx.drawImage(img, this.x, drawY, W, symH);
                ctx.restore();
            }
        }
    }
}

// --- PAYOUT EVALUATOR ---
class PayoutEvaluator {
    static evaluate(outcome, bet, bonusMultiplier = 1) {
        const [s0, s1, s2] = outcome;

        // 1. Check 3-of-a-kind full match
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
                    freeSpins: rule.freeSpins || 0,
                    winningReels: [0, 1, 2]
                };
            }
        }

        // 2. Check 2-Cherries on center payline
        const cherryIndices = [];
        outcome.forEach((s, idx) => {
            if (s === 'cherry') cherryIndices.push(idx);
        });

        if (cherryIndices.length >= 2) {
            const rule = CONFIG.paytable['cherry_2'];
            const totalMult = rule.mult * bonusMultiplier;
            return {
                isWin: true,
                amount: bet * totalMult,
                title: rule.title,
                isJackpot: false,
                freeSpins: 0,
                winningReels: cherryIndices
            };
        }

        return { isWin: false, amount: 0, title: 'No Win', isJackpot: false, freeSpins: 0, winningReels: [] };
    }
}

// --- MASTER APPLICATION CONTROLLER ---
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
            this.winSpotlight = new WinSpotlightManager(CONFIG, this.images);
            this.startLoop();
            this.updateHUD();
        });
    }

    initDOM() {
        this.dom = {
            machineStage: document.getElementById('machineStage'),
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
            paytableModal: document.getElementById('paytableModal'),
            btnClosePaytable: document.getElementById('btnClosePaytable'),
            celebrationModal: document.getElementById('celebrationModal'),
            celebrationTitle: document.getElementById('celebrationTitle'),
            celebrationAmount: document.getElementById('celebrationAmount'),
            btnCollect: document.getElementById('btnCollect')
        };

        this.dom.machineStage.style.backgroundImage = "url('assets/machine_frame_up.png')";

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
            backdrop: 'assets/reel_backdrop.png',
            seven: 'assets/symbol_seven.png',
            bar: 'assets/symbol_bar.png',
            bell: 'assets/symbol_bell.png',
            cherry: 'assets/symbol_cherry.png'
        };

        ['assets/machine_frame_up.png', 'assets/machine_frame_mid.png', 'assets/machine_frame_down.png'].forEach(src => {
            const img = new Image();
            img.src = src;
        });

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
        if (this.winSpotlight) {
            this.winSpotlight.update(dt);
        }
    }

    render() {
        // 1. Draw reel cylinders background
        if (this.images.backdrop) {
            this.ctx.drawImage(this.images.backdrop, 0, 0, CONFIG.canvasWidth, CONFIG.canvasHeight);
        } else {
            this.ctx.fillStyle = '#ffffff';
            this.ctx.fillRect(0, 0, CONFIG.canvasWidth, CONFIG.canvasHeight);
        }

        // 2. Draw symbols on all 3 reels
        for (const reel of this.reels) {
            reel.render(this.ctx);
        }

        // 3. CINEMATIC WIN SPOTLIGHT & DARK VEIL OVERLAY (drapes all non-winning symbols in dark opacity!)
        if (this.winSpotlight) {
            this.winSpotlight.render(this.ctx);
        }

        // 4. Subtle 3D cylindrical shadow overlay at top and bottom
        const gradTop = this.ctx.createLinearGradient(0, 0, 0, 24);
        gradTop.addColorStop(0, 'rgba(0, 0, 0, 0.45)');
        gradTop.addColorStop(1, 'rgba(0, 0, 0, 0)');
        this.ctx.fillStyle = gradTop;
        this.ctx.fillRect(0, 0, CONFIG.canvasWidth, 24);

        const gradBottom = this.ctx.createLinearGradient(0, CONFIG.canvasHeight - 24, 0, CONFIG.canvasHeight);
        gradBottom.addColorStop(0, 'rgba(0, 0, 0, 0)');
        gradBottom.addColorStop(1, 'rgba(0, 0, 0, 0.45)');
        this.ctx.fillStyle = gradBottom;
        this.ctx.fillRect(0, CONFIG.canvasHeight - 24, CONFIG.canvasWidth, 24);
    }

    handleLeverPull() {
        if (this.isSpinning) return;
        this.audio.play('lever');

        // Animate cabinet lever: UP -> MID -> DOWN -> MID -> UP
        const stage = this.dom.machineStage;
        stage.style.backgroundImage = "url('assets/machine_frame_mid.png')";
        setTimeout(() => {
            stage.style.backgroundImage = "url('assets/machine_frame_down.png')";
            setTimeout(() => {
                stage.style.backgroundImage = "url('assets/machine_frame_mid.png')";
                setTimeout(() => {
                    stage.style.backgroundImage = "url('assets/machine_frame_up.png')";
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

        // Turn off any previous win spotlight
        if (this.winSpotlight) {
            this.winSpotlight.stop();
        }

        this.updateHUD();
        this.setControlsDisabled(true);
        this.dom.status.textContent = isFree ? `FREE SPIN (${this.remainingFreeSpins + 1}) - 2X MULTIPLIER ACTIVE!` : 'SPINNING REELS... GOOD LUCK!';
        this.dom.status.style.color = '#ffd700';

        this.audio.play('button');
        this.audio.playSpinLoop();

        // Start all reels spinning
        for (const reel of this.reels) {
            reel.startSpin();
        }

        // Staggered stop sequence
        setTimeout(() => {
            this.reels[0].requestStop(this.currentOutcome[0]);

            setTimeout(() => {
                this.reels[1].requestStop(this.currentOutcome[1]);

                // Suspense check: if reels 0 and 1 match!
                const isSuspense = (this.currentOutcome[0] === this.currentOutcome[1]);
                const delay = isSuspense ? (CONFIG.reelStopDelay + CONFIG.suspenseDelay) : CONFIG.reelStopDelay;

                if (isSuspense) {
                    const matchSymbolObj = CONFIG.symbolWeights.find(w => w.id === this.currentOutcome[0]);
                    const label = matchSymbolObj ? matchSymbolObj.label : this.currentOutcome[0];
                    this.dom.status.textContent = `2x [ ${label} ] MATCHED! SUSPENSE BUILDING FOR REEL 3...`;
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

        const outcomeLabels = this.currentOutcome.map(id => {
            const symObj = CONFIG.symbolWeights.find(w => w.id === id);
            return symObj ? symObj.label : id.toUpperCase();
        });

        if (result.isWin) {
            this.balance += result.amount;
            this.lastWin = result.amount;
            this.dom.win.textContent = result.amount.toLocaleString();
            this.dom.win.classList.add('win-highlight');

            // Trigger the cinematic dark veil spotlight on winning symbols!
            if (this.winSpotlight) {
                this.winSpotlight.start(result.winningReels, this.currentOutcome);
            }

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
                this.dom.status.textContent = `🎉 ${result.title} [ ${outcomeLabels.join(' | ')} ] WON +${result.amount.toLocaleString()} CREDITS!`;
                this.dom.status.style.color = '#2eff8b';
            }
        } else {
            this.dom.status.textContent = `[ ${outcomeLabels.join(' | ')} ] NO MATCH • TRY AGAIN!`;
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
