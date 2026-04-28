// ── State ────────────────────────────────────────────────────────────────────
const S = {
  sudBefore:    5,
  vocAfter:     4,
  consent:      false,
  sessionStart: null,
  bls: {
    active:   false,
    paused:   false,
    pos:      0,
    dir:      1,
    prevTime: null,
    rafId:    null,
  },
  safePlace: {
    confirmed:   false,
    description: '',
    anchorWord:  '',
    imageURL:    null,
    isEmergency: false,
    cooldownEnd: null,
    bls: { active:false, paused:false, pos:0, dir:1, prevTime:null, rafId:null }
  }
};

let safeBLSCountdownInterval = null;
let safeCountdownRemaining   = 30;
let blsCooldownInterval      = null;
let sharedAudioCtx           = null;

const PHASE_INFO = {
  's-intro':   { n:1, label:'INTRO & CONSENT' },
  's-safe':    { n:2, label:'SAFE PLACE'       },
  's-sud':     { n:3, label:'ASSESSMENT'       },
  's-bls':     { n:4, label:'DESENSITISATION'  },
  's-voc':     { n:5, label:'INSTALLATION'     },
  's-scan':    { n:6, label:'BODY SCAN'        },
  's-closure': { n:7, label:'CLOSURE'          },
  's-summary': { n:8, label:'RE-EVALUATION'    },
};
let dotColorKey              = 'blue';

const DOT_COLORS = {
  blue:   { base: '#6C5CE7', dark: '#A855F7', glow: 'rgba(108,92,231,.55)'  },
  green:  { base: '#10B981', dark: '#059669', glow: 'rgba(16,185,129,.55)'  },
  purple: { base: '#9333EA', dark: '#7C3AED', glow: 'rgba(147,51,234,.55)'  },
  amber:  { base: '#F59E0B', dark: '#D97706', glow: 'rgba(245,158,11,.55)'  },
  teal:   { base: '#14B8A6', dark: '#0D9488', glow: 'rgba(20,184,166,.55)'  },
};

// Bilateral BLS audio state
const A = {
  enabled:    false,
  oscillator: null,
  gainNode:   null,
  pannerNode: null,
};

// Safe Place ambient audio state
const SA = {
  enabled:  false,
  nodes:    [],
  gainNode: null,
};

// ── Screen routing ────────────────────────────────────────────────────────────
function show(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  updatePhaseHeader(id);
  window.scrollTo(0, 0);
}

function updatePhaseHeader(id) {
  const ph = document.getElementById('phase-header');
  if (!ph) return;
  const info = PHASE_INFO[id];
  if (!info) { ph.classList.remove('visible'); return; }
  ph.classList.add('visible');
  document.getElementById('phase-label-text').textContent = `PHASE ${info.n}: ${info.label}`;
  document.querySelectorAll('.phase-dot').forEach((dot, i) => {
    dot.classList.toggle('done',   i + 1 < info.n);
    dot.classList.toggle('active', i + 1 === info.n);
  });
}

// ════════════════════════════════════════════════════════════
// SAFE PLACE MODULE
// ════════════════════════════════════════════════════════════

// SVG scene generators. Each takes a unique prefix `p` so gradient
// IDs never collide when the same scene appears in thumb + viewer.
function svgOcean(p) {
  return `<svg viewBox="0 0 400 260" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice">
  <defs>
    <linearGradient id="${p}sk" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%"   stop-color="#0a1a2e"/>
      <stop offset="48%"  stop-color="#1a4a70"/>
      <stop offset="100%" stop-color="#4a90b8"/>
    </linearGradient>
    <linearGradient id="${p}se" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%"   stop-color="#1a5f8a"/>
      <stop offset="100%" stop-color="#0a2840"/>
    </linearGradient>
    <radialGradient id="${p}sh" cx="50%" cy="50%" r="50%">
      <stop offset="0%"   stop-color="#ffd070" stop-opacity=".55"/>
      <stop offset="100%" stop-color="#ffd070" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="400" height="260" fill="url(#${p}sk)"/>
  <circle cx="282" cy="86" r="56" fill="url(#${p}sh)" class="sun-halo"/>
  <circle cx="282" cy="86" r="28" fill="#ffd070" opacity=".92"/>
  <circle cx="282" cy="86" r="17" fill="#ffe8a0"/>
  <rect y="146" width="400" height="114" fill="url(#${p}se)"/>
  <rect y="144" width="400" height="4"   fill="#7abcd4" opacity=".38"/>
  <ellipse cx="282" cy="151" rx="22" ry="5" fill="#ffd070" opacity=".22"/>
  <polygon points="272,151 292,151 286,204 278,204" fill="#ffd070" opacity=".06"/>
  <g class="wave-a">
    <path d="M0 162 Q25 157 50 162 Q75 167 100 162 Q125 157 150 162 Q175 167 200 162 Q225 157 250 162 Q275 167 300 162 Q325 157 350 162 Q375 167 400 162
             L400 170 Q375 174 350 169 Q325 164 300 169 Q275 174 250 169 Q225 164 200 169 Q175 174 150 169 Q125 164 100 169 Q75 174 50 169 Q25 164 0 170 Z"
          fill="rgba(255,255,255,.15)"/>
  </g>
  <g class="wave-b">
    <path d="M0 177 Q30 172 60 177 Q90 182 120 177 Q150 172 180 177 Q210 182 240 177 Q270 172 300 177 Q330 182 360 177 Q385 173 400 175
             L400 186 Q378 189 352 184 Q322 179 292 184 Q262 189 232 184 Q202 179 172 184 Q142 189 112 184 Q82 179 52 184 Q26 188 0 185 Z"
          fill="rgba(255,255,255,.09)"/>
  </g>
  <path d="M0 228 Q60 220 130 225 Q200 230 268 222 Q328 217 400 221 L400 260 L0 260 Z" fill="#b89458"/>
  <path d="M0 234 Q55 228 115 233 Q185 238 253 231 Q320 224 400 228 L400 250 L0 250 Z" fill="#c9a870" opacity=".72"/>
  <g stroke="#b0ccd8" stroke-width="1.2" fill="none" stroke-linecap="round">
    <path d="M68 55 Q72 51 76 55"/>
    <path d="M89 44 Q94 39 99 44"/>
    <path d="M109 58 Q113 54 117 58"/>
  </g>
</svg>`;
}

function svgForest(p) {
  return `<svg viewBox="0 0 400 260" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice">
  <defs>
    <linearGradient id="${p}sk" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%"   stop-color="#07100a"/>
      <stop offset="55%"  stop-color="#14351c"/>
      <stop offset="100%" stop-color="#22542e"/>
    </linearGradient>
    <radialGradient id="${p}dw" cx="50%" cy="92%" r="52%">
      <stop offset="0%"   stop-color="#b8d860" stop-opacity=".24"/>
      <stop offset="100%" stop-color="#b8d860" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="400" height="260" fill="url(#${p}sk)"/>
  <ellipse cx="200" cy="224" rx="165" ry="105" fill="url(#${p}dw)" class="dawn-glow"/>
  <g fill="#0d1f11" opacity=".62">
    <polygon points="18,192 36,150 54,192"/>
    <polygon points="50,192 70,140 90,192"/>
    <polygon points="84,192 106,154 128,192"/>
    <polygon points="304,192 324,142 344,192"/>
    <polygon points="338,192 360,134 382,192"/>
    <polygon points="364,192 384,148 404,192"/>
  </g>
  <g fill="#102616">
    <polygon points="4,222 36,160 68,222"/>
    <polygon points="48,222 82,154 116,222"/>
    <polygon points="93,222 130,147 167,222"/>
    <polygon points="234,222 270,146 306,222"/>
    <polygon points="282,222 318,152 354,222"/>
    <polygon points="338,222 373,160 408,222"/>
  </g>
  <g fill="#09160b">
    <polygon points="-16,260 30,174 76,260"/>
    <polygon points="40,260 90,162 140,260"/>
    <polygon points="153,260 198,204 243,260"/>
    <polygon points="258,260 302,162 346,260"/>
    <polygon points="320,260 367,175 414,260"/>
  </g>
  <rect y="238" width="400" height="22" fill="#09160b"/>
  <ellipse cx="200" cy="250" rx="66" ry="14" fill="#152f17" opacity=".5"/>
  <circle cx="146" cy="200" r="2"   fill="#cae870" class="ff ff1"/>
  <circle cx="255" cy="190" r="1.5" fill="#d2f07e" class="ff ff2"/>
  <circle cx="184" cy="214" r="1.5" fill="#cae870" class="ff ff3"/>
  <circle cx="215" cy="204" r="2"   fill="#d6f486" class="ff ff4"/>
  <circle cx="170" cy="224" r="1.5" fill="#cae870" class="ff ff5"/>
</svg>`;
}

