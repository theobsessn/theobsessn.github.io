/* ===== IVY INTRO — SYNCED AUDIO + LYRICS ===== */

// Each line maps to a timestamp in ivy-intro.mp3
// Timestamps determined by audio analysis (pydub silence detection)
const ivyCues = [
    { time: 1.5,  text: "Hello…" },
    { time: 4.6,  text: "I'm Ivy." },
    { time: 6.4,  text: "I'll be your guide tonight." },
    { time: 12.0, text: null },               // clear — dramatic pause
    { time: 12.7, text: "Welcome to the world of" },
    { time: 16.0, text: "The Obsessn." },
    { time: 21.5, text: null },               // clear
    { time: 22.7, text: "No genre." },
    { time: 24.0, text: "No rules." },
    { time: 28.5, text: null },               // clear
    { time: 29.2, text: "Just raw obsession." },
    { time: 33.0, text: null },               // clear
    { time: 33.4, text: "Stay." },
    { time: 40.4, text: "Let me show you everything." },
    { time: 47.0, text: null },               // final clear before transition
];

const ivyLyricsEl = document.getElementById('ivy-lyrics');
const ivyOverlay = document.getElementById('ivy-overlay');
const ivySpeaking = document.getElementById('ivy-speaking');
const ivyWaveform = document.getElementById('ivy-waveform');
const mainSite = document.getElementById('main-site');
let ivyAborted = false;
let ivyAudio = null;
let ivyRAF = null;

// Create waveform bars
for (let i = 0; i < 20; i++) {
    const bar = document.createElement('div');
    bar.classList.add('bar');
    bar.style.animationDelay = `${Math.random() * 1.2}s`;
    bar.style.height = '8px';
    ivyWaveform.appendChild(bar);
}

let displayedLines = [];
let lastCueIndex = -1;

function clearLines() {
    displayedLines.forEach(el => el.classList.add('fading'));
    setTimeout(() => {
        displayedLines.forEach(el => el.remove());
        displayedLines = [];
    }, 500);
}

function showLine(text) {
    // Dim previous lines
    displayedLines.forEach(l => {
        l.classList.remove('highlight');
        l.style.opacity = '0.35';
    });

    const el = document.createElement('div');
    el.classList.add('ivy-line');
    el.textContent = text;
    ivyLyricsEl.appendChild(el);
    displayedLines.push(el);

    // Trigger animation on next frame
    requestAnimationFrame(() => {
        el.classList.add('visible', 'highlight');
    });
}

function syncLyrics() {
    if (ivyAborted || !ivyAudio) return;

    const t = ivyAudio.currentTime;

    // Find which cue we should be at
    for (let i = ivyCues.length - 1; i >= 0; i--) {
        if (t >= ivyCues[i].time && i > lastCueIndex) {
            lastCueIndex = i;
            const cue = ivyCues[i];

            if (cue.text === null) {
                clearLines();
            } else {
                showLine(cue.text);
            }
            break;
        }
    }

    // Check if audio ended
    if (ivyAudio.ended || t >= 50) {
        setTimeout(() => endIvy(), 800);
        return;
    }

    ivyRAF = requestAnimationFrame(syncLyrics);
}

function startIvy() {
    ivyAudio = new Audio('ivy-intro.mp3');
    ivyAudio.volume = 0.95;

    ivyAudio.addEventListener('canplay', () => {
        if (ivyAborted) return;
        ivyAudio.play().then(() => {
            ivySpeaking.classList.add('active');
            ivyWaveform.classList.add('active');
            syncLyrics();
        }).catch(() => {
            // Autoplay blocked — fallback to text-only mode
            runFallback();
        });
    }, { once: true });

    ivyAudio.addEventListener('error', () => {
        runFallback();
    }, { once: true });

    // Safety timeout — if audio fails to load in 3s, fallback
    setTimeout(() => {
        if (lastCueIndex === -1 && !ivyAborted) {
            runFallback();
        }
    }, 3000);
}

