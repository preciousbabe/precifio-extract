// src/utils/guestSession.js

const GUEST_KEY = 'precifio_guest';
const DEVICE_KEY = 'precifio_device_id';

// Simple device fingerprint (not bulletproof, but stops casual abuse)
function getDeviceFingerprint() {
  const raw = [
    navigator.userAgent,
    navigator.language,
    screen.width,
    screen.height,
    screen.colorDepth,
    new Date().getTimezoneOffset()
  ].join('|');
  
  // Simple hash
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    const char = raw.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return String(hash);
}

function getDeviceId() {
  let id = localStorage.getItem(DEVICE_KEY);
  if (!id) {
    id = crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    localStorage.setItem(DEVICE_KEY, id);
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
  
  // If fingerprint changed significantly (new browser/device), reset cautiously
  const currentFp = getDeviceFingerprint();
  if (session.deviceFingerprint && session.deviceFingerprint !== currentFp) {
    // Allow it but flag — real backend validation will catch repeat offenders
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
  // Hard limit: 1 extraction ever per device session
  if (session.extractionCount >= 1) return false;
  
  // Cooldown: must wait 5 seconds between actions (bot throttle)
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
  // Intentionally NOT clearing DEVICE_KEY so repeat guests are trackable
}