function svgMountain(p) {
  return `<svg viewBox="0 0 400 260" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice">
  <defs>
    <linearGradient id="${p}sk" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%"   stop-color="#1c3a5e"/>
      <stop offset="55%"  stop-color="#3878ac"/>
      <stop offset="100%" stop-color="#68b0d6"/>
    </linearGradient>
    <linearGradient id="${p}gd" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%"   stop-color="#3a7838"/>
      <stop offset="100%" stop-color="#1e4820"/>
    </linearGradient>
  </defs>
  <rect width="400" height="260" fill="url(#${p}sk)"/>
  <g fill="rgba(255,255,255,.11)">
    <ellipse cx="78"  cy="52" rx="46" ry="14"/>
    <ellipse cx="90"  cy="48" rx="28" ry="10"/>
    <ellipse cx="284" cy="68" rx="56" ry="15"/>
    <ellipse cx="298" cy="63" rx="32" ry="11"/>
  </g>
  <g fill="#4a6882" opacity=".52">
    <polygon points="-12,146 80,80 172,146"/>
    <polygon points="78,146 186,68 294,146"/>
    <polygon points="228,146 326,82 424,146"/>
    <polygon points="308,146 386,92 464,146"/>
  </g>
  <g fill="#395268">
    <polygon points="-22,176 66,100 154,176"/>
    <polygon points="98,176 206,84 314,176"/>
    <polygon points="254,176 350,105 446,176"/>
  </g>
  <path d="M-12 190 Q54 170 114 180 Q174 190 224 172 Q274 153 314 170 Q354 184 416 173 L416 206 L-12 206 Z" fill="#2c4355"/>
  <g fill="#dde8f0" opacity=".70">
    <polygon points="206,84 191,106 221,106"/>
    <polygon points="66,100 54,118 78,118"/>
    <polygon points="326,105 314,120 338,120"/>
  </g>
  <rect y="201" width="400" height="59" fill="url(#${p}gd)"/>
  <path d="M0 206 Q100 201 200 206 Q300 211 400 206 L400 219 Q300 216 200 221 Q100 226 0 221 Z" fill="rgba(90,170,70,.17)"/>
  <g>
    <line x1="42"  y1="216" x2="42"  y2="225" stroke="#5a8a3a" stroke-width="1"/>
    <circle cx="42"  cy="214" r="3"   fill="#e8c870"/>
    <line x1="82"  y1="221" x2="82"  y2="230" stroke="#5a8a3a" stroke-width="1"/>
    <circle cx="82"  cy="219" r="2.5" fill="#e870a0"/>
    <line x1="124" y1="212" x2="124" y2="221" stroke="#5a8a3a" stroke-width="1"/>
    <circle cx="124" cy="210" r="3"   fill="#e8c870"/>
    <line x1="188" y1="214" x2="188" y2="223" stroke="#5a8a3a" stroke-width="1"/>
    <circle cx="188" cy="212" r="3"   fill="#70a8e8"/>
    <line x1="224" y1="223" x2="224" y2="232" stroke="#5a8a3a" stroke-width="1"/>
    <circle cx="224" cy="221" r="2.5" fill="#e870a0"/>
    <line x1="258" y1="214" x2="258" y2="223" stroke="#5a8a3a" stroke-width="1"/>
    <circle cx="258" cy="212" r="3"   fill="#e8c870"/>
    <line x1="294" y1="221" x2="294" y2="230" stroke="#5a8a3a" stroke-width="1"/>
    <circle cx="294" cy="219" r="2"   fill="#70a8e8"/>
    <line x1="328" y1="211" x2="328" y2="220" stroke="#5a8a3a" stroke-width="1"/>
    <circle cx="328" cy="209" r="3"   fill="#e870a0"/>
    <line x1="364" y1="218" x2="364" y2="227" stroke="#5a8a3a" stroke-width="1"/>
    <circle cx="364" cy="216" r="2.5" fill="#e8c870"/>
  </g>
</svg>`;
}

function svgLake(p) {
  return `<svg viewBox="0 0 400 260" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice">
  <defs>
    <linearGradient id="${p}sk" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%"   stop-color="#a8d8f0"/>
      <stop offset="100%" stop-color="#e0f0fa"/>
    </linearGradient>
    <linearGradient id="${p}lk" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%"   stop-color="#b8dff0"/>
      <stop offset="100%" stop-color="#88c4e0"/>
    </linearGradient>
  </defs>
  <rect width="400" height="260" fill="url(#${p}sk)"/>
  <g fill="#4a6c7a" opacity=".65">
    <polygon points="-20,165 80,75 180,165"/>
    <polygon points="60,165 190,58 320,165"/>
    <polygon points="220,165 330,80 440,165"/>
  </g>
  <g fill="#3a5566">
    <polygon points="0,178 100,98 200,178"/>
    <polygon points="150,178 270,82 390,178"/>
    <polygon points="300,178 388,105 460,178"/>
  </g>
  <g fill="#dde8f0" opacity=".8">
    <polygon points="190,58 184,73 196,73"/>
    <polygon points="270,82 263,97 277,97"/>
    <polygon points="100,98 93,111 107,111"/>
  </g>
  <rect y="178" width="400" height="82" fill="url(#${p}lk)"/>
  <g fill="#3a5566" opacity=".18" transform="scale(1,-1) translate(0,-358)">
    <polygon points="0,178 100,98 200,178"/>
    <polygon points="150,178 270,82 390,178"/>
  </g>
  <line x1="0" y1="174" x2="400" y2="174" stroke="#7ab8cc" stroke-width="2" opacity=".4"/>
  <g stroke="#b8d8e8" stroke-width=".8" fill="none" opacity=".45">
    <ellipse cx="200" cy="206" rx="55" ry="5"/>
    <ellipse cx="200" cy="222" rx="88" ry="7"/>
  </g>
</svg>`;
}

function svgBeach(p) {
  return `<svg viewBox="0 0 400 260" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice">
  <defs>
    <linearGradient id="${p}sk" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%"   stop-color="#1a90e0"/>
      <stop offset="55%"  stop-color="#60c8f8"/>
      <stop offset="100%" stop-color="#90e0f8"/>
    </linearGradient>
    <linearGradient id="${p}se" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%"   stop-color="#38bcc8"/>
      <stop offset="100%" stop-color="#1888a8"/>
    </linearGradient>
    <radialGradient id="${p}sh" cx="72%" cy="22%" r="28%">
      <stop offset="0%"   stop-color="#fff8d0" stop-opacity=".85"/>
      <stop offset="100%" stop-color="#fff8d0" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="400" height="260" fill="url(#${p}sk)"/>
  <ellipse cx="288" cy="56" r="36" fill="url(#${p}sh)" class="sun-halo"/>
  <circle cx="288" cy="56" r="22" fill="#fff5a0" opacity=".95"/>
  <rect y="148" width="400" height="80" fill="url(#${p}se)"/>
  <g fill="rgba(255,255,255,.16)">
    <path d="M0 162 Q50 157 100 162 Q150 167 200 162 Q250 157 300 162 Q350 167 400 162 L400 170 Q350 174 300 169 Q250 164 200 169 Q150 174 100 169 Q50 164 0 170 Z"/>
  </g>
  <path d="M0 195 Q100 188 200 193 Q300 198 400 192 L400 260 L0 260 Z" fill="#e8d090"/>
  <path d="M0 205 Q100 200 200 204 Q300 208 400 202 L400 222 L0 222 Z" fill="#f0dc9c" opacity=".7"/>
  <line x1="68" y1="260" x2="60" y2="148" stroke="#5a3a18" stroke-width="5"/>
  <g fill="#3a7a28">
    <ellipse cx="46"  cy="148" rx="30" ry="11" transform="rotate(-25,46,148)"/>
    <ellipse cx="74"  cy="140" rx="30" ry="10" transform="rotate(15,74,140)"/>
    <ellipse cx="52"  cy="138" rx="26" ry="9"  transform="rotate(-55,52,138)"/>
    <ellipse cx="64"  cy="142" rx="22" ry="8"  transform="rotate(40,64,142)"/>
  </g>
  <ellipse cx="320" cy="150" rx="38" ry="5" fill="#2a7850" opacity=".4"/>
</svg>`;
}

