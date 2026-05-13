/* ===== IVY INTRO — VOICE + LYRICS ===== */
const ivyLines = [
    "Hello…",
    "I'm Ivy.",
    "",
    "Welcome to the world of",
    "The Obsessn.",
    "",
    "An artist with no defined genre…",
    "just following whatever feels real",
    "in the moment.",
    "",
    "Stay a while.",
    "Let me show you."
];

const ivyLyricsEl = document.getElementById('ivy-lyrics');
const ivyOverlay = document.getElementById('ivy-overlay');
const ivySpeaking = document.getElementById('ivy-speaking');
const ivyWaveform = document.getElementById('ivy-waveform');
const mainSite = document.getElementById('main-site');
let ivyAborted = false;
let ivySpeech = null;

// Create waveform bars
for (let i = 0; i < 20; i++) {
    const bar = document.createElement('div');
    bar.classList.add('bar');
    bar.style.animationDelay = `${Math.random() * 1.2}s`;
    bar.style.height = '8px';
    ivyWaveform.appendChild(bar);
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Pick the best female voice available
function getFemaleVoice() {
    const voices = speechSynthesis.getVoices();
    // Priority: look for specific premium female voices
    const preferred = [
        'Samantha', 'Karen', 'Moira', 'Tessa', 'Fiona', 'Victoria',
        'Zira', 'Hazel', 'Susan', 'Google UK English Female',
        'Microsoft Zira', 'Google US English'
    ];
    for (const name of preferred) {
        const v = voices.find(v => v.name.includes(name));
        if (v) return v;
    }
    // Fallback: any English female voice
    const english = voices.filter(v => v.lang.startsWith('en'));
    if (english.length > 0) return english[0];
    return voices[0] || null;
}

function speakLine(text) {
    return new Promise((resolve) => {
        if (ivyAborted || !text.trim()) { resolve(); return; }
        if (!('speechSynthesis' in window)) { resolve(); return; }

        const utter = new SpeechSynthesisUtterance(text);
        const voice = getFemaleVoice();
        if (voice) utter.voice = voice;
        utter.rate = 0.85;
        utter.pitch = 1.1;
        utter.volume = 0.9;
        utter.onend = () => resolve();
        utter.onerror = () => resolve();
        ivySpeech = utter;
        speechSynthesis.speak(utter);
    });
}

async function runIvy() {
    // Wait for voices to load
    await new Promise(r => {
        if (speechSynthesis.getVoices().length) { r(); return; }
        speechSynthesis.onvoiceschanged = () => r();
        setTimeout(r, 1500); // fallback
    });

    await sleep(600);
    ivySpeaking.classList.add('active');
    ivyWaveform.classList.add('active');

    let displayedLines = [];

    for (let i = 0; i < ivyLines.length; i++) {
        if (ivyAborted) break;
        const line = ivyLines[i];

        if (!line.trim()) {
            // Empty line = dramatic pause + clear previous
            await sleep(600);
            // Fade out all current lines
            displayedLines.forEach(el => el.classList.add('fading'));
            await sleep(500);
            displayedLines.forEach(el => el.remove());
            displayedLines = [];
            continue;
        }

        // Create lyric line
        const el = document.createElement('div');
        el.classList.add('ivy-line');
        el.textContent = line;
        ivyLyricsEl.appendChild(el);
        displayedLines.push(el);

        // Fade previous lines slightly
        displayedLines.forEach((l, idx) => {
            if (idx < displayedLines.length - 1) {
                l.classList.remove('highlight');
                l.style.opacity = '0.4';
            }
        });

        // Animate in + highlight current
        await sleep(50);
        el.classList.add('visible', 'highlight');

        // Speak
        if ('speechSynthesis' in window && line.trim()) {
            await speakLine(line);
        } else {
            // Fallback timing if no speech
            await sleep(800 + line.length * 30);
        }

        if (ivyAborted) break;
        await sleep(200);
    }

    if (!ivyAborted) {
        ivySpeaking.classList.remove('active');
        ivyWaveform.classList.remove('active');
        await sleep(1000);
        endIvy();
    }
}

function endIvy() {
    if (ivyAborted) return;
    ivyAborted = true;
    if (ivySpeech) speechSynthesis.cancel();
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

runIvy();

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
