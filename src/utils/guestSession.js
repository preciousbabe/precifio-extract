const GUEST_KEY = 'precifio_guest';
const DEVICE_KEY = 'precifio_device_id';
const FP_KEY = 'precifio_fp_cache';

// ── Stable device fingerprint ──
export function getDeviceFingerprint() {
  // Cache once per session so it can't drift between upload & poll
  const cached = sessionStorage.getItem(FP_KEY);
  if (cached) return cached;

  const ua = navigator.userAgent
    .replace(/\d+(\.\d+)*/g, '')   // strip all version numbers
    .replace(/\s+/g, ' ')
    .trim();

  const components = [
    ua,
    navigator.platform,
    navigator.language,
    navigator.hardwareConcurrency,
    screen.colorDepth,
    Intl.DateTimeFormat?.().resolvedOptions().timeZone,
    navigator.maxTouchPoints,
    // Round DPR to nearest 0.5 to survive minor zoom changes
    Math.round((window.devicePixelRatio || 1) * 2) / 2,
  ];

  const raw = components.join('::');

  // djb2 hash (better distribution than the old one)
  let hash = 5381;
  for (let i = 0; i < raw.length; i++) {
    hash = ((hash << 5) + hash) + raw.charCodeAt(i);
    hash |= 0;
  }
  const result = String(Math.abs(hash));
  sessionStorage.setItem(FP_KEY, result);
  return result;
}

// ── Device ID (localStorage + cookie fallback) ──
export function getDeviceId() {
  let id = localStorage.getItem(DEVICE_KEY);
  
  if (!id) {
    // Try cookie fallback
    const match = document.cookie.match(new RegExp('(?:^|; )' + DEVICE_KEY + '=([^;]+)'));
    if (match) id = decodeURIComponent(match[1]);
  }
  
  if (!id) {
    id = crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    localStorage.setItem(DEVICE_KEY, id);
    
    // Persist as 1-year cookie for extra resilience
    const expires = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toUTCString();
    document.cookie = `${DEVICE_KEY}=${encodeURIComponent(id)}; expires=${expires}; path=/; SameSite=Strict`;
  }
  
  return id;
}

export function getGuestId() {
  let id = localStorage.getItem('precifio_guest_id');
  if (!id) {
    id = crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    localStorage.setItem('precifio_guest_id', id);
  }

  const session = getGuestSession();
  if (!session.deviceId || session.deviceId !== id) {
    session.deviceId = id;
    localStorage.setItem(GUEST_KEY, JSON.stringify(session));
  }
  return id;
}

export function getGuestSession() {
  const raw = localStorage.getItem(GUEST_KEY);
  const session = raw ? JSON.parse(raw) : { 
    extractionCount: 0, 
    hasViewedResult: false,
    firstSeen: Date.now(),
    deviceFingerprint: getDeviceFingerprint(),
    deviceId: getDeviceId()
  };
  
  const currentFp = getDeviceFingerprint();
  if (session.deviceFingerprint && session.deviceFingerprint !== currentFp) {
    session.suspicious = true;
  }
  
  return session;
}

export function recordGuestExtraction() {
  const session = getGuestSession();
  session.extractionCount += 1;
  session.lastExtractionAt = Date.now();
  localStorage.setItem(GUEST_KEY, JSON.stringify(session));
}

export function recordGuestViewedResult() {
  const session = getGuestSession();
  session.hasViewedResult = true;
  localStorage.setItem(GUEST_KEY, JSON.stringify(session));
}

export function canGuestExtract() {
  const session = getGuestSession();
  if (session.extractionCount >= 1) return false;
  if (session.lastExtractionAt && Date.now() - session.lastExtractionAt < 5000) return false;
  return true;
}

export function canGuestViewResult() {
  const session = getGuestSession();
  return session.extractionCount === 1 && !session.hasViewedResult;
}

export function hasGuestUsedFreeExtraction() {
  const session = getGuestSession();
  return session.extractionCount >= 1;
}

export function isGuestSuspicious() {
  const session = getGuestSession();
  return !!session.suspicious;
}

export function clearGuestSession() {
  localStorage.removeItem(GUEST_KEY);
  localStorage.removeItem('precifio_guest_id');
  // Intentionally keep DEVICE_KEY and cookie so repeat guests are trackable
}