function svgNight(p) {
  return `<svg viewBox="0 0 400 260" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice">
  <defs>
    <linearGradient id="${p}sk" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%"   stop-color="#03040e"/>
      <stop offset="55%"  stop-color="#0a0e24"/>
      <stop offset="100%" stop-color="#141830"/>
    </linearGradient>
    <radialGradient id="${p}mo" cx="50%" cy="50%" r="50%">
      <stop offset="0%"   stop-color="#e8f0ff" stop-opacity=".65"/>
      <stop offset="100%" stop-color="#e8f0ff" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="400" height="260" fill="url(#${p}sk)"/>
  <circle cx="300" cy="66" r="44" fill="url(#${p}mo)" class="sun-halo"/>
  <circle cx="300" cy="66" r="22" fill="#e8f0ff" opacity=".92"/>
  <circle cx="292" cy="60" r="15" fill="#dde8ff"/>
  <g fill="#ffffff">
    <circle cx="40"  cy="28"  r="1.2" opacity=".9"/>
    <circle cx="86"  cy="15"  r="1.5" opacity=".85"/>
    <circle cx="128" cy="36"  r="1"   opacity=".7"/>
    <circle cx="168" cy="20"  r="1.3" opacity=".9"/>
    <circle cx="52"  cy="56"  r=".9"  opacity=".6"/>
    <circle cx="106" cy="50"  r="1.2" opacity=".8"/>
    <circle cx="148" cy="68"  r=".8"  opacity=".65"/>
    <circle cx="198" cy="36"  r="1"   opacity=".7"/>
    <circle cx="238" cy="22"  r="1.4" opacity=".9"/>
    <circle cx="218" cy="52"  r=".9"  opacity=".6"/>
    <circle cx="356" cy="18"  r="1.3" opacity=".85"/>
    <circle cx="376" cy="44"  r="1"   opacity=".7"/>
    <circle cx="24"  cy="80"  r=".8"  opacity=".5"/>
    <circle cx="74"  cy="88"  r="1"   opacity=".6"/>
    <circle cx="184" cy="82"  r=".9"  opacity=".55"/>
    <circle cx="338" cy="58"  r="1.1" opacity=".75"/>
  </g>
  <g fill="#0d1226">
    <polygon points="-10,192 60,132 130,192"/>
    <polygon points="50,192 140,102 230,192"/>
    <polygon points="180,192 270,128 360,192"/>
    <polygon points="310,192 375,148 440,192"/>
  </g>
  <rect y="192" width="400" height="68" fill="#080c1c"/>
  <g fill="#e8f0ff" opacity=".06">
    <ellipse cx="300" cy="212" rx="12" ry="48"/>
    <ellipse cx="300" cy="228" rx="20" ry="28"/>
  </g>
  <g stroke="#1e2550" stroke-width="1" fill="none" opacity=".35">
    <ellipse cx="200" cy="222" rx="80" ry="5"/>
    <ellipse cx="200" cy="232" rx="110" ry="7"/>
  </g>
</svg>`;
}

const SCENES = {
  ocean: {
    name: 'Ocean at Dusk',
    caption: 'Let the rhythm of the waves bring you stillness.',
    fn: svgOcean,
  },
  forest: {
    name: 'Forest Glade',
    caption: 'You are held by the quiet of the trees.',
    fn: svgForest,
  },
  mountain: {
    name: 'Mountain Meadow',
    caption: 'Stand in the openness. Feel the sky above you.',
    fn: svgMountain,
  },
  lake: {
    name: 'Mountain Lake',
    caption: 'Still waters hold the mountains. Breathe in the cool air.',
    fn: svgLake,
  },
  beach: {
    name: 'Tropical Beach',
    caption: 'Warm sand. The sound of the tide. Sun on your skin.',
    fn: svgBeach,
  },
  night: {
    name: 'Starry Night',
    caption: 'Infinite sky above. Each star a soft point of rest.',
    fn: svgNight,
  },
};

// Render thumbnails on load (unique prefix per thumb to avoid gradient ID clashes)
window.addEventListener('DOMContentLoaded', () => {
  Object.keys(SCENES).forEach(key => {
    document.getElementById('timg-' + key).innerHTML = SCENES[key].fn('t' + key);
  });
  // Default viewer: ocean
  document.getElementById('scene-viewer').innerHTML = SCENES.ocean.fn('v');
  updatePhaseHeader('s-intro');
  initWelcomeBack();
});

function selectScene(key) {
  // Update thumb selection state
  Object.keys(SCENES).forEach(k => {
    const t = document.getElementById('thumb-' + k);
    const isActive = k === key;
    t.classList.toggle('active', isActive);
    t.setAttribute('aria-pressed', String(isActive));
  });
  // Update viewer (prefix 'v' — only one viewer at a time, no ID clash)
  document.getElementById('scene-viewer').innerHTML = SCENES[key].fn('v');
  document.getElementById('scene-name').textContent    = SCENES[key].name;
  document.getElementById('scene-caption').textContent = SCENES[key].caption;
}

// ── Voice guidance ─────────────────────────────────────────────────────────────
const GUIDANCE = "You are in control. This is your safe place. Take a slow breath in... and out... You are safe right now. Stay here as long as you need.";

function toggleGuidance() {
  if (!('speechSynthesis' in window)) {
    document.getElementById('voice-note').style.display = 'block';
    document.getElementById('voice-note').textContent   = 'Voice guidance is not supported on this browser.';
    return;
  }

  if (speechSynthesis.speaking) {
    speechSynthesis.cancel();
    setVoiceBtn(false);
    return;
  }

  const utt   = new SpeechSynthesisUtterance(GUIDANCE);
  utt.rate    = 0.82;
  utt.pitch   = 0.92;
  utt.volume  = 1;

  // Prefer a calm English voice when available
  const voices  = speechSynthesis.getVoices();
  const calm    = voices.find(v =>
    v.lang.startsWith('en') &&
    /Samantha|Karen|Moira|Serena|Fiona|Google UK English Female/i.test(v.name)
  ) || voices.find(v => v.lang.startsWith('en'));
  if (calm) utt.voice = calm;

  utt.onend = () => setVoiceBtn(false);
  setVoiceBtn(true);
  speechSynthesis.speak(utt);
}

function setVoiceBtn(speaking) {
  document.getElementById('voice-icon').textContent = speaking ? '⏹' : '🔊';
  document.getElementById('voice-label').innerHTML  = speaking
    ? 'Stop guidance'
    : 'Hear calming guidance&nbsp;<small style="font-weight:400;opacity:.7">(optional)</small>';
}

function stopGuidance() {
  if ('speechSynthesis' in window && speechSynthesis.speaking) {
    speechSynthesis.cancel();
  }
  setVoiceBtn(false);
}

// ── Crisis lines ──────────────────────────────────────────────────────────────
const CRISIS_DB = {
  AU:{ name:'Australia',      lines:[{ org:'Lifeline',                      num:'13 11 14',          tel:'131114' },
                                     { org:'Beyond Blue',                   num:'1300 22 4636',      tel:'1300224636' }]},
  AT:{ name:'Austria',        lines:[{ org:'Telefonseelsorge',              num:'142',               tel:'142' }]},
  BE:{ name:'Belgium',        lines:[{ org:'Prévention Suicide',            num:'0800 32 123',       tel:'080032123' }]},
  BR:{ name:'Brazil',         lines:[{ org:'CVV',                           num:'188',               tel:'188' }]},
  CA:{ name:'Canada',         lines:[{ org:'Crisis Services Canada',        num:'1-833-456-4566',    tel:'18334564566' },
                                     { org:'Crisis Text Line',              num:'Text HOME to 686868', tel:null }]},
  DK:{ name:'Denmark',        lines:[{ org:'Livslinien',                    num:'70 201 201',        tel:'70201201' }]},
  FI:{ name:'Finland',        lines:[{ org:'MIELI Crisis Line',             num:'09 2525 0111',      tel:'0925250111' }]},
  FR:{ name:'France',         lines:[{ org:'Prévention Suicide (national)', num:'3114',              tel:'3114' }]},
  DE:{ name:'Germany',        lines:[{ org:'Telefonseelsorge (1)',          num:'0800 111 0 111',    tel:'08001110111' },
                                     { org:'Telefonseelsorge (2)',          num:'0800 111 0 222',    tel:'08001110222' }]},
  HK:{ name:'Hong Kong',      lines:[{ org:'Samaritans HK',                num:'2389 2222',         tel:'+85223892222' }]},
  IN:{ name:'India',          lines:[{ org:'iCall (TISS)',                  num:'9152987821',        tel:'+919152987821' },
                                     { org:'Vandrevala Foundation',         num:'1860-2662-345',     tel:'18002662345' }]},
  IE:{ name:'Ireland',        lines:[{ org:'Samaritans',                   num:'116 123',           tel:'116123' }]},
  IT:{ name:'Italy',          lines:[{ org:'Telefono Amico',               num:'02 2327 2327',      tel:'+390223272327' }]},
  JP:{ name:'Japan',          lines:[{ org:'Inochi no Denwa (free)',        num:'0120-783-556',      tel:'0120783556' },
                                     { org:'TELL Lifeline (English)',       num:'03-5774-0992',      tel:'+81357740992' }]},
  MX:{ name:'Mexico',         lines:[{ org:'SAPTEL',                       num:'55 5259-8121',      tel:'+525552598121' }]},
  NL:{ name:'Netherlands',    lines:[{ org:'113 Zelfmoordpreventie (free)',  num:'0800-0113',        tel:'08000113' }]},
  NZ:{ name:'New Zealand',    lines:[{ org:'Lifeline',                     num:'0800 543 354',      tel:'0800543354' },
                                     { org:'Need to Talk',                 num:'1737',              tel:'1737' }]},
  NO:{ name:'Norway',         lines:[{ org:'Mental Helse',                 num:'116 123',           tel:'116123' }]},
  PH:{ name:'Philippines',    lines:[{ org:'NCMH Crisis Line',             num:'1553',              tel:'1553' }]},
  PT:{ name:'Portugal',       lines:[{ org:'SOS Voz Amiga',                num:'213 544 545',       tel:'+351213544545' }]},
  SG:{ name:'Singapore',      lines:[{ org:'Samaritans of Singapore (SOS)', num:'1767',             tel:'1767' }]},
  ZA:{ name:'South Africa',   lines:[{ org:'SADAG',                        num:'0800 456 789',      tel:'0800456789' },
                                     { org:'SADAG (SMS)',                  num:'SMS 31393',         tel:null }]},
  KR:{ name:'South Korea',    lines:[{ org:'Korea Suicide Prevention',     num:'1393',              tel:'1393' }]},
  ES:{ name:'Spain',          lines:[{ org:'Teléfono de la Esperanza',     num:'717 003 717',       tel:'717003717' }]},
  SE:{ name:'Sweden',         lines:[{ org:'Mind Självmordslinjen',        num:'90101',             tel:'90101' }]},
  CH:{ name:'Switzerland',    lines:[{ org:'Die Dargebotene Hand',         num:'143',               tel:'143' }]},
  GB:{ name:'United Kingdom', lines:[{ org:'Samaritans',                   num:'116 123',           tel:'116123' },
                                     { org:'Crisis Text – SHOUT',         num:'Text SHOUT to 85258', tel:null }]},
  US:{ name:'United States',  lines:[{ org:'988 Suicide & Crisis Lifeline', num:'988',              tel:'988' },
                                     { org:'Crisis Text Line',             num:'Text HOME to 741741', tel:null }]},
};

