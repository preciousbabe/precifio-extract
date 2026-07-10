// src/utils/guestSession.js

const GUEST_KEY = 'precifio_guest';

export function getGuestSession() {
  const raw = localStorage.getItem(GUEST_KEY);
  return raw ? JSON.parse(raw) : { extractionCount: 0, hasViewedResult: false };
}

export function recordGuestExtraction() {
  const session = getGuestSession();
  session.extractionCount += 1;
  localStorage.setItem(GUEST_KEY, JSON.stringify(session));
}

export function recordGuestViewedResult() {
  const session = getGuestSession();
  session.hasViewedResult = true;
  localStorage.setItem(GUEST_KEY, JSON.stringify(session));
}

export function canGuestExtract() {
  const session = getGuestSession();
  return session.extractionCount < 1;
}

export function canGuestViewResult() {
  const session = getGuestSession();
  return session.extractionCount === 1 && !session.hasViewedResult;
}

export function hasGuestUsedFreeExtraction() {
  const session = getGuestSession();
  return session.extractionCount >= 1;
}

export function clearGuestSession() {
  localStorage.removeItem(GUEST_KEY);
}