// Fallback: text-only mode if audio can't play
async function runFallback() {
    if (ivyAborted) return;
    ivySpeaking.classList.add('active');
    ivyWaveform.classList.add('active');

    const lines = ivyCues.filter(c => c.text !== null);
    for (const cue of lines) {
        if (ivyAborted) break;
        showLine(cue.text);
        await new Promise(r => setTimeout(r, 1200 + cue.text.length * 35));
        // Check if next cue is a clear
        const idx = ivyCues.indexOf(cue);
        if (idx < ivyCues.length - 1 && ivyCues[idx + 1].text === null) {
            await new Promise(r => setTimeout(r, 400));
            clearLines();
            await new Promise(r => setTimeout(r, 300));
        }
    }
    if (!ivyAborted) {
        await new Promise(r => setTimeout(r, 1000));
        endIvy();
    }
}

function endIvy() {
    if (ivyAborted) return;
    ivyAborted = true;
    if (ivyAudio) { ivyAudio.pause(); ivyAudio = null; }
    if (ivyRAF) cancelAnimationFrame(ivyRAF);
    ivySpeaking.classList.remove('active');
    ivyWaveform.classList.remove('active');
    ivyOverlay.classList.add('fade-out');
    mainSite.classList.remove('hidden');
    setTimeout(() => { ivyOverlay.style.display = 'none'; }, 900);
}

ivyOverlay.addEventListener('click', () => { if (!ivyAborted) endIvy(); });
document.addEventListener('keydown', (e) => {
    if (!ivyAborted && (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ')) endIvy();
});

// Start after a brief delay
setTimeout(startIvy, 500);

/* ===== PARTICLE SYSTEM ===== */
const canvas = document.getElementById('particle-canvas');
const ctx = canvas.getContext('2d');
let particles = [];
const PARTICLE_COUNT = 60;

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

class Particle {
    constructor() { this.reset(); }
    reset() {
        this.x = Math.random() * canvas.width;
        this.y = Math.random() * canvas.height;
        this.size = Math.random() * 2 + 0.5;
        this.speedX = (Math.random() - 0.5) * 0.3;
        this.speedY = (Math.random() - 0.5) * 0.3;
        this.opacity = Math.random() * 0.4 + 0.1;
        this.pulse = Math.random() * Math.PI * 2;
    }
    update() {
        this.x += this.speedX;
        this.y += this.speedY;
        this.pulse += 0.01;
        const op = this.opacity + Math.sin(this.pulse) * 0.1;
        if (this.x < -10 || this.x > canvas.width + 10 || this.y < -10 || this.y > canvas.height + 10) this.reset();
        return op;
    }
    draw(op) {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(196, 30, 58, ${Math.max(0, op)})`;
        ctx.fill();
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size * 3, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(196, 30, 58, ${Math.max(0, op * 0.15)})`;
        ctx.fill();
    }
}

for (let i = 0; i < PARTICLE_COUNT; i++) particles.push(new Particle());

function animateParticles() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles.forEach(p => { const op = p.update(); p.draw(op); });
    requestAnimationFrame(animateParticles);
}
animateParticles();

/* ===== NAVBAR ===== */
const navbar = document.getElementById('navbar');
const navToggle = document.getElementById('nav-toggle');
const mobileMenu = document.getElementById('mobile-menu');

window.addEventListener('scroll', () => {
    navbar.classList.toggle('scrolled', window.scrollY > 80);
});

navToggle.addEventListener('click', () => {
    navToggle.classList.toggle('active');
    mobileMenu.classList.toggle('open');
});

document.querySelectorAll('.mobile-link').forEach(link => {
    link.addEventListener('click', () => {
        navToggle.classList.remove('active');
        mobileMenu.classList.remove('open');
    });
});

/* ===== ACTIVE NAV ON SCROLL ===== */
const sections = document.querySelectorAll('section[id]');
const navLinks = document.querySelectorAll('.nav-link[data-section]');

function updateActiveNav() {
    const scrollPos = window.scrollY + 200;
    sections.forEach(section => {
        const top = section.offsetTop;
        const height = section.offsetHeight;
        const id = section.getAttribute('id');
        if (scrollPos >= top && scrollPos < top + height) {
            navLinks.forEach(link => {
                link.classList.toggle('active', link.getAttribute('data-section') === id);
            });
        }
    });
}
window.addEventListener('scroll', updateActiveNav);

/* ===== SCROLL REVEAL ===== */
const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('revealed');
            revealObserver.unobserve(entry.target);
        }
    });
}, { threshold: 0.15, rootMargin: '0px 0px -50px 0px' });

document.querySelectorAll('.reveal-up').forEach(el => revealObserver.observe(el));

/* ===== SMOOTH SCROLL ===== */
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
});