function guessCrisisCountry() {
  const lang = (navigator.language || '').toLowerCase();
  const map  = {
    'en-us':'US','en-gb':'GB','en-au':'AU','en-ca':'CA','en-nz':'NZ','en-ie':'IE',
    'en-in':'IN','en-sg':'SG','en-ph':'PH','en-hk':'HK','en-za':'ZA',
    'de-at':'AT','de-ch':'CH','de':'DE',
    'fr-be':'BE','fr-ch':'CH','fr':'FR',
    'nl-be':'BE','nl':'NL',
    'sv':'SE','no':'NO','nb':'NO','nn':'NO','da':'DK','fi':'FI',
    'pt-br':'BR','pt':'PT',
    'es-mx':'MX','es':'ES',
    'it':'IT','ja':'JP','ko':'KR',
  };
  for (const [prefix, code] of Object.entries(map)) {
    if (lang === prefix || lang.startsWith(prefix + '-') || lang.startsWith(prefix + '_')) return code;
  }
  return 'US';
}

function buildCrisisSelect() {
  const sel    = document.getElementById('country-sel');
  const sorted = Object.entries(CRISIS_DB).sort((a, b) => a[1].name.localeCompare(b[1].name));
  sorted.forEach(([code, data]) => {
    const opt      = document.createElement('option');
    opt.value      = code;
    opt.textContent = data.name;
    sel.appendChild(opt);
  });
  const guess = guessCrisisCountry();
  if (CRISIS_DB[guess]) sel.value = guess;
  updateCrisisLines();
}

function toggleCrisis() {
  const body    = document.getElementById('crisis-body');
  const chevron = document.getElementById('crisis-chevron');
  const toggle  = document.getElementById('crisis-toggle');
  const opening = body.hidden;
  body.hidden   = !opening;
  chevron.classList.toggle('open', opening);
  toggle.setAttribute('aria-expanded', String(opening));
  // Lazy-build the select on first open
  if (opening && document.getElementById('country-sel').options.length === 0) {
    buildCrisisSelect();
  }
}

function updateCrisisLines() {
  const code = document.getElementById('country-sel').value;
  const data = CRISIS_DB[code];
  const list = document.getElementById('crisis-lines');
  if (!data) { list.innerHTML = ''; return; }
  list.innerHTML = data.lines.map(line => {
    const action = line.tel
      ? `<a href="tel:${line.tel}" class="crisis-call" aria-label="Call ${line.org}">📞 Call</a>`
      : `<span class="crisis-text-only">📱 Text</span>`;
    return `<li class="crisis-item">
      <div class="crisis-item-text">
        <span class="crisis-org">${line.org}</span>
        <span class="crisis-num">${line.num}</span>
      </div>
      ${action}
    </li>`;
  }).join('');
}

// ── Safe-place navigation ──────────────────────────────────────────────────────

function proceedToSUD() {
  stopGuidance();
  show('s-sud');           // → SUD, never directly → BLS
}

function returnHome() {
  stopGuidance();
  show('s-intro');
}

// ════════════════════════════════════════════════════════════
// SESSION FLOW
// ════════════════════════════════════════════════════════════

function startSession() {
  S.consent      = document.getElementById('consent').checked;
  S.sessionStart = Date.now();
  show('s-safe');          // mandatory Safe Place gate
}

function enterBLS() {
  if (!S.safePlace.confirmed) {
    document.getElementById('sud-safe-error').style.display = 'block';
    return;
  }
  document.getElementById('sud-safe-error').style.display = 'none';
  S.sudBefore = +document.getElementById('sud-slider').value;
  show('s-bls');
  document.getElementById('stop-btn').classList.add('visible');
  if (S.safePlace.cooldownEnd && Date.now() < S.safePlace.cooldownEnd) {
    startBLSCooldown();
    return;
  }
  blsStart();
}

// ── BLS engine ────────────────────────────────────────────────────────────────
function blsStart() {
  const b = S.bls;
  if (b.rafId) cancelAnimationFrame(b.rafId);
  b.active = true; b.paused = false; b.prevTime = performance.now();
  blsSetVisuals(false);
  b.rafId = requestAnimationFrame(blsTick);
}
function blsPause() {
  const b = S.bls;
  b.active = false; b.paused = true;
  if (b.rafId) { cancelAnimationFrame(b.rafId); b.rafId = null; }
  blsSetVisuals(true);
  audioDuck(); // fade bilateral audio while dot is paused
}
function blsResume() {
  const b = S.bls;
  b.active = true; b.paused = false; b.prevTime = performance.now();
  blsSetVisuals(false);
  b.rafId = requestAnimationFrame(blsTick);
  audioUnduck(); // restore bilateral audio when dot resumes
}
function blsStop() {
  const b = S.bls;
  b.active = false; b.paused = false;
  if (b.rafId) { cancelAnimationFrame(b.rafId); b.rafId = null; }
  blsSetVisuals(true);
  stopBilateralAudio(); // SAFETY: always silence bilateral audio on stop
}
function blsTick(ts) {
  const b = S.bls;
  if (!b.active) return;
  const elapsed   = (ts - b.prevTime) / 1000;
  b.prevTime      = ts;
  const halfCycle = parseFloat(document.getElementById('speed-slider').value) / 2;
  b.pos += (elapsed / halfCycle) * b.dir;
  if (b.pos >= 1) { b.pos = 1; b.dir = -1; }
  if (b.pos <= 0) { b.pos = 0; b.dir =  1; }
  blsMoveDot();
  b.rafId = requestAnimationFrame(blsTick);
}
function blsMoveDot() {
  const track   = document.getElementById('bls-track');
  const dot     = document.getElementById('bls-dot');
  const maxLeft = track.offsetWidth - dot.offsetWidth;
  dot.style.left = (S.bls.pos * maxLeft) + 'px';
  bilateralAudioSetPan(S.bls.pos); // keep bilateral audio in sync with dot position
}
function blsSetVisuals(paused) {
  document.getElementById('bls-dot').classList.toggle('paused', paused);
  document.getElementById('bls-status').classList.toggle('paused', paused);
  document.getElementById('bls-status-text').textContent = paused
    ? 'Paused — tap outside the dot to resume'
    : 'Running — tap outside the dot to pause';
  applyDotColor(paused);
}

// Track tap: pause/resume (ignore taps directly on the dot)
const blsWrap = document.getElementById('bls-wrap');
if (blsWrap) {
  blsWrap.addEventListener('pointerdown', e => {
    if (e.target === document.getElementById('bls-dot')) return;
    e.preventDefault();
    if (S.bls.active)      blsPause();
    else if (S.bls.paused) blsResume();
  }, { passive: false });
  blsWrap.addEventListener('touchstart', e => e.preventDefault(), { passive: false });
}

function onSpeedChange() {
  const v = parseFloat(document.getElementById('speed-slider').value).toFixed(1);
  document.getElementById('speed-out').textContent = v + 's';
}

// ── STOP button ───────────────────────────────────────────────────────────────
function triggerStop() {
  blsStop();
  teardownAmbientAudio(); // SAFETY: stop all audio on STOP
  document.getElementById('stop-btn').classList.remove('visible');
  if (S.safePlace.confirmed) {
    S.safePlace.isEmergency = true;
    document.getElementById('s-safe').classList.remove('phase-b');
    enterSafePhaseB(true);
  } else {
    document.getElementById('grounding').classList.add('visible');
  }
}
function dismissGrounding() {
  document.getElementById('grounding').classList.remove('visible');
  show('s-bls');
  document.getElementById('stop-btn').classList.add('visible');
  S.bls.paused = true;
  blsSetVisuals(true);
}
function goToBreathing() {
  document.getElementById('grounding').classList.remove('visible');
  document.getElementById('stop-btn').classList.remove('visible');
  show('s-closure');
  startBreathCycle();
}

// ── Page Visibility API ───────────────────────────────────────────────────────
document.addEventListener('visibilitychange', () => {
  const toast = document.getElementById('vis-toast');
  if (document.hidden) {
    // SAFETY: halt all audio and animation immediately when tab is hidden
    if (S.bls.active) { blsPause(); toast.classList.add('visible'); }
    stopBilateralAudio(); // SAFETY: never auto-resume audio — requires manual re-enable
    stopAmbientSound();   // SAFETY: stop ambient sound too
    if (S.safePlace.bls.active) {
      const sb = S.safePlace.bls;
      if (sb.rafId) { cancelAnimationFrame(sb.rafId); sb.rafId = null; }
      sb.active = false; sb.paused = true;
    }
  } else {
    toast.classList.remove('visible');
    // Resume safe-place animation only; audio requires user gesture to restart
    if (S.safePlace.bls.paused) {
      const sb = S.safePlace.bls;
      sb.active = true; sb.paused = false; sb.prevTime = performance.now();
      sb.rafId = requestAnimationFrame(safeBLSTick);
    }
  }
});

// ── BLS → VOC ─────────────────────────────────────────────────────────────────
function endSet() {
  blsStop();
  document.getElementById('stop-btn').classList.remove('visible');
  show('s-voc');
}
function anotherSet() {
  show('s-bls');
  document.getElementById('stop-btn').classList.add('visible');
  S.bls.pos = 0; S.bls.dir = 1;
  blsStart();
}

// ── VOC → Body Scan → Closure ─────────────────────────────────────────────────
function enterBodyScan() {
  S.vocAfter = +document.getElementById('voc-slider').value;
  show('s-scan');
  initBodyScanSVG();
}

function backToVOC() {
  show('s-voc');
}

function enterClosure() {
  show('s-closure');
  startBreathCycle();
}

// ── Breathing cycle ───────────────────────────────────────────────────────────
let breathTimer = null;
function startBreathCycle() {
  if (breathTimer) clearInterval(breathTimer);
  let phase = 0;
  document.getElementById('breath-text').textContent = 'INHALE';
  breathTimer = setInterval(() => {
    phase = 1 - phase;
    document.getElementById('breath-text').textContent =
      phase === 0 ? 'INHALE' : 'EXHALE';
  }, 4000);
}

// ── Finish ────────────────────────────────────────────────────────────────────
function finishSession() {
  if (breathTimer) { clearInterval(breathTimer); breathTimer = null; }
  const now = new Date();
  if (S.consent) {
    console.log('[BLS Session Log]', JSON.stringify({
      timestamp: now.toISOString(),
      sudBefore: S.sudBefore,
      vocAfter:  S.vocAfter,
    }));
  }
  saveSessionHistory();
  show('s-summary');
  if (S.consent) {
    document.getElementById('sum-card').style.display = 'block';
    document.getElementById('sum-time').textContent   = now.toLocaleTimeString();
    document.getElementById('sum-sud').textContent    = S.sudBefore + ' / 10';
    document.getElementById('sum-voc').textContent    = S.vocAfter  + ' / 7';
    const pct   = Math.round((S.vocAfter / 7) * 100);
    const emoji = pct >= 71 ? '✓' : pct >= 43 ? '~' : '↑';
    document.getElementById('sum-delta').textContent  = emoji + ' ' + pct + '% conviction';
  }
  buildHistoryChart();
  const today = new Date().toISOString().slice(0, 10);
  const saved = localStorage.getItem('bls-journal-' + today);
  if (saved) document.getElementById('journal-entry').value = saved;
}

// ── Reset ─────────────────────────────────────────────────────────────────────
function reset() {
  // Safe place teardown
  if (S.safePlace.imageURL) URL.revokeObjectURL(S.safePlace.imageURL);
  safeBLSStop();
  clearInterval(blsCooldownInterval); blsCooldownInterval = null;
  teardownBilateralAudio();
  teardownAmbientAudio();
  Object.assign(S.safePlace, {
    confirmed:false, description:'', anchorWord:'', imageURL:null,
    isEmergency:false, cooldownEnd:null
  });
  Object.assign(S.safePlace.bls, {active:false, paused:false, pos:0, dir:1, prevTime:null, rafId:null});
  safeCountdownRemaining = 30;
  document.getElementById('s-safe').classList.remove('phase-b');
  document.getElementById('safe-description').value           = '';
  document.getElementById('safe-anchor').value                = '';
  document.getElementById('safe-img-filename').textContent    = 'None';
  document.getElementById('trauma-warn').style.display        = 'none';
  document.getElementById('trauma-confirm').checked           = false;
  document.getElementById('safe-confirm-btn').disabled        = true;
  document.getElementById('safe-retry-btn').style.display     = 'none';
  document.getElementById('bls-cooldown').classList.remove('visible');
  document.getElementById('safe-countdown-num').textContent   = '30';

  // Main BLS teardown
  blsStop();
  stopGuidance();

  S.sudBefore = 5; S.vocAfter = 4; S.consent = false; S.sessionStart = null;
  S.bls.pos = 0;   S.bls.dir  = 1;

  document.getElementById('sud-slider').value       = 5;
  document.getElementById('sud-out').textContent    = '5';
  document.getElementById('voc-slider').value       = 4;
  document.getElementById('voc-out').textContent    = '4';
  document.getElementById('speed-slider').value     = 2;
  document.getElementById('speed-out').textContent  = '2.0s';
  document.getElementById('consent').checked        = false;
  document.getElementById('stop-btn').classList.remove('visible');
  document.getElementById('sum-card').style.display   = 'none';
  document.getElementById('hist-card').style.display  = 'none';
  document.getElementById('vis-toast').classList.remove('visible');
  document.getElementById('bls-dot').style.left       = '0px';
  document.getElementById('journal-entry').value      = '';
  document.getElementById('journal-saved-msg').style.display = 'none';
  blsSetVisuals(false);
  setDotColor('blue');
  clearScanZones();
  document.getElementById('scan-notes').value = '';

  // Reset safe place scene to default
  selectScene('ocean');

  initWelcomeBack();
  show('s-intro');
}


// ══ SAFE PLACE PHASE B ENGINE ══════════════════════════════════════════════════

const TRAUMA_WORDS = new Set([
  'abuse','abused','assault','attack','attacked','beaten','blood','bomb',
  'crash','crime','dead','death','disaster','drown','explosion','fear',
  'fight','fire','flood','gun','harm','hit','hurt','injured','kill',
  'murder','pain','panic','rape','shot','stab','terror','threat','torture',
  'trauma','violence','war','wound'
]);

function checkTraumaWords() {
  const desc  = document.getElementById('safe-description').value.toLowerCase();
  const words = desc.match(/\b\w+\b/g) || [];
  const found = words.some(w => TRAUMA_WORDS.has(w));
  const warn  = document.getElementById('trauma-warn');
  warn.style.display = found ? 'block' : 'none';
  if (found && !document.getElementById('trauma-confirm').checked) return true;
  return false;
}

function handleImageUpload(e) {
  const file = e.target.files[0];
  if (!file) return;
  if (S.safePlace.imageURL) URL.revokeObjectURL(S.safePlace.imageURL);
  const url = URL.createObjectURL(file);
  S.safePlace.imageURL = url;
  document.getElementById('scene-viewer').innerHTML =
    `<img src="${url}" style="width:100%;height:100%;object-fit:cover;" alt="Your safe place image">`;
  document.getElementById('safe-img-filename').textContent = file.name;
}

function safePhaseANext() {
  if (checkTraumaWords()) return;
  const anchor = document.getElementById('safe-anchor').value.trim().split(/\s+/)[0] || 'calm';
  S.safePlace.description = document.getElementById('safe-description').value;
  S.safePlace.anchorWord  = anchor;
  enterSafePhaseB(false);
}

function enterSafePhaseB(isEmergency) {
  S.safePlace.isEmergency = isEmergency;
  const sSafe = document.getElementById('s-safe');
  sSafe.classList.add('phase-b');

  document.getElementById('safe-anchor-display').textContent = S.safePlace.anchorWord.toUpperCase();

  const banner = document.getElementById('safe-emergency-banner');
  banner.style.display = isEmergency ? '' : 'none';

  safeCountdownRemaining = 30;
  document.getElementById('safe-countdown-num').textContent = '30';
  document.getElementById('safe-confirm-btn').disabled      = true;
  document.getElementById('safe-retry-btn').style.display   = 'none';

  show('s-safe');
  safeBLSStart();
}

function safeBLSStart() {
  const b = S.safePlace.bls;
  if (b.rafId) cancelAnimationFrame(b.rafId);
  b.active = true; b.paused = false; b.prevTime = performance.now(); b.pos = 0; b.dir = 1;
  safeBLSMoveDot();
  b.rafId = requestAnimationFrame(safeBLSTick);
  if (safeBLSCountdownInterval) clearInterval(safeBLSCountdownInterval);
  safeBLSCountdownInterval = setInterval(safeBLSCountdownTick, 1000);
}

function safeBLSTick(ts) {
  const b = S.safePlace.bls;
  if (!b.active) return;
  const elapsed   = (ts - b.prevTime) / 1000;
  b.prevTime      = ts;
  const halfCycle = 2.5; // fixed 5s/cycle
  const prevPos   = b.pos;
  b.pos += (elapsed / halfCycle) * b.dir;
  if (b.pos >= 1) {
    b.pos = 1; b.dir = -1;
    if (prevPos < 1) safeBLSVibrate();
  }
  if (b.pos <= 0) {
    b.pos = 0; b.dir = 1;
    if (prevPos > 0) safeBLSVibrate();
  }
  safeBLSMoveDot();
  b.rafId = requestAnimationFrame(safeBLSTick);
}

function safeBLSMoveDot() {
  const track   = document.getElementById('safe-bls-track');
  const dot     = document.getElementById('safe-bls-dot');
  const maxLeft = track.offsetWidth - dot.offsetWidth;
  dot.style.left = (S.safePlace.bls.pos * maxLeft) + 'px';
}

function safeBLSStop() {
  const b = S.safePlace.bls;
  b.active = false; b.paused = false;
  if (b.rafId) { cancelAnimationFrame(b.rafId); b.rafId = null; }
  if (safeBLSCountdownInterval) { clearInterval(safeBLSCountdownInterval); safeBLSCountdownInterval = null; }
}

function safeBLSVibrate() {
  if (!navigator.vibrate) return;
  try { navigator.vibrate([100, 50, 200, 50, 100]); } catch (_) {}
}

function safeBLSCountdownTick() {
  if (safeCountdownRemaining > 0) safeCountdownRemaining--;
  document.getElementById('safe-countdown-num').textContent = safeCountdownRemaining;
  if (safeCountdownRemaining === 0) {
    document.getElementById('safe-confirm-btn').disabled    = false;
    document.getElementById('safe-retry-btn').style.display = '';
    clearInterval(safeBLSCountdownInterval);
    safeBLSCountdownInterval = null;
  }
}

function safeRetry() {
  safeBLSStop();
  safeCountdownRemaining = 30;
  document.getElementById('safe-countdown-num').textContent = '30';
  document.getElementById('safe-confirm-btn').disabled      = true;
  document.getElementById('safe-retry-btn').style.display   = 'none';
  safeBLSStart();
}

function confirmCalmness() {
  safeBLSStop();
  S.safePlace.confirmed = true;
  if (S.safePlace.isEmergency) {
    S.safePlace.cooldownEnd = Date.now() + 5 * 60 * 1000;
    show('s-bls');
    document.getElementById('stop-btn').classList.add('visible');
    startBLSCooldown();
  } else {
    proceedToSUD();
  }
}

function startBLSCooldown() {
  document.getElementById('bls-cooldown-word').textContent = S.safePlace.anchorWord.toUpperCase();
  document.getElementById('bls-cooldown').classList.add('visible');
  if (blsCooldownInterval) clearInterval(blsCooldownInterval);
  blsCooldownInterval = setInterval(blsCooldownTick, 1000);
  blsCooldownTick();
}

function blsCooldownTick() {
  const remaining = Math.max(0, S.safePlace.cooldownEnd - Date.now());
  const mins      = Math.floor(remaining / 60000);
  const secs      = Math.floor((remaining % 60000) / 1000);
  document.getElementById('bls-cooldown-timer').textContent =
    String(mins).padStart(2, '0') + ':' + String(secs).padStart(2, '0');
  if (remaining <= 0) {
    clearInterval(blsCooldownInterval); blsCooldownInterval = null;
    document.getElementById('bls-cooldown').classList.remove('visible');
    S.safePlace.cooldownEnd = null;
    blsStart();
  }
}

function toggleSafeGrounding() {
  const body    = document.getElementById('safe-ground-body');
  const chevron = document.getElementById('safe-ground-chevron');
  const toggle  = document.getElementById('safe-ground-toggle');
  const opening = body.hidden;
  body.hidden   = !opening;
  chevron.classList.toggle('open', opening);
  toggle.setAttribute('aria-expanded', String(opening));
}


// ══ DOT COLOR PICKER ══════════════════════════════════════════════════════════

function setDotColor(key) {
  dotColorKey = key;
  applyDotColor(S.bls.active || S.bls.paused ? false : false);
  document.querySelectorAll('.color-swatch').forEach(s =>
    s.classList.toggle('selected', s.dataset.color === key)
  );
}

function applyDotColor(paused) {
  const dot = document.getElementById('bls-dot');
  if (paused) {
    dot.style.background = '';
    dot.style.boxShadow  = '';
  } else {
    const c = DOT_COLORS[dotColorKey] || DOT_COLORS.blue;
    dot.style.background = `radial-gradient(circle at 38% 38%, ${c.base} 0%, ${c.dark} 100%)`;
    dot.style.boxShadow  = `0 0 18px ${c.glow}, 0 0 36px ${c.glow}`;
  }
}


// ══ BILATERAL AUDIO ENGINE ════════════════════════════════════════════════════

function getOrCreateAudioCtx() {
  if (!sharedAudioCtx || sharedAudioCtx.state === 'closed') {
    sharedAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (sharedAudioCtx.state === 'suspended') sharedAudioCtx.resume();
  return sharedAudioCtx;
}

function toggleBilateralAudio() {
  // SAFETY: bilateral audio requires Safe Place confirmation
  if (!S.safePlace.confirmed) return;
  if (A.enabled) {
    stopBilateralAudio();
  } else {
    try {
      const ctx    = getOrCreateAudioCtx();
      A.oscillator = ctx.createOscillator();
      A.gainNode   = ctx.createGain();
      A.pannerNode = ctx.createStereoPanner();

      A.oscillator.type = 'sine';
      A.oscillator.frequency.setValueAtTime(200, ctx.currentTime);
      A.gainNode.gain.setValueAtTime(0, ctx.currentTime);
      A.pannerNode.pan.setValueAtTime(0, ctx.currentTime);

      A.oscillator.connect(A.gainNode);
      A.gainNode.connect(A.pannerNode);
      A.pannerNode.connect(ctx.destination);
      A.oscillator.start();

      const vol = document.getElementById('audio-vol').value / 100;
      A.gainNode.gain.setTargetAtTime(vol, ctx.currentTime, 0.1);
      A.enabled = true;
      updateBilateralBtn(true);
      bilateralAudioSetPan(S.bls.pos);
    } catch (err) {
      document.getElementById('audio-fallback').style.display = 'block';
    }
  }
}

function stopBilateralAudio() {
  if (!A.oscillator) return;
  try {
    A.gainNode.gain.setTargetAtTime(0, sharedAudioCtx.currentTime, 0.08);
    const osc = A.oscillator;
    setTimeout(() => { try { osc.stop(); } catch (_) {} }, 300);
  } catch (_) {}
  A.oscillator = null; A.gainNode = null; A.pannerNode = null;
  A.enabled = false;
  updateBilateralBtn(false);
}

function bilateralAudioSetPan(pos) {
  if (!A.enabled || !A.pannerNode || !sharedAudioCtx) return;
  // pos 0→1 maps to stereo pan -1→+1, tracking the dot in real time
  A.pannerNode.pan.setTargetAtTime((pos * 2) - 1, sharedAudioCtx.currentTime, 0.04);
}

function updateBilateralVolume() {
  const vol = document.getElementById('audio-vol').value / 100;
  document.getElementById('audio-vol-out').textContent = Math.round(vol * 100) + '%';
  if (A.enabled && A.gainNode && sharedAudioCtx) {
    A.gainNode.gain.setTargetAtTime(vol, sharedAudioCtx.currentTime, 0.1);
  }
}

function audioDuck() {
  if (!A.enabled || !A.gainNode || !sharedAudioCtx) return;
  A.gainNode.gain.setTargetAtTime(0, sharedAudioCtx.currentTime, 0.1);
}

function audioUnduck() {
  if (!A.enabled || !A.gainNode || !sharedAudioCtx) return;
  const vol = document.getElementById('audio-vol').value / 100;
  A.gainNode.gain.setTargetAtTime(vol, sharedAudioCtx.currentTime, 0.1);
}

function updateBilateralBtn(on) {
  const btn = document.getElementById('audio-toggle-btn');
  if (!btn) return;
  btn.textContent = on ? '🎵 Bilateral Audio ON' : '🎵 Bilateral Audio OFF';
  btn.classList.toggle('btn-success',   on);
  btn.classList.toggle('btn-secondary', !on);
}

function teardownBilateralAudio() {
  stopBilateralAudio();
  const el = document.getElementById('audio-vol');
  if (el) { el.value = 40; document.getElementById('audio-vol-out').textContent = '40%'; }
}


// ══ AMBIENT SOUND ENGINE (Safe Place) ════════════════════════════════════════

const IMAGERY_TEXT = {
  ocean: 'Feel the rhythm of waves. Cool mist on your skin. You are held by the sea.',
  rain:  'Sunlight filters through leaves. Earth beneath your feet. Rain whispers around you.',
  fire:  'Warm glow. Woodsmoke. Soft blanket around you. The fire crackles gently.',
  piano: 'A gentle chord carries you. Each note fades like breath. You are at rest.',
  silent: '',
};

function onAmbientChange() {
  const key = document.getElementById('ambient-select').value;
  const el  = document.getElementById('imagery-text');
  el.textContent   = IMAGERY_TEXT[key] || '';
  el.style.display = IMAGERY_TEXT[key] ? 'block' : 'none';
  stopAmbientSound();
  if (key !== 'silent') startAmbientSound(key);
}

function startAmbientSound(key) {
  try {
    const ctx = getOrCreateAudioCtx();
    SA.nodes  = [];

    const masterGain = ctx.createGain();
    const vol        = document.getElementById('ambient-vol').value / 100;
    masterGain.gain.setValueAtTime(0, ctx.currentTime);
    masterGain.gain.setTargetAtTime(vol, ctx.currentTime, 0.5);
    masterGain.connect(ctx.destination);
    SA.gainNode = masterGain;

    if (key === 'ocean' || key === 'rain' || key === 'fire') {
      const bufLen = ctx.sampleRate * 4;
      const buf    = ctx.createBuffer(2, bufLen, ctx.sampleRate);
      for (let ch = 0; ch < 2; ch++) {
        const d = buf.getChannelData(ch);
        for (let i = 0; i < bufLen; i++) d[i] = Math.random() * 2 - 1;
      }
      const src = ctx.createBufferSource();
      src.buffer = buf; src.loop = true;
      SA.nodes.push(src);

      const filter = ctx.createBiquadFilter();
      if (key === 'ocean') {
        filter.type = 'bandpass'; filter.frequency.value = 500; filter.Q.value = 0.7;
        // Wave-rhythm LFO via ConstantSourceNode + oscillator
        if (typeof ctx.createConstantSource === 'function') {
          const lfo     = ctx.createOscillator();
          const lfoGain = ctx.createGain();
          const dc      = ctx.createConstantSource();
          lfo.frequency.value  = 0.18; // one wave cycle ~5.5s
          lfoGain.gain.value   = 0.38;
          dc.offset.value      = 0.45;
          lfo.connect(lfoGain);
          lfoGain.connect(masterGain.gain);
          dc.connect(masterGain.gain);
          masterGain.gain.setValueAtTime(0.07, ctx.currentTime);
          lfo.start(); dc.start();
          SA.nodes.push(lfo, dc);
        }
      } else if (key === 'rain') {
        filter.type = 'highpass'; filter.frequency.value = 900;
      } else {
        filter.type = 'lowpass'; filter.frequency.value = 340;
      }
      src.connect(filter);
      filter.connect(masterGain);
      src.start();

    } else if (key === 'piano') {
      // Warm A-major drone: A2 + E3 + A3 with slight detuning
      [110, 165, 220].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const g   = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        osc.detune.value    = (i - 1) * 4;
        g.gain.value        = 0.22 - i * 0.04;
        osc.connect(g);
        g.connect(masterGain);
        osc.start();
        SA.nodes.push(osc);
      });
    }

    SA.enabled = true;
    const muteBtn = document.getElementById('ambient-mute-btn');
    if (muteBtn) { muteBtn.textContent = '🔇'; muteBtn.dataset.muted = '0'; }
  } catch (err) {
    document.getElementById('audio-fallback').style.display = 'block';
  }
}

function stopAmbientSound() {
  SA.nodes.forEach(n => { try { n.stop(); } catch (_) {} });
  SA.nodes = [];
  if (SA.gainNode && sharedAudioCtx) {
    try { SA.gainNode.gain.setTargetAtTime(0, sharedAudioCtx.currentTime, 0.2); } catch (_) {}
  }
  SA.gainNode = null;
  SA.enabled  = false;
}

function toggleAmbientMute() {
  if (!SA.gainNode || !sharedAudioCtx) return;
  const btn   = document.getElementById('ambient-mute-btn');
  const muted = btn.dataset.muted === '1';
  if (muted) {
    const vol = document.getElementById('ambient-vol').value / 100;
    SA.gainNode.gain.setTargetAtTime(vol, sharedAudioCtx.currentTime, 0.2);
    btn.textContent = '🔇'; btn.dataset.muted = '0';
  } else {
    SA.gainNode.gain.setTargetAtTime(0, sharedAudioCtx.currentTime, 0.2);
    btn.textContent = '🔊'; btn.dataset.muted = '1';
  }
}

function updateAmbientVolume() {
  const vol    = document.getElementById('ambient-vol').value / 100;
  const outEl  = document.getElementById('ambient-vol-out');
  if (outEl) outEl.textContent = Math.round(vol * 100) + '%';
  if (SA.gainNode && sharedAudioCtx) {
    SA.gainNode.gain.setTargetAtTime(vol, sharedAudioCtx.currentTime, 0.1);
    const btn = document.getElementById('ambient-mute-btn');
    if (btn && btn.dataset.muted === '1') { btn.textContent = '🔇'; btn.dataset.muted = '0'; }
  }
}

function teardownAmbientAudio() {
  stopAmbientSound();
  const sel = document.getElementById('ambient-select');
  if (sel) sel.value = 'silent';
  const it = document.getElementById('imagery-text');
  if (it) it.style.display = 'none';
}


// ══ SKY CLOUDS — click to rain ════════════════════════════════════════════════

function rainFromCloud(cloud) {
  if (cloud.dataset.raining === '1') return;
  cloud.dataset.raining = '1';
  cloud.classList.add('raining');

  const rect   = cloud.getBoundingClientRect();
  const cx     = rect.left + rect.width  / 2;
  const cy     = rect.bottom;
  const spread = rect.width * 1.1;

  for (let i = 0; i < 45; i++) {
    const drop = document.createElement('div');
    drop.className = 'raindrop';
    const x   = cx - spread / 2 + Math.random() * spread;
    const h   = 8  + Math.random() * 14;
    const del = Math.random() * 750;
    const dur = 680 + Math.random() * 580;
    drop.style.cssText =
      `left:${x}px;top:${cy}px;height:${h}px;` +
      `animation-duration:${dur}ms;animation-delay:${del}ms;`;
    document.body.appendChild(drop);
    setTimeout(() => drop.remove(), dur + del + 60);
  }

  setTimeout(() => {
    cloud.classList.remove('raining');
    cloud.dataset.raining = '0';
  }, 950);
}

// Coordinate-based click detection (clouds sit behind app content at z-index:-1)
document.addEventListener('click', e => {
  document.querySelectorAll('#sky-bg .cloud').forEach(c => {
    const r = c.getBoundingClientRect();
    if (e.clientX >= r.left && e.clientX <= r.right &&
        e.clientY >= r.top  && e.clientY <= r.bottom) {
      rainFromCloud(c);
    }
  });
});

// Cursor feedback on hover
document.addEventListener('mousemove', e => {
  const over = Array.from(document.querySelectorAll('#sky-bg .cloud')).some(c => {
    const r = c.getBoundingClientRect();
    return e.clientX >= r.left && e.clientX <= r.right &&
           e.clientY >= r.top  && e.clientY <= r.bottom;
  });
  if (over) document.body.style.cursor = 'pointer';
  else if (document.body.style.cursor === 'pointer') document.body.style.cursor = '';
});


// ══ BODY SCAN ENGINE ═════════════════════════════════════════════════════════

const BODY_ZONES = [
  { id: 'head',       label: 'Head',           shape: 'ellipse', cx:100, cy:40,  rx:30, ry:34 },
  { id: 'neck',       label: 'Neck',           shape: 'rect',    x:87,  y:67,   w:26,  h:24  },
  { id: 'l-shoulder', label: 'Left shoulder',  shape: 'ellipse', cx:55,  cy:103, rx:22, ry:18 },
  { id: 'r-shoulder', label: 'Right shoulder', shape: 'ellipse', cx:145, cy:103, rx:22, ry:18 },
  { id: 'chest',      label: 'Chest',          shape: 'rect',    x:68,  y:90,   w:64,  h:52  },
  { id: 'abdomen',    label: 'Abdomen',        shape: 'rect',    x:68,  y:142,  w:64,  h:54  },
  { id: 'l-arm',      label: 'Left arm',       shape: 'rect',    x:38,  y:91,   w:26,  h:122 },
  { id: 'r-arm',      label: 'Right arm',      shape: 'rect',    x:136, y:91,   w:26,  h:122 },
  { id: 'l-hand',     label: 'Left hand',      shape: 'ellipse', cx:44,  cy:227, rx:17, ry:20 },
  { id: 'r-hand',     label: 'Right hand',     shape: 'ellipse', cx:156, cy:227, rx:17, ry:20 },
  { id: 'hips',       label: 'Hips',           shape: 'rect',    x:62,  y:192,  w:76,  h:46  },
  { id: 'l-thigh',    label: 'Left thigh',     shape: 'rect',    x:62,  y:227,  w:36,  h:80  },
  { id: 'r-thigh',    label: 'Right thigh',    shape: 'rect',    x:102, y:227,  w:36,  h:80  },
  { id: 'l-knee',     label: 'Left knee',      shape: 'ellipse', cx:80,  cy:315, rx:19, ry:14 },
  { id: 'r-knee',     label: 'Right knee',     shape: 'ellipse', cx:120, cy:315, rx:19, ry:14 },
  { id: 'l-calf',     label: 'Left calf',      shape: 'rect',    x:63,  y:323,  w:34,  h:70  },
  { id: 'r-calf',     label: 'Right calf',     shape: 'rect',    x:103, y:323,  w:34,  h:70  },
  { id: 'l-foot',     label: 'Left foot',      shape: 'ellipse', cx:75,  cy:402, rx:25, ry:14 },
  { id: 'r-foot',     label: 'Right foot',     shape: 'ellipse', cx:125, cy:402, rx:25, ry:14 },
];

const scanZones = new Set();

function initBodyScanSVG() {
  const svg = document.getElementById('body-svg');
  if (!svg) return;

  // Body silhouette (decorative background shapes)
  svg.innerHTML = `
    <ellipse cx="100" cy="40" rx="26" ry="30" fill="#22223a" stroke="#3d3d60" stroke-width="1.5"/>
    <rect x="90" y="68" width="20" height="23" rx="3" fill="#22223a"/>
    <path d="M60,90 Q100,84 140,90 L135,196 Q115,210 100,212 Q85,210 65,196 Z" fill="#22223a" stroke="#3d3d60" stroke-width="1.5"/>
    <rect x="42" y="92" width="18" height="62" rx="9" fill="#22223a" stroke="#3d3d60" stroke-width="1.5"/>
    <rect x="140" y="92" width="18" height="62" rx="9" fill="#22223a" stroke="#3d3d60" stroke-width="1.5"/>
    <rect x="37" y="154" width="17" height="56" rx="8" fill="#22223a" stroke="#3d3d60" stroke-width="1.5"/>
    <rect x="146" y="154" width="17" height="56" rx="8" fill="#22223a" stroke="#3d3d60" stroke-width="1.5"/>
    <ellipse cx="44" cy="224" rx="12" ry="16" fill="#22223a" stroke="#3d3d60" stroke-width="1.5"/>
    <ellipse cx="156" cy="224" rx="12" ry="16" fill="#22223a" stroke="#3d3d60" stroke-width="1.5"/>
    <path d="M65,196 Q100,212 135,196 L134,234 Q100,238 66,234 Z" fill="#22223a"/>
    <rect x="65" y="232" width="28" height="76" rx="8" fill="#22223a" stroke="#3d3d60" stroke-width="1.5"/>
    <rect x="107" y="232" width="28" height="76" rx="8" fill="#22223a" stroke="#3d3d60" stroke-width="1.5"/>
    <rect x="65" y="305" width="28" height="22" fill="#22223a"/>
    <rect x="107" y="305" width="28" height="22" fill="#22223a"/>
    <rect x="65" y="322" width="28" height="68" rx="8" fill="#22223a" stroke="#3d3d60" stroke-width="1.5"/>
    <rect x="107" y="322" width="28" height="68" rx="8" fill="#22223a" stroke="#3d3d60" stroke-width="1.5"/>
    <ellipse cx="73" cy="398" rx="20" ry="12" fill="#22223a" stroke="#3d3d60" stroke-width="1.5"/>
    <ellipse cx="127" cy="398" rx="20" ry="12" fill="#22223a" stroke="#3d3d60" stroke-width="1.5"/>
  `;

  // Interactive zone overlays
  const NS = 'http://www.w3.org/2000/svg';
  BODY_ZONES.forEach(zone => {
    let el;
    if (zone.shape === 'ellipse') {
      el = document.createElementNS(NS, 'ellipse');
      el.setAttribute('cx', zone.cx);
      el.setAttribute('cy', zone.cy);
      el.setAttribute('rx', zone.rx);
      el.setAttribute('ry', zone.ry);
    } else {
      el = document.createElementNS(NS, 'rect');
      el.setAttribute('x',      zone.x);
      el.setAttribute('y',      zone.y);
      el.setAttribute('width',  zone.w);
      el.setAttribute('height', zone.h);
      el.setAttribute('rx', '6');
    }
    el.setAttribute('id',           'bzone-' + zone.id);
    el.setAttribute('class',        'bzone');
    el.setAttribute('fill',         'transparent');
    el.setAttribute('stroke',       'rgba(255,255,255,0.10)');
    el.setAttribute('stroke-width', '1');
    el.setAttribute('data-id',      zone.id);
    el.setAttribute('role',         'button');
    el.setAttribute('tabindex',     '0');
    el.setAttribute('aria-label',   zone.label);
    el.addEventListener('click',   () => toggleScanZone(zone.id));
    el.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') toggleScanZone(zone.id); });
    svg.appendChild(el);
  });

  updateScanZoneVisuals();
}

function toggleScanZone(id) {
  if (scanZones.has(id)) scanZones.delete(id);
  else                   scanZones.add(id);
  updateScanZoneVisuals();
  updateScanTags();
}

function updateScanZoneVisuals() {
  BODY_ZONES.forEach(zone => {
    const el = document.getElementById('bzone-' + zone.id);
    if (!el) return;
    const active = scanZones.has(zone.id);
    el.setAttribute('fill',         active ? 'rgba(239,68,68,0.38)' : 'transparent');
    el.setAttribute('stroke',       active ? '#EF4444'              : 'rgba(255,255,255,0.10)');
    el.setAttribute('stroke-width', active ? '1.5'                  : '1');
  });
}

function updateScanTags() {
  const tagsEl   = document.getElementById('scan-tags');
  const noTagsEl = document.getElementById('scan-no-tags');
  if (!tagsEl || !noTagsEl) return;
  if (scanZones.size === 0) {
    noTagsEl.style.display = '';
    tagsEl.innerHTML = '';
    return;
  }
  noTagsEl.style.display = 'none';
  tagsEl.innerHTML = Array.from(scanZones).map(id => {
    const zone = BODY_ZONES.find(z => z.id === id);
    return `<div class="scan-tag" onclick="toggleScanZone('${id}')">${zone.label} ×</div>`;
  }).join('');
}

function clearScanZones() {
  scanZones.clear();
  const svg = document.getElementById('body-svg');
  if (svg) updateScanZoneVisuals();
  const tagsEl   = document.getElementById('scan-tags');
  const noTagsEl = document.getElementById('scan-no-tags');
  if (tagsEl)   tagsEl.innerHTML = '';
  if (noTagsEl) noTagsEl.style.display = '';
}


// ══ SESSION HISTORY & JOURNAL ═════════════════════════════════════════════════

function saveSessionHistory() {
  if (!S.consent) return;
  try {
    const history = JSON.parse(localStorage.getItem('bls-history') || '[]');
    history.push({ ts: new Date().toISOString(), sud: S.sudBefore, voc: S.vocAfter });
    if (history.length > 20) history.splice(0, history.length - 20);
    localStorage.setItem('bls-history', JSON.stringify(history));
  } catch (_) {}
}

function buildHistoryChart() {
  const card  = document.getElementById('hist-card');
  const chart = document.getElementById('hist-chart');
  if (!card || !chart) return;
  try {
    const history = JSON.parse(localStorage.getItem('bls-history') || '[]');
    if (history.length < 2) { card.style.display = 'none'; return; }
    const last = history.slice(-10);
    card.style.display = 'block';
    document.getElementById('hist-count').textContent = last.length;
    chart.innerHTML = last.map(s => {
      const sudH = Math.round((s.sud / 10) * 100);
      const vocH = Math.round((s.voc / 7)  * 100);
      return `<div class="hist-col">
        <div class="hist-bar sud" style="height:${sudH}%" title="SUD ${s.sud}"></div>
        <div class="hist-bar voc" style="height:${vocH}%" title="VOC ${s.voc}"></div>
      </div>`;
    }).join('');
  } catch (_) {}
}

function saveJournal() {
  const text = document.getElementById('journal-entry').value.trim();
  if (!text) return;
  const today = new Date().toISOString().slice(0, 10);
  try { localStorage.setItem('bls-journal-' + today, text); } catch (_) {}
  const msg = document.getElementById('journal-saved-msg');
  if (msg) {
    msg.style.display = 'block';
    setTimeout(() => { msg.style.display = 'none'; }, 2200);
  }
}

function initWelcomeBack() {
  try {
    const history = JSON.parse(localStorage.getItem('bls-history') || '[]');
    const card    = document.getElementById('welcome-back');
    if (!card) return;
    if (history.length === 0) { card.style.display = 'none'; return; }
    card.style.display = 'block';
    const last = history[history.length - 1];
    document.getElementById('wb-sessions').textContent  = history.length;
    document.getElementById('wb-last-sud').textContent  = last.sud;
    document.getElementById('wb-last-voc').textContent  = last.voc;
    document.getElementById('wb-last-date').textContent = new Date(last.ts).toLocaleDateString(undefined, {
      weekday: 'short', month: 'short', day: 'numeric'
    });
  } catch (_) {}
}
