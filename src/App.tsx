import { CSSProperties, Component, FormEvent, useEffect, useRef, useState } from "react";
import * as React from "react";
import { Navigate, Route, Routes, useNavigate } from "react-router-dom";

type Lang = "en" | "fr";
type AppTab = "home" | "prayers" | "journal" | "goals" | "wellness" | "ai" | "community" | "profile" | "support" | "notifications" | "admin";
type User = {
  fullName: string;
  email: string;
  language: Lang;
  plan: string;
  isAdmin?: boolean;
  photoUrl?: string | null;
  authProvider?: "email" | "google";
  isEmailVerified?: boolean;
  hasCompletedOnboarding?: boolean;
  timezone?: string;
  reminderHour?: number;
  reminderMinute?: number;
  dailyEmailEnabled?: boolean;
  pushNotificationsEnabled?: boolean;
  bibleVersion?: string;
};
type Goal = { id: string; text: string; done: boolean; kind?: string; content?: string; durationSeconds?: number };
type JournalEntry = { id: string; body: string; date: string };
type ChatMessage = { role: "assistant" | "user"; content: string };
type Analytics = { totalPrayers: number; visitCount: number; currentStreak: number; answeredPrayers: number; completedGoals: number; gracePeriodAvailable?: boolean; lastActiveDate?: string | null };
type MoodCheckIn = { checkedIn: boolean; log?: { mood: string; note?: string | null } | null };
type MannaGift = { verse: string; ref: string; blessing: string };
type DailyManna = { available?: boolean; streak?: number; totalClaimed?: number; preview?: MannaGift; gift?: MannaGift };
type Prayer = { id: string; prayer_text: string; is_answered?: boolean; testimony?: string | null };
type Declaration = { declaration?: { id: string; text: string }; confirmedToday?: boolean; streak?: number };
type GrowthScoreCategory = { key: string; label: string; weight: number; score: number; detail: string };
type GrowthScore = { overall: number; categories: GrowthScoreCategory[] };
type PrayerItem = { id?: string; identifier?: string; title: string; body: string; icon: React.ReactNode; tone: string; mood?: string; verse?: string; reference?: string; action?: string };
type PrayerExperience = {
  scriptures: Array<{ verse: string; reference: string }>;
  confessions: string[];
  guidedPrayer: string;
  encouragement: string[];
};
type Wellness = { overall?: number; insight?: string; pillars?: Record<string, { score?: number; count?: number }> };
type AppNotification = { id: string; type: string; title: string; body: string; readAt?: string | null; createdAt: string; metadata?: Record<string, unknown> };
type SupportTicket = { id: string; subject: string; status: string; priority?: string; messages: Array<{ role: string; body: string; senderName?: string; senderEmail?: string; createdAt?: string }>; user?: { email?: string; fullName?: string; subscriptionStatus?: string } ; updatedAt?: string; createdAt?: string };
type DeletionFeedback = { id: string; user_email: string; user_full_name?: string | null; reason: string; feedback: string; created_at: string };
type OnboardingOption = { emoji: string; label: string; exclusive?: boolean };
type OnboardingStepType = "tour" | "single" | "multi" | "reminder" | "email" | "profile" | "premium" | "summary";
type OnboardingStep = { id: string; section: string; title: string; subtitle?: string; type: OnboardingStepType; options?: OnboardingOption[]; maxSelect?: number; optional?: boolean };
type ReminderSettings = {
  hour: number;
  minute: number;
  timezone: string;
  dailyEmailEnabled: boolean;
  pushNotificationsEnabled: boolean;
};
type SubscriptionPlan = {
  tier: string;
  currency: string;
  monthlyPriceUsd: number;
  termMonths: number;
  fullTermPriceUsd: number;
  firstTermDiscountPercent: number;
  firstTermPriceUsd: number;
  googlePlayProductId?: string;
  labelEn?: string;
  labelFr?: string;
};
type MonetizationStatus = {
  plan: string;
  isPremium: boolean;
  isPaid?: boolean;
  isAdmin: boolean;
  plans?: SubscriptionPlan[];
  ads?: {
    enabled?: boolean;
    bannerEnabled?: boolean;
    aiUnlockEnabled?: boolean;
    banner?: { titleEn?: string; titleFr?: string; bodyEn?: string; bodyFr?: string; ctaEn?: string; ctaFr?: string };
    aiGate?: { titleEn?: string; titleFr?: string; bodyEn?: string; bodyFr?: string; ctaEn?: string; ctaFr?: string };
  };
  ai?: { maxDailyUses?: number; usedToday?: number; remainingToday?: number; requiresAdUnlock?: boolean };
};

class ApiError extends Error {
  status: number;
  data: any;

  constructor(message: string, status: number, data: any) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

const API_URL = import.meta.env.VITE_API_URL || "https://revivespring.onrender.com/api";
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";
const IUBENDA_PRIVACY_URL = "https://www.iubenda.com/privacy-policy/60287717";
const IUBENDA_COOKIE_URL = "https://www.iubenda.com/privacy-policy/60287717/cookie-policy";
const ROTATING_QUOTES = [
  { verse: "Trust in the Lord with all your heart.", reference: "Proverbs 3:5" },
  { verse: "The Lord is my shepherd; I shall not want.", reference: "Psalm 23:1" },
  { verse: "Be strong and courageous. Do not be afraid.", reference: "Joshua 1:9" },
  { verse: "I can do all things through Christ who strengthens me.", reference: "Philippians 4:13" },
  { verse: "The Lord is close to the brokenhearted.", reference: "Psalm 34:18" },
];

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (options: { client_id: string; callback: (response: { credential?: string }) => void }) => void;
          renderButton: (parent: HTMLElement, options: Record<string, string | number | boolean>) => void;
        };
      };
    };
  }
}

class AppErrorBoundary extends Component<{ children: React.ReactNode }, { crashed: boolean }> {
  state = { crashed: false };
  static getDerivedStateFromError() {
    return { crashed: true };
  }
  render() {
    if (!this.state.crashed) return this.props.children;
    const language = storedLang();
    return <main className="splash-screen">
      <Brand />
      <h1>{tr(language, "Let us refresh your session", "Actualisons votre session")}</h1>
      <p>{tr(language, "Your saved browser session is out of date. Refreshing will take you back to sign in safely.", "Votre session enregistree dans le navigateur est obsolete. L'actualisation vous ramenera a la connexion en toute securite.")}</p>
      <button className="button primary" onClick={() => {
        localStorage.removeItem("rs_user");
        localStorage.removeItem("rs_token");
        localStorage.removeItem("rs_onboarded");
        window.location.href = "/auth";
      }}>{tr(language, "Refresh session", "Actualiser la session")}</button>
    </main>;
  }
}

function loadGoogleIdentity() {
  return new Promise<void>((resolve, reject) => {
    if (window.google?.accounts?.id) return resolve();
    const existing = document.querySelector<HTMLScriptElement>('script[src="https://accounts.google.com/gsi/client"]');
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("Google Sign-In failed to load.")), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Google Sign-In failed to load."));
    document.head.appendChild(script);
  });
}
async function api<T>(path: string, options: RequestInit = {}, token?: string): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
  });
  const data = response.status === 204 ? null : await response.json();
  if (!response.ok) throw new ApiError(data?.message || "Request failed.", response.status, data);
  return data as T;
}
function mapUser(raw: any): User {
  const hasCompletedOnboarding = raw.hasCompletedOnboarding ?? (raw.onboardingData?.completedAt || raw.onboarding_data?.completedAt ? true : undefined);
  return {
    fullName: raw.fullName || raw.full_name || "Friend",
    email: raw.email,
    language: raw.language || "en",
    plan: raw.subscriptionStatus || raw.plan || "free",
    isAdmin: raw.role === "admin",
    photoUrl: raw.profileImageUrl || raw.profile_image_url || raw.photoUrl || null,
    authProvider: raw.authProvider || raw.auth_provider || "email",
    isEmailVerified: raw.isEmailVerified !== false,
    hasCompletedOnboarding,
    timezone: raw.timezone || "UTC",
    reminderHour: typeof raw.reminderHour === "number" ? raw.reminderHour : raw.registeredHour,
    reminderMinute: typeof raw.reminderMinute === "number" ? raw.reminderMinute : 0,
    dailyEmailEnabled: raw.dailyEmailEnabled !== false,
    pushNotificationsEnabled: raw.pushNotificationsEnabled !== false,
    bibleVersion: raw.bibleVersion || "NIV",
  };
}
function normalizeUser(raw: any, fallbackLanguage: Lang | null): User | null {
  if (!raw || !raw.email) return null;
  const hasCompletedOnboarding = raw.hasCompletedOnboarding ?? (raw.onboardingData?.completedAt || raw.onboarding_data?.completedAt ? true : undefined);
  return {
    fullName: raw.fullName || raw.full_name || raw.name || raw.displayName || "Friend",
    email: raw.email,
    language: raw.language || fallbackLanguage || "en",
    plan: raw.plan || raw.subscriptionStatus || "free",
    isAdmin: raw.isAdmin === true || raw.role === "admin",
    photoUrl: raw.profileImageUrl || raw.profile_image_url || raw.photoUrl || null,
    authProvider: raw.authProvider || raw.auth_provider || "email",
    isEmailVerified: raw.isEmailVerified !== false,
    hasCompletedOnboarding,
    timezone: raw.timezone || "UTC",
    reminderHour: typeof raw.reminderHour === "number" ? raw.reminderHour : raw.registeredHour,
    reminderMinute: typeof raw.reminderMinute === "number" ? raw.reminderMinute : 0,
    dailyEmailEnabled: raw.dailyEmailEnabled !== false,
    pushNotificationsEnabled: raw.pushNotificationsEnabled !== false,
    bibleVersion: raw.bibleVersion || "NIV",
  };
}
function mapGoal(raw: any): Goal {
  return { id: raw.id, text: raw.text, done: raw.completed === true, kind: raw.kind, content: raw.content, durationSeconds: raw.duration_seconds || 10 };
}

function slugify(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "prayer";
}

function prayerIdentifier(item: PrayerItem) {
  return item.identifier || item.id || `generated-${slugify(`${item.mood || "guided"}-${item.title}-${item.reference || ""}`)}`;
}

function prayerStorageKey(item: PrayerItem) {
  return `rs_prayer_recorded_${prayerIdentifier(item)}`;
}

const LANG_LABELS: Record<Lang, string> = { en: "English", fr: "Francais" };

function tr(language: Lang | null | undefined, en: string, fr: string) {
  return language === "fr" ? fr : en;
}

function storedLang(): Lang {
  try {
    const raw = localStorage.getItem("rs_language");
    return raw === "fr" ? "fr" : "en";
  } catch {
    return "en";
  }
}

function navItemsFor(language: Lang, includeAdmin = false) {
  const items: { id: AppTab; label: string; icon: React.ReactNode }[] = [
    { id: "home", label: tr(language, "Home", "Accueil"), icon: <UiIcon name="home" /> },
    { id: "prayers", label: tr(language, "Pray", "Prier"), icon: <UiIcon name="pray" /> },
    { id: "journal", label: tr(language, "Journal", "Journal"), icon: <UiIcon name="journal" /> },
    { id: "goals", label: tr(language, "Goals", "Objectifs"), icon: <UiIcon name="goals" /> },
    { id: "wellness", label: tr(language, "Wellness", "Bien-etre"), icon: <UiIcon name="wellness" /> },
    { id: "ai", label: tr(language, "AI Companion", "Assistant IA"), icon: <UiIcon name="ai" /> },
    { id: "profile", label: tr(language, "Profile", "Profil"), icon: <UiIcon name="profile" /> },
  ];
  return includeAdmin ? [...items, { id: "admin" as const, label: tr(language, "Admin", "Admin"), icon: <UiIcon name="admin" /> }] : items;
}

type UiIconName = "home" | "pray" | "journal" | "goals" | "wellness" | "ai" | "profile" | "support" | "notification" | "admin" | "community";

function UiIcon({ name, size = 16 }: { name: UiIconName; size?: number }) {
  const paths: Record<UiIconName, string[]> = {
    home: ["M3 10.5 12 3l9 7.5", "M5 9.5V21h14V9.5", "M9 21v-7h6v7"],
    pray: ["M8 12.5 6.4 10.9a2.2 2.2 0 0 0-3.1 3.1L12 22l8.7-8a2.2 2.2 0 0 0-3.1-3.1L16 12.5", "M12 22V8", "M9 8h6", "M12 3v5"],
    journal: ["M4 5a2 2 0 0 1 2-2h12v18H6a2 2 0 0 1-2-2V5Z", "M8 7h6", "M8 11h8", "M8 15h5"],
    goals: ["M6 21V4", "M6 4h11l-2 4 2 4H6"],
    wellness: ["M12 21s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 11c0 5.6-7 10-7 10Z", "M8 13h2l1-2 2 4 1-2h2"],
    ai: ["M12 3l1.4 4.2L18 8.6l-4.2 1.4L12 15l-1.8-5L6 8.6l4.6-1.4L12 3Z", "M5 16l.7 2.1L8 19l-2.3.9L5 22l-.7-2.1L2 19l2.3-.9L5 16Z"],
    profile: ["M20 21a8 8 0 0 0-16 0", "M12 13a5 5 0 1 0 0-10 5 5 0 0 0 0 10Z"],
    support: ["M21 12.5a8.5 8.5 0 0 1-8.5 8.5 9.3 9.3 0 0 1-3.5-.7L3 21l.8-5.6A8.5 8.5 0 1 1 21 12.5Z", "M8.5 12h.01", "M12 12h.01", "M15.5 12h.01", "M9 16h5"],
    notification: ["M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9", "M10 21h4"],
    admin: ["M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z", "M9 12l2 2 4-4"],
    community: ["M17 20v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1", "M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z", "M23 20v-1a4 4 0 0 0-3-3.9", "M16 3.1a4 4 0 0 1 0 7.8"],
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{paths[name].map((path) => <path d={path} key={path} />)}</svg>;
}

function MoodIcon({ name, size = 20 }: { name: MoodIconName; size?: number }) {
  const paths: Record<MoodIconName, string[]> = {
    breath: ["M4 12h7a3 3 0 1 0-3-3", "M3 16h10a3 3 0 1 1-3 3", "M5 8h2"],
    coins: ["M12 5c4.4 0 8 1.3 8 3s-3.6 3-8 3-8-1.3-8-3 3.6-3 8-3Z", "M4 8v4c0 1.7 3.6 3 8 3s8-1.3 8-3V8", "M4 12v4c0 1.7 3.6 3 8 3s8-1.3 8-3v-4"],
    rain: ["M7 17a4 4 0 0 1-.8-7.9A6 6 0 0 1 18 10.5a3.5 3.5 0 0 1-.5 7", "M8 20l1-2", "M12 21l1-3", "M16 20l1-2"],
    compass: ["M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z", "M15.5 8.5l-2 5-5 2 2-5 5-2Z"],
    sparkle: ["M12 3l1.7 5.1L19 10l-5.3 1.9L12 17l-1.7-5.1L5 10l5.3-1.9L12 3Z", "M5 16l.8 2.2L8 19l-2.2.8L5 22l-.8-2.2L2 19l2.2-.8L5 16Z"],
    cross: ["M12 4v16", "M7 9h10", "M8 20h8"],
    briefcase: ["M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2", "M4 7h16v12H4V7Z", "M4 12h16", "M10 12v2h4v-2"],
    shield: ["M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z", "M9 12l2 2 4-4"],
    dove: ["M4 12c4-1 7-4 9-9 1 4-.2 7-3 9", "M10 12c3 1 6 1 10-1-2.5 3.5-6 5-10 5H5", "M5 16l-2 3"],
    person: ["M20 21a8 8 0 0 0-16 0", "M12 13a5 5 0 1 0 0-10 5 5 0 0 0 0 10Z"],
    waves: ["M3 8c2 0 2-2 4-2s2 2 4 2 2-2 4-2 2 2 4 2", "M3 14c2 0 2-2 4-2s2 2 4 2 2-2 4-2 2 2 4 2", "M3 20c2 0 2-2 4-2s2 2 4 2 2-2 4-2 2 2 4 2"],
    moon: ["M20 15.5A8.5 8.5 0 0 1 8.5 4a7 7 0 1 0 11.5 11.5Z"],
    sunrise: ["M4 18h16", "M6 15a6 6 0 0 1 12 0", "M12 3v4", "M4.2 7.2 7 10", "M19.8 7.2 17 10"],
    smile: ["M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z", "M8 14s1.5 2 4 2 4-2 4-2", "M9 9h.01", "M15 9h.01"],
    flame: ["M12 22c4 0 7-2.7 7-6.7 0-3.1-2.2-5.5-4.3-7.3.1 2.1-.8 3.5-2.1 4.4.1-3.2-1.7-6-4.2-8.4.2 3.2-2.4 5.4-3.2 7.6A7.3 7.3 0 0 0 12 22Z"],
    sprout: ["M12 21V10", "M12 10C8 10 5 7.5 5 4c4 0 7 2.5 7 6Z", "M12 12c4 0 7-2.5 7-6-4 0-7 2.5-7 6Z"],
    lamp: ["M9 18h6", "M10 22h4", "M8 14h8l-1.3-8H9.3L8 14Z", "M12 2v4"],
    heart: ["M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"],
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{paths[name].map((path) => <path d={path} key={path} />)}</svg>;
}

const NAV_ITEMS: { id: AppTab; label: string; icon: React.ReactNode }[] = [
  { id: "home", label: "Home", icon: <UiIcon name="home" /> },
  { id: "prayers", label: "Pray", icon: <UiIcon name="pray" /> },
  { id: "journal", label: "Journal", icon: <UiIcon name="journal" /> },
  { id: "goals", label: "Goals", icon: <UiIcon name="goals" /> },
  { id: "wellness", label: "Wellness", icon: <UiIcon name="wellness" /> },
  { id: "ai", label: "AI Companion", icon: <UiIcon name="ai" /> },
  { id: "community", label: "Community", icon: <UiIcon name="community" /> },
  { id: "profile", label: "Profile", icon: <UiIcon name="profile" /> },
];
const PRAYER_LIBRARY = [
  { identifier: "library-morning-renewal", title: "Morning Renewal", body: "Lord, align my heart with peace, wisdom, and courage today.", icon: <MoodIcon name="sunrise" />, tone: "emerald" },
  { identifier: "library-anxiety-support", title: "Anxiety Support", body: "A quiet prayer for calm breathing and steady faith.", icon: <MoodIcon name="breath" />, tone: "sky" },
  { identifier: "library-healing", title: "Healing", body: "A hopeful prayer for body, mind, and relationships.", icon: <MoodIcon name="cross" />, tone: "green" },
  { identifier: "library-family", title: "Family", body: "Cover the people I love with unity and grace.", icon: <MoodIcon name="heart" />, tone: "coral" },
];
const MOODS = ["Anxious", "Financial stress", "Sad", "Confused", "Grateful", "Healing", "Need a job", "Protection", "Need peace", "Lonely", "Overwhelmed", "Tired", "Hopeful", "Joyful", "Tempted", "Discouraged", "Seeking wisdom", "Family concern"];
type MoodIconName = "breath" | "coins" | "rain" | "compass" | "sparkle" | "cross" | "briefcase" | "shield" | "dove" | "person" | "waves" | "moon" | "sunrise" | "smile" | "flame" | "sprout" | "lamp" | "heart";
type MoodVerse = { verse: string; reference: string };
type MoodPrayer = { icon: MoodIconName; tone: string; body: string; action: string; verses: MoodVerse[] };
const MOOD_PRAYERS: Record<string, MoodPrayer> = {
  "Anxious": { icon: "breath", tone: "sky", body: "Father, steady my breathing and remind my heart that I am held by You. Replace fear with trust and help me take the next peaceful step.", action: "Pause for three slow breaths and name one thing God is carrying with you.", verses: [
    { verse: "Cast all your care upon him; for he careth for you.", reference: "1 Peter 5:7" },
    { verse: "Be careful for nothing; but in every thing by prayer... let your requests be made known unto God.", reference: "Philippians 4:6" },
    { verse: "Peace I leave with you, my peace I give unto you.", reference: "John 14:27" },
    { verse: "What time I am afraid, I will trust in thee.", reference: "Psalm 56:3" },
  ] },
  "Financial stress": { icon: "coins", tone: "gold", body: "Lord, give me wisdom, discipline, and courage. Open honest doors of provision and keep my worth rooted in Your love.", action: "Write one practical money step you can take today.", verses: [
    { verse: "My God shall supply all your need according to his riches in glory by Christ Jesus.", reference: "Philippians 4:19" },
    { verse: "The Lord is my shepherd; I shall not want.", reference: "Psalm 23:1" },
    { verse: "Seek ye first the kingdom of God... and all these things shall be added unto you.", reference: "Matthew 6:33" },
    { verse: "Commit thy works unto the Lord, and thy thoughts shall be established.", reference: "Proverbs 16:3" },
  ] },
  "Sad": { icon: "rain", tone: "sky", body: "God of comfort, meet me tenderly. Sit with me in this sadness and let hope rise again, even if it starts small.", action: "Tell God honestly what hurts, without editing your words.", verses: [
    { verse: "The Lord is nigh unto them that are of a broken heart.", reference: "Psalm 34:18" },
    { verse: "Blessed are they that mourn: for they shall be comforted.", reference: "Matthew 5:4" },
    { verse: "Weeping may endure for a night, but joy cometh in the morning.", reference: "Psalm 30:5" },
    { verse: "He healeth the broken in heart, and bindeth up their wounds.", reference: "Psalm 147:3" },
  ] },
  "Confused": { icon: "compass", tone: "emerald", body: "Lord, clear the noise around me. Lead me with wisdom, patience, and a calm mind that can recognize Your direction.", action: "Ask God one clear question, then sit quietly for one minute.", verses: [
    { verse: "If any of you lack wisdom, let him ask of God.", reference: "James 1:5" },
    { verse: "Trust in the Lord with all thine heart... and he shall direct thy paths.", reference: "Proverbs 3:5-6" },
    { verse: "Thy word is a lamp unto my feet, and a light unto my path.", reference: "Psalm 119:105" },
    { verse: "I will instruct thee and teach thee in the way which thou shalt go.", reference: "Psalm 32:8" },
  ] },
  "Grateful": { icon: "sparkle", tone: "gold", body: "Father, thank You for the gifts I can see and the ones I nearly missed. Make gratitude my rhythm today.", action: "Name three blessings out loud, however small.", verses: [
    { verse: "In every thing give thanks: for this is the will of God.", reference: "1 Thessalonians 5:18" },
    { verse: "O give thanks unto the Lord; for he is good.", reference: "Psalm 107:1" },
    { verse: "Every good gift and every perfect gift is from above.", reference: "James 1:17" },
    { verse: "Bless the Lord, O my soul, and forget not all his benefits.", reference: "Psalm 103:2" },
  ] },
  "Healing": { icon: "cross", tone: "leaf", body: "Jesus, bring healing where I am wounded. Restore my body, mind, relationships, and faith with Your gentle power.", action: "Place a hand over the area of pain and pray for restoration.", verses: [
    { verse: "With his stripes we are healed.", reference: "Isaiah 53:5" },
    { verse: "I am the Lord that healeth thee.", reference: "Exodus 15:26" },
    { verse: "Heal me, O Lord, and I shall be healed.", reference: "Jeremiah 17:14" },
    { verse: "The prayer of faith shall save the sick, and the Lord shall raise him up.", reference: "James 5:15" },
  ] },
  "Need a job": { icon: "briefcase", tone: "emerald", body: "Lord, guide my work, applications, interviews, and courage. Open the right door and prepare me to walk through it faithfully.", action: "Choose one job step: apply, follow up, update your CV, or ask for help.", verses: [
    { verse: "Whatsoever ye do, do it heartily, as to the Lord.", reference: "Colossians 3:23" },
    { verse: "Let the beauty of the Lord our God be upon us: and establish thou the work of our hands.", reference: "Psalm 90:17" },
    { verse: "A man's gift maketh room for him.", reference: "Proverbs 18:16" },
    { verse: "The steps of a good man are ordered by the Lord.", reference: "Psalm 37:23" },
  ] },
  "Protection": { icon: "shield", tone: "emerald", body: "Lord, surround me and the people I love. Keep us alert, wise, and covered by Your presence.", action: "Pray protection over your home, travel, and loved ones by name.", verses: [
    { verse: "The Lord shall preserve thee from all evil.", reference: "Psalm 121:7" },
    { verse: "He shall give his angels charge over thee, to keep thee in all thy ways.", reference: "Psalm 91:11" },
    { verse: "The name of the Lord is a strong tower.", reference: "Proverbs 18:10" },
    { verse: "No weapon that is formed against thee shall prosper.", reference: "Isaiah 54:17" },
  ] },
  "Need peace": { icon: "dove", tone: "sky", body: "Prince of Peace, quiet my inner world. Let Your presence settle what pressure has stirred up.", action: "Release one worry to God by writing it in a single sentence.", verses: [
    { verse: "Thou wilt keep him in perfect peace, whose mind is stayed on thee.", reference: "Isaiah 26:3" },
    { verse: "The peace of God... shall keep your hearts and minds through Christ Jesus.", reference: "Philippians 4:7" },
    { verse: "Let the peace of God rule in your hearts.", reference: "Colossians 3:15" },
    { verse: "The Lord will give strength unto his people; the Lord will bless his people with peace.", reference: "Psalm 29:11" },
  ] },
  "Lonely": { icon: "person", tone: "coral", body: "Father, meet me in the quiet places. Remind me that I am seen, known, and never abandoned.", action: "Send one honest message to someone safe, or pray for connection.", verses: [
    { verse: "I will never leave thee, nor forsake thee.", reference: "Hebrews 13:5" },
    { verse: "When my father and my mother forsake me, then the Lord will take me up.", reference: "Psalm 27:10" },
    { verse: "The Lord is my shepherd; I shall not want.", reference: "Psalm 23:1" },
    { verse: "I am with you alway, even unto the end of the world.", reference: "Matthew 28:20" },
  ] },
  "Overwhelmed": { icon: "waves", tone: "sky", body: "God, help me slow down and carry only what belongs to this moment. Be my strength where I feel stretched thin.", action: "Pick one small next step and leave the rest with God for now.", verses: [
    { verse: "Come unto me, all ye that labour and are heavy laden, and I will give you rest.", reference: "Matthew 11:28" },
    { verse: "When my heart is overwhelmed: lead me to the rock that is higher than I.", reference: "Psalm 61:2" },
    { verse: "God is our refuge and strength, a very present help in trouble.", reference: "Psalm 46:1" },
    { verse: "My grace is sufficient for thee: for my strength is made perfect in weakness.", reference: "2 Corinthians 12:9" },
  ] },
  "Tired": { icon: "moon", tone: "leaf", body: "Lord, restore my strength. Teach me holy rest and renew what exhaustion has drained.", action: "Give yourself permission to rest for ten minutes without guilt.", verses: [
    { verse: "He giveth power to the faint; and to them that have no might he increaseth strength.", reference: "Isaiah 40:29" },
    { verse: "They that wait upon the Lord shall renew their strength.", reference: "Isaiah 40:31" },
    { verse: "I will both lay me down in peace, and sleep: for thou, Lord, only makest me dwell in safety.", reference: "Psalm 4:8" },
    { verse: "He restoreth my soul.", reference: "Psalm 23:3" },
  ] },
  "Hopeful": { icon: "sunrise", tone: "gold", body: "God of new beginnings, grow this hope into steady faith. Help me notice signs of Your goodness today.", action: "Write one reason you believe tomorrow can be different.", verses: [
    { verse: "Now faith is the substance of things hoped for.", reference: "Hebrews 11:1" },
    { verse: "For I know the thoughts that I think toward you... to give you an expected end.", reference: "Jeremiah 29:11" },
    { verse: "Weeping may endure for a night, but joy cometh in the morning.", reference: "Psalm 30:5" },
    { verse: "The God of hope fill you with all joy and peace in believing.", reference: "Romans 15:13" },
  ] },
  "Joyful": { icon: "smile", tone: "gold", body: "Lord, thank You for joy. Let this gladness overflow into kindness, worship, and encouragement for others.", action: "Share one joyful word with someone today.", verses: [
    { verse: "The joy of the Lord is your strength.", reference: "Nehemiah 8:10" },
    { verse: "Rejoice in the Lord alway: and again I say, Rejoice.", reference: "Philippians 4:4" },
    { verse: "This is the day which the Lord hath made; we will rejoice and be glad in it.", reference: "Psalm 118:24" },
    { verse: "A merry heart doeth good like a medicine.", reference: "Proverbs 17:22" },
  ] },
  "Tempted": { icon: "flame", tone: "coral", body: "Jesus, strengthen my will and focus my heart. Show me the way out and help me choose what gives life.", action: "Move away from the trigger and replace it with one healthy action.", verses: [
    { verse: "God is faithful... but will with the temptation also make a way to escape.", reference: "1 Corinthians 10:13" },
    { verse: "Submit yourselves therefore to God. Resist the devil, and he will flee from you.", reference: "James 4:7" },
    { verse: "Watch and pray, that ye enter not into temptation.", reference: "Matthew 26:41" },
    { verse: "Thy word have I hid in mine heart, that I might not sin against thee.", reference: "Psalm 119:11" },
  ] },
  "Discouraged": { icon: "sprout", tone: "leaf", body: "Lord, lift my head again. Help me believe that this hard chapter is not the whole story.", action: "Remember one past moment when God helped you through.", verses: [
    { verse: "Be strong and of a good courage; be not afraid.", reference: "Joshua 1:9" },
    { verse: "Let us not be weary in well doing: for in due season we shall reap.", reference: "Galatians 6:9" },
    { verse: "Why art thou cast down, O my soul? hope thou in God.", reference: "Psalm 42:11" },
    { verse: "The righteous cry, and the Lord heareth.", reference: "Psalm 34:17" },
  ] },
  "Seeking wisdom": { icon: "lamp", tone: "emerald", body: "Father, shape my decisions with truth, humility, and clarity. Help me choose the path that honors You.", action: "List your options and ask which one produces peace, love, and wisdom.", verses: [
    { verse: "The fear of the Lord is the beginning of wisdom.", reference: "Proverbs 9:10" },
    { verse: "If any of you lack wisdom, let him ask of God.", reference: "James 1:5" },
    { verse: "Counsel is mine, and sound wisdom.", reference: "Proverbs 8:14" },
    { verse: "Teach me thy way, O Lord; I will walk in thy truth.", reference: "Psalm 86:11" },
  ] },
  "Family concern": { icon: "heart", tone: "coral", body: "Lord, cover my family with patience, forgiveness, protection, and love. Heal what is strained and strengthen what is good.", action: "Pray for one family member by name and bless them specifically.", verses: [
    { verse: "As for me and my house, we will serve the Lord.", reference: "Joshua 24:15" },
    { verse: "Be ye kind one to another, tenderhearted, forgiving one another.", reference: "Ephesians 4:32" },
    { verse: "Charity suffereth long, and is kind.", reference: "1 Corinthians 13:4" },
    { verse: "Blessed are the peacemakers: for they shall be called the children of God.", reference: "Matthew 5:9" },
  ] },
};
const CHART_NAMES = ["Naomi", "Micah", "Esther", "Daniel", "Grace", "Elias", "Hannah", "Caleb", "Abigail", "Josiah"];
const CHART_SERIES = [
  { id: "growth", label: "Spiritual growth", percent: 92, accent: "gold" },
  { id: "healing", label: "Healing", percent: 58, accent: "leaf" },
  { id: "decisions", label: "Decisions", percent: 71, accent: "sky" },
  { id: "relationships", label: "Relationships", percent: 84, accent: "coral" },
] as const;
const REMINDER_HOURS = Array.from({ length: 12 }, (_, index) => index + 1);
const REMINDER_MINUTES = Array.from({ length: 12 }, (_, index) => index * 5);
const ONBOARDING_STEPS: OnboardingStep[] = [
  // Section 1 — Welcome
  { id: "tour", section: "Welcome", title: "ReviveMe is your daily space for prayer, growth, and peace.", type: "tour", options: [
    { emoji: "🙏", label: "Prayer" }, { emoji: "📓", label: "Journal" }, { emoji: "✅", label: "Daily Goals" },
  ] },
  // Section 2 — Faith Background
  { id: "faithJourney", section: "Faith Background", title: "Where are you on your faith journey right now?", type: "single", options: [
    { emoji: "🌱", label: "I'm brand new to Christianity" }, { emoji: "📖", label: "I'm growing but still learning" },
    { emoji: "🌳", label: "I've walked with God for many years" }, { emoji: "🔄", label: "I'm returning after a period away" },
    { emoji: "🤔", label: "I'm exploring and not sure yet" },
  ] },
  { id: "churchConnection", section: "Faith Background", title: "Are you currently connected to a church or faith community?", type: "single", options: [
    { emoji: "✅", label: "Yes, I attend regularly" }, { emoji: "🔄", label: "Sometimes, not consistently" },
    { emoji: "🏠", label: "I worship on my own at home" }, { emoji: "🔍", label: "I'm looking for a community" },
    { emoji: "❌", label: "No, not currently" },
  ] },
  { id: "bibleFamiliarity", section: "Faith Background", title: "How familiar are you with the Bible?", type: "single", options: [
    { emoji: "📗", label: "I'm just starting to read it" }, { emoji: "📘", label: "I know the basics and some stories" },
    { emoji: "📙", label: "I read it regularly" }, { emoji: "📕", label: "I study it deeply and consistently" },
  ] },
  { id: "salvation", section: "Faith Background", title: "Have you made a personal decision to follow Jesus Christ?", type: "single", options: [
    { emoji: "✝️", label: "Yes, I have" }, { emoji: "🌱", label: "I'm not sure — I'd like to know more" },
    { emoji: "🙏", label: "I'd like to make that decision today" }, { emoji: "🤔", label: "Not yet, but I'm open" },
  ] },
  // Section 3 — Prayer Needs
  { id: "lifeSeason", section: "Prayer Needs", title: "What best describes your life right now?", type: "single", options: [
    { emoji: "🌊", label: "I'm going through a very difficult season" }, { emoji: "⛅", label: "Things are okay but I need more peace" },
    { emoji: "☀️", label: "Life is good and I want to stay connected" }, { emoji: "🌱", label: "I'm in a season of new beginnings" },
    { emoji: "🔄", label: "I'm in a transition or major change" },
  ] },
  { id: "prayerFocus", section: "Prayer Needs", title: "What do you most want to bring to God in prayer?", subtitle: "Choose up to 3", type: "multi", maxSelect: 3, options: [
    { emoji: "😰", label: "Anxiety & fear" }, { emoji: "💔", label: "Healing & pain" }, { emoji: "👨‍👩‍👧", label: "Family & relationships" },
    { emoji: "💰", label: "Finances & provision" }, { emoji: "🧭", label: "Direction & big decisions" }, { emoji: "💪", label: "Strength & perseverance" },
    { emoji: "😴", label: "Sleep, rest & peace of mind" }, { emoji: "🙌", label: "Praise & worship" }, { emoji: "❤️", label: "Salvation of a loved one" },
    { emoji: "🤝", label: "Forgiveness & reconciliation" },
  ] },
  { id: "emotionalState", section: "Prayer Needs", title: "How are you feeling most days lately?", type: "single", options: [
    { emoji: "😟", label: "Overwhelmed and heavy" }, { emoji: "😐", label: "Okay but going through the motions" },
    { emoji: "😌", label: "Peaceful but wanting to grow deeper" }, { emoji: "😊", label: "Grateful and full of faith" },
    { emoji: "😔", label: "Lonely or disconnected from God" },
  ] },
  { id: "mentalWellness", section: "Prayer Needs", title: "Do any of these affect your day-to-day life?", subtitle: "Select all that apply", type: "multi", options: [
    { emoji: "😥", label: "Anxiety or excessive worry" }, { emoji: "😞", label: "Low mood or depression" }, { emoji: "😤", label: "Stress and burnout" },
    { emoji: "😴", label: "Poor sleep" }, { emoji: "😔", label: "Grief or loss" }, { emoji: "💭", label: "Low self-worth" },
    { emoji: "✅", label: "None of these — I'm doing well", exclusive: true },
  ] },
  { id: "prayerUrgency", section: "Prayer Needs", title: "Is there something specific you need God to move on right now?", type: "single", options: [
    { emoji: "🔥", label: "Yes — I'm in urgent need" }, { emoji: "🙏", label: "Yes — ongoing but not urgent" },
    { emoji: "🌿", label: "Not specifically — I just want to grow" }, { emoji: "🤲", label: "I want to learn how to pray more" },
  ] },
  // Section 4 — Spiritual Goals
  { id: "spiritualGoals", section: "Spiritual Goals", title: "What do you most want ReviveMe to help you with?", subtitle: "Choose up to 2", type: "multi", maxSelect: 2, options: [
    { emoji: "🔥", label: "Build a consistent daily prayer habit" }, { emoji: "📖", label: "Know and understand the Bible better" },
    { emoji: "☮️", label: "Find more peace and calm in life" }, { emoji: "💪", label: "Stay strong through a hard season" },
    { emoji: "🌟", label: "Grow closer to God personally" }, { emoji: "🙌", label: "Experience a breakthrough" },
    { emoji: "🧘", label: "Improve my mental and emotional wellbeing" },
  ] },
  { id: "commitmentLevel", section: "Spiritual Goals", title: "How much time can you realistically give to prayer each day?", type: "single", options: [
    { emoji: "⚡", label: "5 minutes — short and focused" }, { emoji: "🕐", label: "10–15 minutes — a meaningful pause" },
    { emoji: "🕑", label: "20–30 minutes — deep and unhurried" }, { emoji: "🕒", label: "More than 30 minutes — I want to go deep" },
  ] },
  { id: "streakMotivation", section: "Spiritual Goals", title: "What keeps you consistent in spiritual habits?", type: "single", options: [
    { emoji: "🏆", label: "Seeing my progress and streaks" }, { emoji: "🔔", label: "Being reminded at the right time" },
    { emoji: "📖", label: "Having fresh content every day" }, { emoji: "👥", label: "Knowing others are praying too" },
    { emoji: "🎯", label: "Having a clear goal to work toward" },
  ] },
  { id: "journeyType", section: "Spiritual Goals", title: "What kind of prayer experience do you prefer?", type: "single", options: [
    { emoji: "📝", label: "Written prayers I can read and follow" }, { emoji: "📖", label: "A Bible verse to sit with and reflect on" },
    { emoji: "🎯", label: "A short daily action step to live out" }, { emoji: "🎙️", label: "Free, guided conversation with AI" },
    { emoji: "🔀", label: "A healthy mix of all of the above" },
  ] },
  // Section 5 — Daily Rhythm
  { id: "bestPrayerTime", section: "Daily Rhythm", title: "When do you feel most open to prayer?", type: "single", options: [
    { emoji: "🌅", label: "Early morning — before the day begins" }, { emoji: "☀️", label: "Mid-morning — once I've settled in" },
    { emoji: "🌤️", label: "Afternoon — midday reset" }, { emoji: "🌆", label: "Evening — winding down" },
    { emoji: "🌙", label: "Night — quiet before bed" }, { emoji: "🔀", label: "It varies for me" },
  ] },
  { id: "reminderTime", section: "Daily Rhythm", title: "Set your daily prayer reminder", type: "reminder" },
  { id: "email", section: "Daily Rhythm", title: "Your daily prayer email will go to:", type: "email" },
  // Section 6 — Faith Personalization
  { id: "denomination", section: "Faith Personalization", title: "Which best describes your Christian background?", subtitle: "Optional", type: "single", optional: true, options: [
    { emoji: "✝️", label: "Catholic" }, { emoji: "🕊️", label: "Protestant / Evangelical" }, { emoji: "🙌", label: "Pentecostal / Charismatic" },
    { emoji: "✝️", label: "Orthodox" }, { emoji: "🌍", label: "African Traditional Christian" }, { emoji: "🌐", label: "Non-denominational" },
    { emoji: "🤷", label: "Not sure / Prefer not to say" },
  ] },
  { id: "prayerLanguageStyle", section: "Faith Personalization", title: "When you read a prayer, what tone feels most natural?", type: "single", options: [
    { emoji: "🤝", label: "Conversational — like talking to a friend" }, { emoji: "📜", label: "Traditional — formal and reverent" },
    { emoji: "🔥", label: "Bold & declarative — strong faith confessions" }, { emoji: "🌊", label: "Gentle & reflective — quiet and meditative" },
  ] },
  { id: "scripturePreference", section: "Faith Personalization", title: "Which Bible translation do you prefer?", type: "single", options: [
    { emoji: "📖", label: "NIV — easy to understand" }, { emoji: "📖", label: "KJV — classic and traditional" },
    { emoji: "📖", label: "NLT — simple, everyday language" }, { emoji: "📖", label: "ESV — precise and modern" },
    { emoji: "📖", label: "No preference — surprise me" },
  ] },
  { id: "testimonialIntent", section: "Faith Personalization", title: "Would you like to track answered prayers?", type: "single", options: [
    { emoji: "✅", label: "Yes — I want to mark prayers as answered" }, { emoji: "📓", label: "Yes — and write a brief testimony when they are" },
    { emoji: "🔄", label: "Maybe later" }, { emoji: "❌", label: "No, not for me" },
  ] },
  // Section 7 — Final Steps
  { id: "profile", section: "Final Steps", title: "How should we address you in your prayers?", type: "profile" },
  { id: "premiumChoice", section: "Final Steps", title: "Unlock everything ReviveMe has to offer", subtitle: "Unlimited AI chat · Mental Wellness content · No ads", type: "premium" },
  { id: "summary", section: "Final Steps", title: "You're ready! 🎉", type: "summary" },
];

function useStore<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => {
    try { return JSON.parse(localStorage.getItem(key) || "") as T; } catch { return initial; }
  });
  useEffect(() => localStorage.setItem(key, JSON.stringify(value)), [key, value]);
  return [value, setValue] as const;
}

export default function App() {
  const [language, setLanguage] = useStore<Lang | null>("rs_language", null);
  const [user, setUser] = useStore<User | null>("rs_user", null);
  const [token, setToken] = useStore<string | null>("rs_token", null);
  const [onboarded, setOnboarded] = useStore("rs_onboarded", false);
  const activeUser = normalizeUser(user, language);
  const isOnboarded = activeUser?.hasCompletedOnboarding ?? onboarded;
  const setupPath = !language ? "/language" : !activeUser || !token ? "/auth" : !isOnboarded ? "/onboarding" : "/app";
  return (
    <AppErrorBoundary>
    <Routes>
      <Route path="/" element={<Navigate to="/splash" replace />} />
      <Route path="/splash" element={<SplashPage nextPath={setupPath} />} />
      <Route path="/language" element={<LanguagePage current={language} onSelect={setLanguage} />} />
      <Route path="/auth" element={<AuthPage language={language ?? "en"} onLogin={(nextUser, nextToken) => { setLanguage(nextUser.language); setUser(nextUser); setToken(nextToken); setOnboarded(!!nextUser.hasCompletedOnboarding); }} />} />
      <Route path="/reset" element={<ResetPage />} />
      <Route path="/verify" element={<VerifyPage onVerified={(nextUser, nextToken) => { setLanguage(nextUser.language); setUser(nextUser); setToken(nextToken); setOnboarded(!!nextUser.hasCompletedOnboarding); }} />} />
      <Route path="/onboarding" element={activeUser && token ? <OnboardingPage language={language ?? "en"} token={token} user={activeUser} onComplete={(updatedUser) => { setLanguage(updatedUser.language); setOnboarded(true); setUser(updatedUser); }} /> : <Navigate to="/auth" replace />} />
      <Route path="/app" element={activeUser && token && isOnboarded ? <MainApp user={activeUser} token={token} signOut={() => { setUser(null); setToken(null); }} updateUser={setUser} setLanguage={setLanguage} language={language ?? "en"} /> : <Navigate to={setupPath} replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </AppErrorBoundary>
  );
}

function SplashPage({ nextPath }: { nextPath: string }) {
  const navigate = useNavigate();
  const language = storedLang();
  useEffect(() => {
    const timer = window.setTimeout(() => navigate(nextPath, { replace: true }), 1800);
    return () => window.clearTimeout(timer);
  }, [navigate, nextPath]);
  return <main className="splash-screen">
    <div className="splash-logo image"><img src="/revivespring-icon.png" alt="ReviveSpring" /></div>
    <h1>ReviveSpring</h1>
    <p>{tr(language, "Revive Your Spirit. Renew Your Day.", "Ranimez votre esprit. Renouvelez votre journee.")}</p>
    <div className="splash-loader"><i /></div>
    <button className="link-button" onClick={() => navigate(nextPath, { replace: true })}>{tr(language, "Continue", "Continuer")}</button>
  </main>;
}

function Brand({ compact = false }: { compact?: boolean }) {
  const language = storedLang();
  return <div className={`brand ${compact ? "compact" : ""}`}><span className="brand-mark">RS</span><span><b>ReviveSpring</b>{!compact && <small>{tr(language, "Faith for every day", "La foi pour chaque jour")}</small>}</span></div>;
}

function LegalLinks({ language, compact = false }: { language: Lang; compact?: boolean }) {
  return <div className={`legal-links ${compact ? "compact" : ""}`.trim()}><a href={IUBENDA_PRIVACY_URL} className="iubenda-white iubenda-noiframe iubenda-embed" title="Privacy Policy">{tr(language, "Privacy Policy", "Politique de confidentialite")}</a><a href={IUBENDA_COOKIE_URL} className="iubenda-white iubenda-noiframe iubenda-embed" title="Cookie Policy">{tr(language, "Cookie Policy", "Politique relative aux cookies")}</a></div>;
}

function UserAvatar({ user, className = "" }: { user: User; className?: string }) {
  const label = user.fullName || user.email || "Friend";
  if (user.photoUrl) {
    return <span className={`user-avatar image ${className}`.trim()}><img src={user.photoUrl} alt={label} /></span>;
  }
  return <span className={`user-avatar ${className}`.trim()}>{initials(label)}</span>;
}

function shuffleNames(items: string[]) {
  const pool = [...items];
  for (let index = pool.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [pool[index], pool[swapIndex]] = [pool[swapIndex], pool[index]];
  }
  return pool;
}

function useCountUp(target: number, duration = 1400, delay = 0) {
  const [value, setValue] = useState(0);

  useEffect(() => {
    let frame = 0;
    let timeout = 0;

    const start = () => {
      const startedAt = performance.now();

      const tick = (timestamp: number) => {
        const elapsed = timestamp - startedAt;
        const progress = Math.min(1, elapsed / duration);
        const eased = 1 - Math.pow(1 - progress, 3);
        setValue(Math.round(target * eased));
        if (progress < 1) frame = window.requestAnimationFrame(tick);
      };

      frame = window.requestAnimationFrame(tick);
    };

    if (delay > 0) timeout = window.setTimeout(start, delay);
    else start();

    return () => {
      window.cancelAnimationFrame(frame);
      if (timeout) window.clearTimeout(timeout);
    };
  }, [target, duration, delay]);

  return value;
}

function detectTimezone() {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"; }
  catch { return "UTC"; }
}

function to12Hour(hour24: number) {
  const normalized = ((hour24 % 24) + 24) % 24;
  return { hour: normalized % 12 === 0 ? 12 : normalized % 12, period: normalized >= 12 ? "PM" : "AM" as "AM" | "PM" };
}

function to24Hour(hour12: number, period: "AM" | "PM") {
  const base = hour12 % 12;
  return period === "PM" ? base + 12 : base;
}

function formatReminderTime(hour: number, minute: number) {
  const view = to12Hour(hour);
  return `${String(view.hour).padStart(2, "0")} : ${String(minute).padStart(2, "0")} ${view.period}`;
}

function initialReminderSettings(user?: User | null): ReminderSettings {
  return {
    hour: typeof user?.reminderHour === "number" ? user.reminderHour : 9,
    minute: typeof user?.reminderMinute === "number" ? user.reminderMinute : 0,
    timezone: user?.timezone || detectTimezone(),
    dailyEmailEnabled: user?.dailyEmailEnabled !== false,
    pushNotificationsEnabled: user?.pushNotificationsEnabled !== false,
  };
}

function OnboardingChartCard() {
  const [names] = useState(() => shuffleNames(CHART_NAMES).slice(0, CHART_SERIES.length));

  return <div className="chart-card">
    <div className="chart-card-header">
      <div>
        <p className="chart-overline">First Month Outcomes</p>
        <h3>People who chose one focus area saw momentum build fast.</h3>
      </div>
      <div className="chart-badge">30 day sample</div>
    </div>
    <div className="chart-grid">
      <div className="chart-axis">
        {[100, 75, 50, 25, 0].map(mark => <span key={mark}>{mark}%</span>)}
      </div>
      <div className="chart-columns">
        {CHART_SERIES.map((item, index) => <ChartBar key={item.id} label={item.label} percent={item.percent} accent={item.accent} name={names[index]} delay={index * 140} />)}
      </div>
    </div>
  </div>;
}

function ChartBar({ label, percent, accent, name, delay }: { label: string; percent: number; accent: string; name: string; delay: number }) {
  const value = useCountUp(percent, 1200, delay);

  return <article className="chart-bar-card" style={{ animationDelay: `${delay}ms` }}>
    <div className="chart-percent">{value}%</div>
    <div className="chart-rail">
      <i className={`chart-fill ${accent}`} style={{ height: `${percent}%`, animationDelay: `${delay}ms` }} />
    </div>
    <div className="chart-meta">
      <b>{name}</b>
      <span>{label}</span>
    </div>
  </article>;
}

function ReminderSetupCard({ value, onChange }: { value: ReminderSettings; onChange: (value: ReminderSettings) => void }) {
  const hourView = to12Hour(value.hour);
  const setHour12 = (nextHour: number) => onChange({ ...value, hour: to24Hour(nextHour, hourView.period) });
  const setPeriod = (period: "AM" | "PM") => onChange({ ...value, hour: to24Hour(hourView.hour, period) });

  return <div className="reminder-card reminder-setup">
    <div className="reminder-purpose">
      <span className="reminder-purpose-icon"><UiIcon name="notification" /></span>
      <div>
        <p className="eyebrow">Your daily sacred pause</p>
        <h3>Choose a time when you can slow down and meet with God.</h3>
        <p>This gentle reminder is not a deadline. It creates a dependable moment for prayer, Scripture, and peace before the day carries you away.</p>
      </div>
    </div>
    <div className="reminder-time-display">{formatReminderTime(value.hour, value.minute)}</div>
    <div className="reminder-wheel-grid">
      <ScrollPicker label="Hour" values={REMINDER_HOURS} selected={hourView.hour} format={(item) => String(item).padStart(2, "0")} onSelect={setHour12} />
      <ScrollPicker label="Minute" values={REMINDER_MINUTES} selected={value.minute} format={(item) => String(item).padStart(2, "0")} onSelect={(minute) => onChange({ ...value, minute })} />
      <ScrollPicker label="Period" values={["AM", "PM"] as const} selected={hourView.period} format={(item) => item} onSelect={setPeriod} />
    </div>
    <div className="reminder-channel-grid">
      <label className="reminder-toggle">
        <input type="checkbox" checked={value.dailyEmailEnabled} onChange={e => onChange({ ...value, dailyEmailEnabled: e.target.checked })} />
        <div><b>Email prayers</b><p>Use this time for your daily prayer email.</p></div>
      </label>
      <label className="reminder-toggle">
        <input type="checkbox" checked={value.pushNotificationsEnabled} onChange={e => onChange({ ...value, pushNotificationsEnabled: e.target.checked })} />
        <div><b>App notifications</b><p>Use the same time when you sign in on mobile.</p></div>
      </label>
    </div>
    <p className="reminder-note">This reminder time is saved to your account so your website and mobile app stay in sync.</p>
  </div>;
}

function ScrollPicker<T extends string | number>({ label, values, selected, format, onSelect }: { label: string; values: readonly T[]; selected: T; format: (value: T) => string; onSelect: (value: T) => void }) {
  const listRef = useRef<HTMLDivElement | null>(null);
  const settleRef = useRef<number | null>(null);

  useEffect(() => {
    const active = listRef.current?.querySelector<HTMLElement>('[aria-selected="true"]');
    active?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [selected]);

  const selectCenteredItem = () => {
    if (settleRef.current) window.clearTimeout(settleRef.current);
    settleRef.current = window.setTimeout(() => {
      const list = listRef.current;
      if (!list) return;
      const center = list.getBoundingClientRect().top + (list.clientHeight / 2);
      const buttons = Array.from(list.querySelectorAll<HTMLButtonElement>("button"));
      if (!buttons.length) return;
      let closest = buttons[0];
      let closestDistance = Number.POSITIVE_INFINITY;
      buttons.forEach(button => {
        const rect = button.getBoundingClientRect();
        const distance = Math.abs((rect.top + rect.height / 2) - center);
        if (distance < closestDistance) {
          closest = button;
          closestDistance = distance;
        }
      });
      const index = buttons.indexOf(closest);
      if (index >= 0 && values[index] !== selected) onSelect(values[index]);
    }, 90);
  };

  return <div className="scroll-picker">
    <span>{label}</span>
    <div className="scroll-picker-shell">
      <i className="scroll-picker-focus" aria-hidden="true" />
      <div ref={listRef} className="scroll-picker-list" role="listbox" aria-label={label} onScroll={selectCenteredItem}>
        <span className="scroll-picker-spacer" aria-hidden="true" />
        {values.map((item) => <button type="button" key={String(item)} aria-selected={item === selected} className={item === selected ? "active" : ""} onClick={() => onSelect(item)}>{format(item)}</button>)}
        <span className="scroll-picker-spacer" aria-hidden="true" />
      </div>
    </div>
  </div>;
}

function LanguagePage({ current, onSelect }: { current: Lang | null; onSelect: (lang: Lang) => void }) {
  const navigate = useNavigate();
  const language = current ?? storedLang();
  return <PublicShell>
    <div className="auth-card language-card">
      <Brand />
      <p className="kicker">{tr(language, "Personalize your journey", "Personnalisez votre parcours")}</p><h1>{tr(language, "Choose your language", "Choisissez votre langue")}</h1>
      <p className="lead">{tr(language, "Choose your language. You can change this later in your profile.", "Choisissez votre langue. Vous pourrez la modifier plus tard dans votre profil.")}</p>
      <div className="language-options">{(["en", "fr"] as Lang[]).map(lang =>
        <button className={`language-option ${current === lang ? "selected" : ""}`} onClick={() => onSelect(lang)} key={lang}>
          <span className="language-icon">{lang === "en" ? "EN" : "FR"}</span><b>{LANG_LABELS[lang]}</b><small>{lang === "en" ? "Continue in English" : "Continuer en francais"}</small>
        </button>)}
      </div>
      <button className="button primary full" disabled={!current} onClick={() => navigate("/auth")}>{tr(language, "Continue", "Continuer")} <span>{"->"}</span></button>
    </div>
  </PublicShell>;
}

function AuthPage({ language, onLogin }: { language: Lang; onLogin: (user: User, token: string) => void }) {
  const [signup, setSignup] = useState(false);
  const [name, setName] = useState(""); const [email, setEmail] = useState(""); const [password, setPassword] = useState("");
  const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  const googleButton = useRef<HTMLDivElement | null>(null);
  const navigate = useNavigate();
  useEffect(() => {
    if (!GOOGLE_CLIENT_ID || !googleButton.current) return;
    let cancelled = false;
    loadGoogleIdentity().then(() => {
      if (cancelled || !window.google || !googleButton.current) return;
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: async (response) => {
          if (!response.credential) return;
          setBusy(true); setError("");
          try {
            const data = await api<any>("/auth/google", { method: "POST", body: JSON.stringify({ id_token: response.credential, language, client: "web" }) });
            const nextUser = mapUser(data.user);
            onLogin(nextUser, data.token);
            navigate(nextUser.hasCompletedOnboarding ? "/app" : "/onboarding");
          } catch (err) { setError(err instanceof Error ? err.message : "Google sign-in failed."); }
          finally { setBusy(false); }
        },
      });
      googleButton.current.innerHTML = "";
      const buttonWidth = Math.min(360, googleButton.current.clientWidth || 360);
      window.google.accounts.id.renderButton(googleButton.current, { theme: "outline", size: "large", text: "continue_with", width: buttonWidth });
    }).catch((err) => setError(err instanceof Error ? err.message : "Google Sign-In failed to load."));
    return () => { cancelled = true; };
  }, [language, navigate, onLogin]);
  const submit = async (e: FormEvent) => {
    e.preventDefault(); setBusy(true); setError("");
    try {
      if (signup) {
        await api("/auth/register", { method: "POST", body: JSON.stringify({ email, password, full_name: name.trim() }) });
        sessionStorage.setItem("rs_pending_email", email); navigate("/verify");
      } else {
        const data = await api<any>("/auth/login", { method: "POST", body: JSON.stringify({ email, password, client: "web" }) });
        const nextUser = mapUser(data.user);
        onLogin(nextUser, data.token);
        navigate(nextUser.hasCompletedOnboarding ? "/app" : "/onboarding");
      }
    } catch (err) {
      if (err instanceof ApiError && err.data?.requiresVerification) {
        sessionStorage.setItem("rs_pending_email", email);
        navigate("/verify");
        return;
      }
      setError(err instanceof Error ? err.message : "Unable to continue.");
    }
    finally { setBusy(false); }
  };
  return <PublicShell><div className="auth-card">
    <Brand /><p className="kicker">{tr(language, "Welcome to your quiet space", "Bienvenue dans votre espace paisible")}</p><h1>{signup ? tr(language, "Create your account", "Creez votre compte") : tr(language, "Welcome back", "Bon retour")}</h1>
    <p className="lead">{signup ? tr(language, "Start a daily rhythm shaped around your faith.", "Commencez un rythme quotidien faconne autour de votre foi.") : tr(language, "Continue your prayer and reflection journey.", "Poursuivez votre parcours de priere et de reflection.")}</p>
    <div className="segmented"><button className={!signup ? "active" : ""} onClick={() => setSignup(false)}>{tr(language, "Sign in", "Se connecter")}</button><button className={signup ? "active" : ""} onClick={() => setSignup(true)}>{tr(language, "Sign up", "S'inscrire")}</button></div>
    <form onSubmit={submit} className="form-stack">
      {error && <p className="form-error">{error}</p>}
      {signup && <Field label={tr(language, "Full name", "Nom complet")} value={name} onChange={setName} placeholder={tr(language, "Your full name", "Votre nom complet")} />}
      <Field label={tr(language, "Email address", "Adresse e-mail")} value={email} onChange={setEmail} placeholder="you@example.com" type="email" />
      <Field label={tr(language, "Password", "Mot de passe")} value={password} onChange={setPassword} placeholder={tr(language, "At least 6 characters", "Au moins 6 caracteres")} type="password" />
      {!signup && <div style={{ textAlign: "right" }}><button className="link-button" onClick={() => navigate(`/reset?email=${encodeURIComponent(email)}`)}>{tr(language, "Forgot password?", "Mot de passe oublie ?")}</button></div>}
      <button className="button primary full" disabled={busy || email.length < 5 || password.length < 6 || (signup && !name.trim())}>{busy ? tr(language, "Please wait...", "Veuillez patienter...") : signup ? tr(language, "Create account", "Creer un compte") : tr(language, "Sign in", "Se connecter")} <span>{"->"}</span></button>
    </form>
    <div className="auth-divider"><span>{tr(language, "or continue with", "ou continuer avec")}</span></div>
    {GOOGLE_CLIENT_ID ? <div className="google-signin-panel">
      <div className="google-signin-copy">
        <span className="google-signin-icon">G</span>
        <div>
          <b>{tr(language, "Google account", "Compte Google")}</b>
          <p>{tr(language, "Use your saved account to continue securely.", "Utilisez votre compte enregistre pour continuer en toute securite.")}</p>
        </div>
      </div>
      <div className="google-button" ref={googleButton} />
    </div> : <p className="form-error">{tr(language, "Set VITE_GOOGLE_CLIENT_ID to enable Google Sign-In on the web.", "Definissez VITE_GOOGLE_CLIENT_ID pour activer Google Sign-In sur le web.")}</p>}
    <button className="link-button" onClick={() => setSignup(!signup)}>{signup ? tr(language, "Already have an account? Sign in", "Vous avez deja un compte ? Connectez-vous") : tr(language, "New here? Create an account", "Nouveau ici ? Creez un compte")}</button>
  </div></PublicShell>;
}

function VerifyPage({ onVerified }: { onVerified: (user: User, token: string) => void }) {
  const [code, setCode] = useState(""); const [error, setError] = useState(""); const [busy, setBusy] = useState(false); const navigate = useNavigate();
  const pending = new URLSearchParams(window.location.search).get("email") || sessionStorage.getItem("rs_pending_email");
  const language = storedLang();
  if (!pending) return <Navigate to="/auth" replace />;
  return <PublicShell><div className="auth-card"><Brand /><div className="large-icon">MAIL</div><p className="kicker">{tr(language, "One last step", "Une derniere etape")}</p><h1>{tr(language, "Verify your email", "Verifiez votre e-mail")}</h1>
    <p className="lead">{tr(language, `Enter the real 6-digit code sent to ${pending}. You can also open this page directly from your verification email.`, `Entrez le vrai code a 6 chiffres envoye a ${pending}. Vous pouvez aussi ouvrir cette page directement depuis votre e-mail de verification.`)}</p>
    <Field label={tr(language, "Verification code", "Code de verification")} value={code} onChange={setCode} placeholder="000000" />
    {error && <p className="form-error">{error}</p>}
    <button className="button primary full" disabled={code.length !== 6 || busy} onClick={async () => { try { setBusy(true); const data = await api<any>("/auth/verify-otp", { method:"POST", body:JSON.stringify({ email:pending, otp:code }) }); const nextUser = mapUser(data.user); onVerified(nextUser, data.token); sessionStorage.removeItem("rs_pending_email"); navigate(nextUser.hasCompletedOnboarding ? "/app" : "/onboarding"); } catch (err) { setError(err instanceof Error ? err.message : tr(language, "Verification failed.", "La verification a echoue.")); } finally { setBusy(false); } }}>{busy ? tr(language, "Verifying...", "Verification...") : tr(language, "Verify and continue", "Verifier et continuer")} <span>{"->"}</span></button>
    <button className="link-button" onClick={async () => { try { setBusy(true); setError(""); await api<any>("/auth/resend-otp", { method:"POST", body:JSON.stringify({ email:pending }) }); } catch (err) { setError(err instanceof Error ? err.message : tr(language, "Could not resend the code.", "Impossible de renvoyer le code.")); } finally { setBusy(false); } }}>{tr(language, "Resend code", "Renvoyer le code")}</button>
  </div></PublicShell>;
}

function ResetPage() {
  const navigate = useNavigate();
  const language = storedLang();
  const [email, setEmail] = useState(() => new URLSearchParams(window.location.search).get("email") || sessionStorage.getItem("rs_pending_email") || "");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [emailSent, setEmailSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const t = (en: string, fr: string) => tr(language, en, fr);

  const sendReset = async () => {
    if (!email || !email.includes("@")) {
      setMessage(t("Enter a valid email before sending a reset code.", "Entrez un e-mail valide avant d'envoyer un code de reinitialisation."));
      return;
    }
    setBusy(true); setMessage("");
    try {
      await api<any>("/auth/forgot-password", { method: "POST", body: JSON.stringify({ email, client: "web" }) });
      setEmailSent(true);
      setMessage(t("A reset code was sent to your email.", "Un code de reinitialisation a ete envoye a votre e-mail."));
    } catch (err) {
      setMessage(err instanceof Error ? err.message : t("Could not send reset code.", "Impossible d'envoyer le code."));
    } finally { setBusy(false); }
  };

  const submitReset = async () => {
    if (!email || code.length !== 6 || newPassword.length < 6) {
      setMessage(t("Provide email, 6-digit code, and a new password (min 6 chars).", "Fournissez l'e-mail, le code a 6 chiffres et un nouveau mot de passe (min 6 caracteres)."));
      return;
    }
    setBusy(true); setMessage("");
    try {
      await api<any>("/auth/reset-password", { method: "POST", body: JSON.stringify({ email, otp: code, new_password: newPassword, client: "web" }) });
      setMessage(t("Password reset successfully. Please sign in with your new password.", "Mot de passe reinitialise avec succes. Veuillez vous connecter avec votre nouveau mot de passe."));
      // navigate back to auth after short delay
      setTimeout(() => navigate("/auth"), 1200);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : t("Could not reset password.", "Impossible de reinitialiser le mot de passe."));
    } finally { setBusy(false); }
  };

  return <PublicShell>
    <div className="auth-card">
      <Brand />
      <p className="kicker">{t("Reset your password", "Reinitialiser le mot de passe")}</p>
      <h1>{t("Reset Password", "Reinitialiser le mot de passe")}</h1>
      <p className="lead">{t("We will send a 6-digit code to your email to reset your password.", "Nous enverrons un code a 6 chiffres a votre e-mail pour reinitialiser votre mot de passe.")}</p>
      <div className="form-stack">
        <Field label={t("Email address", "Adresse e-mail")} value={email} onChange={setEmail} placeholder="you@example.com" type="email" />
        <button className="button primary full" disabled={busy} onClick={sendReset}>{busy ? t("Please wait...", "Veuillez patienter...") : emailSent ? t("Send another reset code", "Envoyer un autre code de reinitialisation") : t("Send reset code", "Envoyer le code de reinitialisation")} <span>{"->"}</span></button>
        {emailSent && <>
          <Field label={t("Verification code", "Code de verification")} value={code} onChange={setCode} placeholder="000000" />
          <Field label={t("New password", "Nouveau mot de passe")} value={newPassword} onChange={setNewPassword} placeholder={t("At least 6 characters", "Au moins 6 caracteres")} type="password" />
          <button className="button primary full" disabled={busy} onClick={submitReset}>{busy ? t("Please wait...", "Veuillez patienter...") : t("Reset Password", "Reinitialiser le mot de passe")} <span>{"->"}</span></button>
        </>}
        {message && <p className="form-error">{message}</p>}
        <button className="link-button" onClick={() => navigate("/auth")}>{t("Back to sign in", "Retour a la connexion")}</button>
      </div>
    </div>
  </PublicShell>;
}

function PublicShell({ children }: { children: React.ReactNode }) {
  const [quote, setQuote] = useState(0);
  const language = storedLang();
  useEffect(() => {
    const timer = window.setInterval(() => setQuote((value) => (value + 1) % ROTATING_QUOTES.length), 5 * 60 * 1000);
    return () => window.clearInterval(timer);
  }, []);
  const active = ROTATING_QUOTES[quote];
  return <main className="public-shell"><div className="public-aside"><Brand /><div><p className="eyebrow">{tr(language, "Revive your spirit. Renew your day.", "Ranimez votre esprit. Renouvelez votre journee.")}</p><h2>{tr(language, "A calmer place to pray, reflect, and grow with purpose.", "Un endroit plus paisible pour prier, reflechir et grandir avec intention.")}</h2><p>{tr(language, "Daily guidance meets real life, one faithful step at a time.", "Un accompagnement quotidien pour la vraie vie, un pas fidele a la fois.")}</p></div><div className="aside-verse"><span>{tr(language, "Daily reflection", "Reflexion du jour")}</span><q className="fade-quote" key={active.reference}>{active.verse}</q><b>{active.reference}</b></div></div><div className="public-main">{children}<LegalLinks language={language} compact /></div></main>;
}

function OnboardingPage({ language, token, user, onComplete }: { language:Lang; token: string; user: User; onComplete: (user: User) => void }) {
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [reminderSettings, setReminderSettings] = useState<ReminderSettings>(() => initialReminderSettings(user));
  const [nameInput, setNameInput] = useState(user.fullName || "");
  const [useDifferentEmail, setUseDifferentEmail] = useState(false);
  const [emailInput, setEmailInput] = useState(user.email || "");
  const [submitting, setSubmitting] = useState(false);
  const finishingRef = useRef(false);
  const navigate = useNavigate();
  const step = ONBOARDING_STEPS[index];
  const selected = answers[step.id] || [];
  const canContinue = step.optional
    ? true
    : step.type === "single" || step.type === "multi"
      ? selected.length > 0
      : step.type === "profile"
        ? nameInput.trim().length > 0
        : true;

  const select = (option: OnboardingOption) => {
    setAnswers(prev => {
      const current = prev[step.id] || [];
      let next: string[];
      if (step.type !== "multi") {
        next = [option.label];
      } else if (option.exclusive) {
        next = [option.label];
      } else {
        const withoutExclusive = current.filter(label => !(step.options || []).some(o => o.label === label && o.exclusive));
        if (withoutExclusive.includes(option.label)) {
          next = withoutExclusive.filter(label => label !== option.label);
        } else if (step.maxSelect && withoutExclusive.length >= step.maxSelect) {
          return prev;
        } else {
          next = [...withoutExclusive, option.label];
        }
      }
      return { ...prev, [step.id]: next };
    });
  };

  const completeOnboarding = async () => {
    if (finishingRef.current) return;
    finishingRef.current = true;
    setSubmitting(true);
    try {
      const trimmedName = nameInput.trim();
      if (trimmedName && trimmedName !== user.fullName) {
        await api("/auth/me", { method: "PATCH", body: JSON.stringify({ full_name: trimmedName }) }, token);
      }
      const payload = {
        language,
        ...answers,
        preferredContactEmail: useDifferentEmail ? emailInput.trim() : user.email,
        completedAt: new Date().toISOString(),
        reminderTime: reminderSettings,
      };
      await api("/onboarding/save", { method: "POST", body: JSON.stringify(payload) }, token);
      onComplete({
        ...user,
        fullName: trimmedName || user.fullName,
        hasCompletedOnboarding: true,
        language,
        timezone: reminderSettings.timezone,
        reminderHour: reminderSettings.hour,
        reminderMinute: reminderSettings.minute,
        dailyEmailEnabled: reminderSettings.dailyEmailEnabled,
        pushNotificationsEnabled: reminderSettings.pushNotificationsEnabled,
      });
      navigate("/app");
    } finally {
      setSubmitting(false);
      finishingRef.current = false;
    }
  };

  const isLast = index === ONBOARDING_STEPS.length - 1;
  const primaryLabel = submitting ? "Saving..." : step.type === "tour" ? "Get Started" : step.type === "premium" ? "Continue with Free" : isLast ? "Begin My Prayer Journey" : "Continue";

  return <main className="onboarding-shell">
    <header className="onboarding-header"><Brand compact /><div className="onboarding-progress"><div><span>{step.section}</span><b>{index + 1} / {ONBOARDING_STEPS.length}</b></div><div className="progress"><i style={{ width: `${((index + 1) / ONBOARDING_STEPS.length) * 100}%` }} /></div></div><button className="icon-button" onClick={() => setIndex(Math.max(0, index - 1))} disabled={index === 0} title="Previous step">{"<-"}</button></header>
    <section className="onboarding-content"><div className="onboarding-stage" key={step.id}><p className="kicker">{step.section}</p><h1>{step.title}</h1>{step.subtitle && <p className="onboarding-lead">{step.subtitle}</p>}<div className="onboarding-stage-body">
      <StepContent
        step={step}
        selected={selected}
        select={select}
        reminderSettings={reminderSettings}
        setReminderSettings={setReminderSettings}
        user={user}
        nameInput={nameInput}
        setNameInput={setNameInput}
        useDifferentEmail={useDifferentEmail}
        setUseDifferentEmail={setUseDifferentEmail}
        emailInput={emailInput}
        setEmailInput={setEmailInput}
        answers={answers}
      />
    </div></div></section>
    <footer className="onboarding-footer"><button className="button ghost" onClick={() => setIndex(Math.max(0, index - 1))} disabled={index === 0 || submitting}>Back</button><button className="button primary" disabled={!canContinue || submitting} onClick={async () => { if (isLast) { await completeOnboarding(); } else setIndex(index + 1); }}>{primaryLabel} <span>{"->"}</span></button></footer>
  </main>;
}

function StepContent({ step, selected, select, reminderSettings, setReminderSettings, user, nameInput, setNameInput, useDifferentEmail, setUseDifferentEmail, emailInput, setEmailInput, answers }: {
  step: OnboardingStep;
  selected: string[];
  select: (option: OnboardingOption) => void;
  reminderSettings: ReminderSettings;
  setReminderSettings: (value: ReminderSettings) => void;
  user: User;
  nameInput: string;
  setNameInput: (value: string) => void;
  useDifferentEmail: boolean;
  setUseDifferentEmail: (value: boolean) => void;
  emailInput: string;
  setEmailInput: (value: string) => void;
  answers: Record<string, string[]>;
}) {
  if (step.type === "tour") return <TourCarousel options={step.options || []} />;
  if (step.type === "single" || step.type === "multi") return <>
    <AnimatedOptionGrid options={step.options || []} selected={selected} select={select} />
    {step.optional && <p className="onboarding-skip-hint">Optional — leave it blank and continue if you'd rather not say.</p>}
  </>;
  if (step.type === "reminder") return <ReminderSetupCard value={reminderSettings} onChange={setReminderSettings} />;
  if (step.type === "email") return <EmailConfirmCard email={user.email} useDifferentEmail={useDifferentEmail} onToggle={setUseDifferentEmail} emailInput={emailInput} setEmailInput={setEmailInput} />;
  if (step.type === "profile") return <ProfileSetupCard nameInput={nameInput} setNameInput={setNameInput} photoUrl={user.photoUrl} />;
  if (step.type === "premium") return <PremiumCard />;
  if (step.type === "summary") return <SummaryCard name={nameInput.trim() || user.fullName || "Friend"} language={user.language} topFocus={(answers.spiritualGoals && answers.spiritualGoals[0]) || (answers.prayerFocus && answers.prayerFocus[0])} reminderHour={reminderSettings.hour} reminderMinute={reminderSettings.minute} />;
  return null;
}

function TourCarousel({ options }: { options: OnboardingOption[] }) {
  const [page, setPage] = useState(0);
  const blurbs = [
    "Guided daily prayers for every season of life.",
    "Capture your thoughts and celebrate answered prayers.",
    "Small, honest steps that build a lasting habit.",
  ];
  const active = options[page];
  return <div className="tour-carousel">
    <div className="tour-card">
      <span className="tour-emoji">{active?.emoji}</span>
      <h3>{active?.label}</h3>
      <p>{blurbs[page % blurbs.length]}</p>
    </div>
    <div className="tour-dots">{options.map((_, i) => <button key={i} className={i === page ? "active" : ""} onClick={() => setPage(i)} aria-label={`Slide ${i + 1}`} />)}</div>
  </div>;
}

function AnimatedOptionGrid({ options, selected, select }: { options: OnboardingOption[]; selected: string[]; select: (option: OnboardingOption) => void }) {
  return <div className="option-grid">{options.map((option, index) => <button key={`${option.label}-${index}`} className={`onboarding-option ${selected.includes(option.label) ? "selected" : ""}`.trim()} style={{ "--enter-delay": `${160 + (index * 70)}ms` } as CSSProperties} onClick={() => select(option)}><span className="onboarding-option-emoji">{option.emoji}</span><span className="onboarding-option-label">{option.label}</span><i>{selected.includes(option.label) ? "OK" : "( )"}</i></button>)}</div>;
}

function EmailConfirmCard({ email, useDifferentEmail, onToggle, emailInput, setEmailInput }: { email: string; useDifferentEmail: boolean; onToggle: (value: boolean) => void; emailInput: string; setEmailInput: (value: string) => void }) {
  return <div className="email-confirm-card">
    <div className="email-display"><span>✉️</span><b>{email}</b></div>
    <div className="email-confirm-actions">
      <button className={`button ${!useDifferentEmail ? "primary" : "ghost"}`} onClick={() => onToggle(false)}>This is correct ✓</button>
      <button className={`button ${useDifferentEmail ? "primary" : "ghost"}`} onClick={() => onToggle(true)}>Update email</button>
    </div>
    {useDifferentEmail && <>
      <input value={emailInput} onChange={e => setEmailInput(e.target.value)} placeholder="name@example.com" type="email" />
      <p className="email-confirm-note">This sets where your daily devotional is sent. To change your account login email, use Settings later.</p>
    </>}
  </div>;
}

function ProfileSetupCard({ nameInput, setNameInput, photoUrl }: { nameInput: string; setNameInput: (value: string) => void; photoUrl?: string | null }) {
  return <div className="profile-setup-card">
    <button type="button" className="profile-photo-button" onClick={() => window.alert("Photo uploads are coming soon.")}>
      {photoUrl ? <img src={photoUrl} alt="" /> : <span>👤</span>}
      <i>📷</i>
    </button>
    <p className="profile-photo-hint">Photo optional</p>
    <input className="profile-name-input" value={nameInput} onChange={e => setNameInput(e.target.value)} placeholder="First name" />
  </div>;
}

function PremiumCard() {
  const highlights = [
    ["💬", "Unlimited AI Prayer Companion chat"],
    ["🧘", "Full Mental Wellness content library"],
    ["🚫", "No ads, ever"],
  ];
  return <div className="premium-onboarding-card">
    {highlights.map(([emoji, text]) => <div className="premium-highlight-row" key={text}><span>{emoji}</span><p>{text}</p></div>)}
    <button className="button primary full" onClick={() => window.alert("You can upgrade to Premium anytime from Settings → Subscription.")}>Upgrade to Premium</button>
  </div>;
}

function SummaryCard({ name, language, topFocus, reminderHour, reminderMinute }: { name: string; language: Lang; topFocus?: string; reminderHour: number; reminderMinute: number }) {
  const time = formatReminderTime(reminderHour, reminderMinute);
  return <div className="onboarding-summary-card">
    <h2>You're ready, {name}! 🎉</h2>
    <div className="onboarding-summary-rows">
      <div><span>Language</span><b>{language.toUpperCase()}</b></div>
      {topFocus && <div><span>Top focus</span><b>{topFocus}</b></div>}
      <div><span>Daily reminder</span><b>{time}</b></div>
    </div>
    <p>Everything is set. Tap below whenever you are ready to begin.</p>
  </div>;
}

function MainApp({ user, token, signOut, updateUser, setLanguage, language }: { user: User; token: string; signOut: () => void; updateUser: (user: User | null) => void; setLanguage: (language: Lang | null) => void; language: Lang }) {
  const [tab, setTab] = useState<AppTab>("home");
  const [goals, setGoals] = useState<Goal[]>([]);
  const [journal, setJournal] = useState<JournalEntry[]>([]);
  const [analytics, setAnalytics] = useState<Analytics>({ totalPrayers:0, visitCount:0, currentStreak:0, answeredPrayers:5, completedGoals:0 });
  const [moodCheckIn, setMoodCheckIn] = useState<MoodCheckIn>({ checkedIn: true });
  const [dailyManna, setDailyManna] = useState<DailyManna>({ available: false });
  const [prayers, setPrayers] = useState<Prayer[]>([]);
  const [declaration, setDeclaration] = useState<Declaration>({});
  const [growthScore, setGrowthScore] = useState<GrowthScore | null>(null);
  const [seasonalEvents, setSeasonalEvents] = useState<any[]>([]);
  const [verse, setVerse] = useState({ verse:"I can do all things through Christ who strengthens me.", reference:"Philippians 4:13" });
  const [library, setLibrary] = useState<PrayerItem[]>(PRAYER_LIBRARY);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [monetization, setMonetization] = useState<MonetizationStatus | null>(null);
  const [notificationToast, setNotificationToast] = useState<AppNotification | null>(null);
  const [showReminderPermission, setShowReminderPermission] = useState(() => !localStorage.getItem("rs_background_reminders_choice"));
  const t = (en: string, fr: string) => tr(language, en, fr);
  const isPremiumUser = !!user.isAdmin || user.plan === "premium";
  const showAds = !!monetization && !isPremiumUser && monetization?.ads?.enabled !== false && monetization?.ads?.bannerEnabled !== false;
  const unreadNotifications = notifications.filter(item => !item.readAt).length;
  const surfaceUnreadNotification = (items: AppNotification[]) => {
    const latest = items.find(item => !item.readAt);
    if (!latest) return;
    const key = `rs_last_web_notification_${user.email}`;
    if (localStorage.getItem(key) === latest.id) return;
    localStorage.setItem(key, latest.id);
    setNotificationToast(latest);
    window.setTimeout(() => setNotificationToast(current => current?.id === latest.id ? null : current), 9000);
    if ("Notification" in window && window.Notification.permission === "granted") {
      new window.Notification(latest.title, { body: latest.body });
    }
  };
  const loadNotifications = async () => {
    try {
      const data = await api<any>("/notifications", {}, token);
      const nextNotifications = data.notifications || [];
      setNotifications(nextNotifications);
      surfaceUnreadNotification(nextNotifications);
    } catch {
      setNotifications([]);
    }
  };
  const webDateKey = () => new Intl.DateTimeFormat("en-CA", { timeZone: user.timezone || detectTimezone(), year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const visitKey = `rs_daily_visit_${user.email}`;
  const markDailyVisit = () => {
    const today = webDateKey();
    const previous = localStorage.getItem(visitKey);
    localStorage.setItem(visitKey, today);
    if (previous !== today && "Notification" in window && window.Notification.permission === "granted") {
      new window.Notification(t("Welcome back to ReviveSpring", "Bon retour sur ReviveSpring"), { body: t(`Good to see you, ${(user.fullName || "Friend").split(" ")[0]}. God has grace for today.`, `Heureux de vous revoir, ${(user.fullName || "Friend").split(" ")[0]}. Dieu a une grace pour aujourd'hui.`) });
    }
  };
  const refresh = async () => {
    const [goalData, journalData, analyticsData, verseData, libraryData, moodCheckInData, mannaData, prayerData, declarationData, growthScoreData, seasonalEventsData] = await Promise.all([
      api<any[]>("/goals", {}, token), api<any[]>("/journal", {}, token), api<Analytics>("/analytics", {}, token),
      api<any>("/daily-verse", {}, token).catch(() => verse), api<any[]>("/library", {}, token).catch(() => []),
      api<MoodCheckIn>("/mood-checkin/today", {}, token).catch(() => ({ checkedIn: true })),
      api<DailyManna>("/daily-manna/status", {}, token).catch(() => ({ available: false })),
      api<Prayer[]>("/prayers", {}, token).catch(() => []),
      api<Declaration>("/declarations/today", {}, token).catch(() => ({})),
      api<GrowthScore>("/growth-score", {}, token).catch(() => null),
      api<any[]>("/seasonal-events", {}, token).catch(() => []),
    ]);
    setGoals(goalData.map(mapGoal)); setJournal(journalData.map(item => ({ id:item.id, body:item.content, date:item.created_date || "Today" })));
    setAnalytics(analyticsData); setVerse(verseData);
    setMoodCheckIn(moodCheckInData); setDailyManna(mannaData);
    setPrayers(prayerData); setDeclaration(declarationData);
    setGrowthScore(growthScoreData);
    setSeasonalEvents(seasonalEventsData);
    if (libraryData.length) setLibrary(libraryData.map(item => ({ id:item.id, identifier:item.identifier || item.id, title:item.titleEn, body:item.prayerEn, icon:<MoodIcon name="heart" />, tone:"emerald", mood:item.category, verse:item.verseEn, reference:item.verseRef, action:item.actionEn })));
  };
  const submitMoodCheckIn = async (mood: string, note?: string) => {
    await api("/mood-checkin", { method: "POST", body: JSON.stringify({ mood, note }) }, token);
    setMoodCheckIn({ checkedIn: true, log: { mood, note } });
  };
  const claimDailyManna = async () => {
    const result = await api<DailyManna>("/daily-manna/claim", { method: "POST", body: JSON.stringify({}) }, token);
    setDailyManna(current => ({ ...current, ...result, available: false }));
    return result;
  };
  const confirmDeclaration = async () => {
    const result = await api<Declaration>("/declarations/confirm", { method: "POST", body: JSON.stringify({}) }, token);
    setDeclaration(current => ({ ...current, ...result }));
  };
  const fetchRandomVerse = () => api<{ verse: string; reference: string }>("/daily-verse/random", {}, token);
  const markPrayerAnswered = async (prayerId: string, testimony?: string) => {
    await api(`/prayers/${prayerId}/answered`, { method: "PATCH", body: JSON.stringify({ is_answered: true, testimony }) }, token);
    setPrayers(current => current.map(p => p.id === prayerId ? { ...p, is_answered: true, testimony } : p));
  };
  const loadMonetization = async () => {
    try {
      const data = await api<MonetizationStatus>("/monetization/status", {}, token);
      setMonetization(data);
    } catch {
      setMonetization(null);
    }
  };
  useEffect(() => {
      api<any>("/auth/me", {}, token).then((currentUser) => {
        const nextUser = mapUser(currentUser);
        setLanguage(nextUser.language);
        updateUser(nextUser);
        markDailyVisit();
        return Promise.all([refresh(), loadNotifications(), loadMonetization()]);
      }).catch(signOut);
  }, []);
  useEffect(() => {
    const timer = window.setInterval(() => { void loadNotifications(); }, 4 * 60 * 60 * 1000);
    return () => window.clearInterval(timer);
  }, [token]);
  useEffect(() => {
    const checkStreakReminder = () => {
      const parts = new Intl.DateTimeFormat("en-US", { timeZone: user.timezone || detectTimezone(), hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(new Date());
      const hour = Number(parts.find(part => part.type === "hour")?.value || 0);
      const minute = Number(parts.find(part => part.type === "minute")?.value || 0);
      const today = webDateKey();
      if ((hour !== 18 && hour !== 21) || minute > 4 || localStorage.getItem(visitKey) === today) return;
      const reminderKey = `rs_streak_reminder_${user.email}_${today}_${hour}`;
      if (localStorage.getItem(reminderKey)) return;
      localStorage.setItem(reminderKey, "shown");
      const title = `Keep your ${analytics.currentStreak || 0}-day rhythm alive`;
      const body = "Visit ReviveSpring for one faithful moment before today ends.";
      setNotificationToast({ id: reminderKey, type: "streak", title, body, createdAt: new Date().toISOString() });
      if ("Notification" in window && window.Notification.permission === "granted") new window.Notification(`🔥 ${title}`, { body });
    };
    const onVisible = () => { if (document.visibilityState === "visible") markDailyVisit(); };
    const onActivity = () => markDailyVisit();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onActivity);
    window.addEventListener("pointerdown", onActivity);
    const timer = window.setInterval(checkStreakReminder, 60_000);
    checkStreakReminder();
    return () => { document.removeEventListener("visibilitychange", onVisible); window.removeEventListener("focus", onActivity); window.removeEventListener("pointerdown", onActivity); window.clearInterval(timer); };
  }, [analytics.currentStreak, user.email, user.timezone]);
  const navItems = navItemsFor(language, !!user.isAdmin);
  const title = tab === "support" ? t("Customer Care", "Service client") : tab === "notifications" ? t("Notifications", "Notifications") : navItems.find(item => item.id === tab)?.label || t("Admin", "Admin");
  return <div className="app-shell">{showReminderPermission && <div className="modal-backdrop"><section className="mood-modal reminder-permission-modal"><span className="tile-icon emerald"><UiIcon name="notification" /></span><p className="eyebrow">{t("Personal reminders", "Rappels personnels")}</p><h2>{t("Keep your ReviveSpring reminders ready?", "Garder vos rappels ReviveSpring actifs ?")}</h2><p>{t("The website does not run continuously in the background. While it is open, it briefly checks for missed account messages and keeps your daily welcome and streak reminders current.", "Le site ne fonctionne pas en continu en arriere-plan. Lorsqu'il est ouvert, il verifie brievement les messages de compte manques et maintient vos rappels quotidiens et de serie a jour.")}</p><div className="permission-actions"><button className="button ghost" onClick={() => { localStorage.setItem("rs_background_reminders_choice", "later"); setShowReminderPermission(false); }}>{t("Not now", "Pas maintenant")}</button><button className="button primary" onClick={async () => { if ("Notification" in window) await window.Notification.requestPermission(); localStorage.setItem("rs_background_reminders_choice", "allowed"); setShowReminderPermission(false); }}>{t("Allow reminders", "Autoriser les rappels")}</button></div></section></div>}<aside className="sidebar"><Brand /><nav>{navItems.map(item => <NavButton item={item} active={tab === item.id} onClick={() => setTab(item.id)} key={item.id} />)}</nav><button className="sidebar-profile" onClick={() => setTab("profile")}><UserAvatar user={user} className="sidebar-avatar" /><div><b>{user.fullName}</b><small>{`${user.plan} ${t("plan", "forfait")}`}</small></div></button></aside>
    <div className="workspace"><header className="app-header"><div><p className="eyebrow">{new Date().toLocaleDateString(language === "fr" ? "fr-FR" : "en-US", { weekday: "long", month: "long", day: "numeric" })}</p><h1>{title}</h1></div><div className="header-actions"><button className={`support-button notification-button ${tab === "notifications" ? "active" : ""}`.trim()} onClick={() => { if ("Notification" in window && window.Notification.permission === "default") void window.Notification.requestPermission(); setTab("notifications"); }} title={t("Open notifications", "Ouvrir les notifications")} aria-label={t("Open notifications", "Ouvrir les notifications")}><UiIcon name="notification" size={19} />{unreadNotifications > 0 && <i>{unreadNotifications}</i>}<span>{t("Alerts", "Alertes")}</span></button><button className={`support-button ${tab === "support" ? "active" : ""}`.trim()} onClick={() => setTab("support")} title={t("Open customer care", "Ouvrir le service client")} aria-label={t("Open customer care", "Ouvrir le service client")}><UiIcon name="support" size={19} /><span>{t("Care", "Aide")}</span></button><button className="avatar-button" onClick={() => setTab("profile")} title={t("Open profile", "Ouvrir le profil")}><UserAvatar user={user} className="header-avatar" /></button></div></header>
        {notificationToast && <button className="notification-toast" onClick={() => { setTab("notifications"); setNotificationToast(null); }}><span className="notification-mark"><UiIcon name={notificationToast.type === "support_reply" ? "support" : "notification"} size={18} /></span><div><b>{notificationToast.title}</b><p>{notificationToast.body}</p></div></button>}
        <div className="screen-wrap">
          {showAds && tab !== "ai" && <Panel className="ad-banner-panel"><div className="ad-banner-copy"><p className="eyebrow">{t("Sponsored", "Sponsorise")}</p><h3>{language === "fr" ? monetization?.ads?.banner?.titleFr || "Passez premium sur ReviveSpring" : monetization?.ads?.banner?.titleEn || "Upgrade to ReviveSpring Premium"}</h3><p>{language === "fr" ? monetization?.ads?.banner?.bodyFr || "Retirez les pubs et profitez d'un acces premium sans interruption." : monetization?.ads?.banner?.bodyEn || "Remove ads and enjoy uninterrupted premium access."}</p></div><button className="button secondary">{language === "fr" ? monetization?.ads?.banner?.ctaFr || "Passer premium sur Android" : monetization?.ads?.banner?.ctaEn || "Upgrade on Android"}</button></Panel>}
          {tab === "home" && <HomeScreen user={user} token={token} goals={goals} analytics={analytics} refresh={refresh} openAi={() => setTab("ai")} openPrayers={() => setTab("prayers")} moodCheckIn={moodCheckIn} submitMoodCheckIn={submitMoodCheckIn} dailyManna={dailyManna} claimDailyManna={claimDailyManna} declaration={declaration} confirmDeclaration={confirmDeclaration} fetchRandomVerse={fetchRandomVerse} growthScore={growthScore} seasonalEvents={seasonalEvents} />}
          {tab === "prayers" && <PrayerScreen items={library} token={token} refresh={refresh} openAi={() => setTab("ai")} language={language} />}
          {tab === "journal" && <JournalScreen token={token} entries={journal} setEntries={setJournal} language={language} prayers={prayers} markPrayerAnswered={markPrayerAnswered} />}
          {tab === "goals" && <GoalsScreen token={token} goals={goals} refresh={refresh} language={language} />}
          {tab === "wellness" && <WellnessScreen token={token} onNavigate={setTab} user={user} />}
          {tab === "ai" && <AiScreen user={user} token={token} monetization={monetization} refreshMonetization={loadMonetization} />}
          {tab === "community" && <CommunityScreen token={token} user={user} />}
          {tab === "support" && <CustomerCareScreen user={user} token={token} onTicketSent={loadNotifications} />}
          {tab === "notifications" && <NotificationScreen token={token} notifications={notifications} refresh={loadNotifications} language={language} />}
          {tab === "profile" && <ProfileScreen user={user} token={token} language={language} setLanguage={setLanguage} updateUser={updateUser} signOut={signOut} onDeleted={() => { updateUser(null); signOut(); }} openAdmin={user.isAdmin ? () => setTab("admin") : undefined} monetization={monetization} />}
          {tab === "admin" && user.isAdmin && <AdminControlCenter token={token} />}
        </div>
    </div><nav className="mobile-nav">{navItems.map(item => <NavButton item={item} active={tab === item.id} onClick={() => setTab(item.id)} key={item.id} />)}</nav></div>;
}

function NavButton({ item, active, onClick }: { item: { label: string; icon: React.ReactNode }; active: boolean; onClick: () => void }) { return <button className={active ? "nav-item active" : "nav-item"} onClick={onClick}><span>{item.icon}</span><b>{item.label}</b></button>; }
function HomeScreen({ user, token, goals, analytics, refresh, openAi, openPrayers, moodCheckIn, submitMoodCheckIn, dailyManna, claimDailyManna, declaration, confirmDeclaration, fetchRandomVerse, growthScore, seasonalEvents }: { user: User; token:string; goals: Goal[]; analytics:Analytics; refresh:()=>Promise<void>; openAi: () => void; openPrayers: () => void; moodCheckIn: MoodCheckIn; submitMoodCheckIn: (mood: string, note?: string) => Promise<void>; dailyManna: DailyManna; claimDailyManna: () => Promise<DailyManna>; declaration: Declaration; confirmDeclaration: () => Promise<void>; fetchRandomVerse: () => Promise<{ verse: string; reference: string }>; growthScore: GrowthScore | null; seasonalEvents: any[] }) {
  const [mood, setMood] = useState<string | null>(null), done = goals.filter(g => g.done).length;
  const [quote, setQuote] = useState(0);
  const [showCheckIn, setShowCheckIn] = useState(false);
  const [showVerseMoment, setShowVerseMoment] = useState(false);
  const t = (en: string, fr: string) => tr(user.language, en, fr);
  useEffect(() => {
    const timer = window.setInterval(() => setQuote((value) => (value + 1) % ROTATING_QUOTES.length), 5 * 60 * 1000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => { if (!moodCheckIn.checkedIn) setShowCheckIn(true); }, [moodCheckIn.checkedIn]);
  const activeQuote = ROTATING_QUOTES[quote];
  const firstName = (user.fullName || "Friend").trim().split(" ")[0] || "Friend";
  const streakAtGrace = isStreakAtGraceDay(analytics);
  return <><section className="welcome-row"><div><p className="eyebrow">{t("A fresh spring for your spirit today", "Une nouvelle source pour votre esprit aujourd'hui")}</p><h2>{t("Good morning", "Bonjour")}, {firstName}</h2></div><button className="button primary" onClick={openAi}>{t("Ask AI Companion", "Demander a l'assistant IA")}</button></section>
    <div className="dashboard-grid"><div className="main-column">{seasonalEvents.filter(e => e.is_current).slice(0, 1).map(e => <div className="seasonal-event-banner" key={e.id}><b>{e.title}</b><p>{e.description}</p></div>)}<article className="verse-card fade-panel" key={activeQuote.reference}><p>{t("Verse of the day", "Verset du jour")}</p><q>{activeQuote.verse}</q><b>{activeQuote.reference}</b></article><GrowthScoreCard growthScore={growthScore} language={user.language} /><DailyMannaCard manna={dailyManna} onClaim={claimDailyManna} language={user.language} /><DeclarationCard declaration={declaration} onConfirm={confirmDeclaration} language={user.language} /><button className="button ghost full" onClick={() => setShowVerseMoment(true)}>{t("Verse of the Moment — tap for a fresh word", "Verset du moment — touchez pour un mot frais")}</button><section><SectionTitle title={t("How are you feeling?", "Comment vous sentez-vous ?")} subtitle={t("Choose a feeling for a personal prayer.", "Choisissez un ressenti pour une priere personnelle.")} /><div className="mood-grid">{MOODS.map(x => { const prayer = getMoodPrayer(x); return <button onClick={() => setMood(x)} key={x}><span className={`mood-button-icon ${prayer.tone}`}><MoodIcon name={prayer.icon} /></span>{x}</button>; })}</div></section></div>
      <div className="side-column"><div className="stat-grid"><Stat value={`${analytics.totalPrayers}`} label={t("Prayers", "Prieres")} onClick={openPrayers} /><Stat value={`${analytics.currentStreak}`} label={streakAtGrace ? t("Streak (grace day)", "Serie (jour de grace)") : t("Streak", "Serie")} /><Stat value={`${analytics.visitCount}`} label={t("Visits", "Visites")} /><Stat value="5" label={t("Answered", "Exaucees")} /></div><Panel><SectionTitle title={t("Today's goals", "Objectifs du jour")} subtitle={t(`${done} of ${goals.length} complete`, `${done} sur ${goals.length} termines`)} />{goals.map(goal => <div className="mini-goal" key={goal.id}><span className={goal.done ? "done" : ""}>{goal.done ? "OK" : ""}</span><p>{goal.text}</p></div>)}</Panel></div></div>{mood && <MoodModal mood={mood} token={token} refresh={refresh} close={() => setMood(null)} />}{showCheckIn && <DailyCheckInModal onSubmit={async (m, note) => { await submitMoodCheckIn(m, note); setShowCheckIn(false); }} onClose={() => setShowCheckIn(false)} language={user.language} />}{showVerseMoment && <VerseOfMomentModal fetchVerse={fetchRandomVerse} onClose={() => setShowVerseMoment(false)} language={user.language} />}</>;
}
function isStreakAtGraceDay(analytics: Analytics): boolean {
  if (analytics.gracePeriodAvailable === false) return false;
  if (!analytics.lastActiveDate) return false;
  const last = new Date(`${analytics.lastActiveDate}T00:00:00Z`);
  if (Number.isNaN(last.getTime())) return false;
  const today = new Date();
  const todayOnly = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));
  const diffDays = Math.round((todayOnly.getTime() - last.getTime()) / 86400000);
  return diffDays === 2;
}
function DailyCheckInModal({ onSubmit, onClose, language }: { onSubmit: (mood: string, note?: string) => Promise<void>; onClose: () => void; language: Lang }) {
  const [selected, setSelected] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const t = (en: string, fr: string) => tr(language, en, fr);
  const submit = async () => {
    if (!selected || saving) return;
    setSaving(true);
    try { await onSubmit(selected, note.trim() || undefined); }
    finally { setSaving(false); }
  };
  return <div className="modal-backdrop" onClick={onClose}><section className="mood-modal daily-checkin-modal" onClick={e => e.stopPropagation()}><button className="modal-close" onClick={onClose} aria-label="Close">x</button><p className="eyebrow">{t("Daily check-in", "Bilan quotidien")}</p><h2>{t("How are you today?", "Comment allez-vous aujourd'hui ?")}</h2><div className="mood-grid checkin-grid">{MOODS.map(m => <button key={m} className={selected === m ? "selected" : ""} onClick={() => setSelected(m)}>{m}</button>)}</div><textarea value={note} onChange={e => setNote(e.target.value)} placeholder={t("Add a quick note (optional)", "Ajoutez une note rapide (facultatif)")} /><button className="button primary full" disabled={!selected || saving} onClick={submit}>{saving ? t("Saving...", "Enregistrement...") : t("Save check-in", "Enregistrer")}</button></section></div>;
}
function GrowthScoreCard({ growthScore, language }: { growthScore: GrowthScore | null; language: Lang }) {
  const t = (en: string, fr: string) => tr(language, en, fr);
  if (!growthScore || !growthScore.categories?.length) return null;
  const overall = growthScore.overall || 0;
  return <Panel className="growth-score-card">
    <SectionTitle title={t("Spiritual Growth Score", "Score de croissance spirituelle")} subtitle={t("Live", "En direct")} />
    <div className="growth-score-summary">
      <div className="growth-score-ring" style={{ background: `conic-gradient(var(--leaf) 0 ${overall}%, #e8f1ee ${overall}% 100%)` }}><span>{overall}%</span></div>
      <p>{overall >= 75 ? t("You are growing steadily across every area — keep going.", "Vous grandissez de maniere constante — continuez ainsi.") : overall >= 40 ? t("Good progress. A little more consistency will lift your score.", "Bon progres. Un peu plus de constance fera monter votre score.") : t("Every small step counts. Pick one area below to focus on today.", "Chaque petit pas compte. Choisissez un domaine a travailler aujourd'hui.")}</p>
    </div>
    <div className="growth-score-categories">{growthScore.categories.map(cat => <div className="growth-score-row" key={cat.key}><div className="growth-score-row-header"><span>{cat.label}</span><b>{cat.score}%</b></div><div className="growth-progress-bar"><i style={{ width: `${cat.score}%` }} /></div></div>)}</div>
  </Panel>;
}
function DailyMannaCard({ manna, onClaim, language }: { manna: DailyManna; onClaim: () => Promise<DailyManna>; language: Lang }) {
  const [opening, setOpening] = useState(false);
  const [claimed, setClaimed] = useState<DailyManna | null>(null);
  const t = (en: string, fr: string) => tr(language, en, fr);
  const available = manna.available !== false && !claimed;
  const gift = claimed?.gift || manna.preview;
  const streak = claimed?.streak ?? manna.streak ?? 0;
  const open = async () => {
    if (opening || !available) return;
    setOpening(true);
    try { const result = await onClaim(); setClaimed(result); }
    finally { setOpening(false); }
  };
  return <Panel className="manna-card">
    <SectionTitle title={t("Daily Manna", "Manne du jour")} subtitle={t("A fresh gift, available once a day.", "Un don frais, disponible une fois par jour.")} />
    {available
      ? <button className="manna-gift-button" onClick={open} disabled={opening}><span className="tile-icon lime">🎁</span><b>{opening ? t("Opening...", "Ouverture...") : t("Tap to receive today's manna", "Touchez pour recevoir la manne d'aujourd'hui")}</b></button>
      : <div className="manna-reveal"><p className="kicker">{t(`${streak}-day manna streak`, `Serie de manne de ${streak} jours`)}</p>{gift && <blockquote><q>{gift.verse}</q><b>{gift.ref}</b></blockquote>}{gift?.blessing && <p>{gift.blessing}</p>}</div>}
  </Panel>;
}
function DeclarationCard({ declaration, onConfirm, language }: { declaration: Declaration; onConfirm: () => Promise<void>; language: Lang }) {
  const [confirming, setConfirming] = useState(false);
  const t = (en: string, fr: string) => tr(language, en, fr);
  const text = declaration.declaration?.text;
  const streak = declaration.streak ?? 0;
  const confirmed = declaration.confirmedToday === true;
  if (!text) return null;
  const confirm = async () => {
    if (confirming || confirmed) return;
    setConfirming(true);
    try { await onConfirm(); }
    finally { setConfirming(false); }
  };
  return <Panel className="declaration-card">
    <SectionTitle title={t("Today's Declaration", "Declaration du jour")} subtitle={streak > 0 ? t(`${streak}-day streak`, `Serie de ${streak} jours`) : t("Speak faith over your day", "Proclamez la foi sur votre journee")} />
    <blockquote className="declaration-text"><q>{text}</q></blockquote>
    <button className="button ghost full declaration-confirm" disabled={confirmed || confirming} onClick={confirm}>{confirmed ? t("Declared today", "Declare aujourd'hui") : confirming ? t("Confirming...", "Confirmation...") : t("I declare this over my life", "Je declare ceci sur ma vie")}</button>
  </Panel>;
}
function VerseOfMomentModal({ fetchVerse, onClose, language }: { fetchVerse: () => Promise<{ verse: string; reference: string }>; onClose: () => void; language: Lang }) {
  const [verse, setVerse] = useState<{ verse: string; reference: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [hasError, setHasError] = useState(false);
  const t = (en: string, fr: string) => tr(language, en, fr);
  const loadNext = async () => {
    if (loading) return;
    setLoading(true);
    setHasError(false);
    try { setVerse(await fetchVerse()); }
    catch (_e) { setVerse(current => { if (!current) setHasError(true); return current; }); }
    finally { setLoading(false); }
  };
  useEffect(() => { loadNext(); }, []);
  return <div className="verse-moment-backdrop" onClick={loadNext}>
    <button className="modal-close verse-moment-close" onClick={(e) => { e.stopPropagation(); onClose(); }} aria-label="Close">x</button>
    {loading && !verse
      ? <p className="verse-moment-loading">{t("Loading...", "Chargement...")}</p>
      : hasError && !verse
        ? <div className="verse-moment-content verse-moment-error">
            <p className="verse-moment-error-title">{t("Couldn't load a verse right now.", "Impossible de charger un verset pour le moment.")}</p>
            <p className="verse-moment-hint">{t("Check your connection and tap anywhere to try again.", "Verifiez votre connexion et touchez pour reessayer.")}</p>
          </div>
        : <div className="verse-moment-content" key={verse?.reference}>
            <q>{verse?.verse}</q>
            <b>{verse?.reference}</b>
            <p className="verse-moment-hint">{t("Tap anywhere for another verse", "Touchez n'importe ou pour un autre verset")}</p>
          </div>}
  </div>;
}
function PrayerScreen({ items, token, refresh, openAi, language }: { items:PrayerItem[]; token:string; refresh:()=>Promise<void>; openAi: () => void; language: Lang }) { const [active,setActive]=useState<PrayerItem|null>(null); const t = (en: string, fr: string) => tr(language, en, fr); return <><PageIntro title={t("Prayer Library", "Bibliotheque de prieres")} subtitle={t("Saved prayers and guided moments for every season.", "Prieres enregistrees et moments guides pour chaque saison.")} action={<button className="button primary" onClick={openAi}>{t("Ask AI Companion", "Demander a l'assistant IA")}</button>} /><div className="library-grid">{items.map(p => <PrayerTile {...p} onOpen={()=>setActive(p)} key={prayerIdentifier(p)} />)}</div>{active&&<TimedPrayerModal item={active} token={token} refresh={refresh} close={()=>setActive(null)} />}</>; }
function JournalScreen({ token, entries, setEntries, language, prayers, markPrayerAnswered }: { token:string; entries: JournalEntry[]; setEntries: (entries: JournalEntry[]) => void; language: Lang; prayers: Prayer[]; markPrayerAnswered: (id: string, testimony?: string) => Promise<void> }) {
  const [text, setText] = useState("");
  const [openEntryId, setOpenEntryId] = useState<string | null>(null);
  const [tab, setTab] = useState<"entries" | "answered">("entries");
  const [testimonyDraft, setTestimonyDraft] = useState<{ id: string; text: string } | null>(null);
  const t = (en: string, fr: string) => tr(language, en, fr);
  const answered = prayers.filter(p => p.is_answered);
  const unanswered = prayers.filter(p => !p.is_answered);
  return <><PageIntro title={t("Prayer Journal", "Journal de priere")} subtitle={t("Record requests, make room for reflection, and celebrate answers.", "Consignez vos demandes, faites de la place pour la reflexion et celebrez les reponses.")} />
    <div className="journal-tabs"><button className={tab === "entries" ? "selected" : ""} onClick={() => setTab("entries")}>{t("My Entries", "Mes entrees")}</button><button className={tab === "answered" ? "selected" : ""} onClick={() => setTab("answered")}>{t("Answered Prayer Wall", "Mur des prieres exaucees")}</button></div>
    {tab === "entries" ? <><Panel className="journal-compose"><textarea value={text} onChange={e => setText(e.target.value)} placeholder={t("What are you carrying today?", "Que portez-vous aujourd'hui ?")} /><button className="button primary" onClick={async () => { if (text.trim()) { const entry=await api<any>("/journal",{method:"POST",body:JSON.stringify({title:text.slice(0,54),content:text})},token); setEntries([{ id:entry.id, body:entry.content, date:entry.created_date }, ...entries]); setOpenEntryId(entry.id); setText(""); } }}>{t("+ Add entry", "+ Ajouter une entree")}</button></Panel><div className="entry-list">{entries.map(entry => { const isOpen = openEntryId === entry.id; const preview = entry.body.length > 120 ? `${entry.body.slice(0, 120)}...` : entry.body; return <Panel key={entry.id} className={`journal-entry-card ${isOpen ? "open" : ""}`.trim()}><button type="button" className="journal-entry-toggle" onClick={() => setOpenEntryId(current => current === entry.id ? null : entry.id)}><div><small>{entry.date}</small><p className="journal-entry-preview">{isOpen ? entry.body : preview}</p></div><span className="journal-entry-arrow" aria-hidden="true">{isOpen ? "−" : "+"}</span></button>{isOpen && <div className="journal-entry-expanded"><p>{entry.body}</p></div>}</Panel>; })}</div></>
      : <div className="answered-wall">
          {answered.length === 0 && <Panel><p>{t("No answered prayers yet. Mark a prayer as answered below when God moves.", "Aucune priere exaucee pour le moment. Marquez une priere comme exaucee ci-dessous.")}</p></Panel>}
          {answered.map(p => <Panel key={p.id} className="answered-prayer-card"><p className="answered-prayer-text">{p.prayer_text}</p>{p.testimony && <p className="answered-prayer-testimony">{p.testimony}</p>}</Panel>)}
          {unanswered.length > 0 && <><p className="journal-subhead">{t("Mark a prayer as answered", "Marquer une priere comme exaucee")}</p>{unanswered.slice(0, 5).map(p => <Panel key={p.id} className="unanswered-prayer-row"><span>{p.prayer_text}</span><button className="button ghost" onClick={() => setTestimonyDraft({ id: p.id, text: "" })}>{t("Answered", "Exaucee")}</button></Panel>)}</>}
        </div>}
    {testimonyDraft && <div className="modal-backdrop" onClick={() => setTestimonyDraft(null)}><section className="mood-modal testimony-modal" onClick={e => e.stopPropagation()}><h2>{t("Share your testimony", "Partagez votre temoignage")}</h2><textarea value={testimonyDraft.text} onChange={e => setTestimonyDraft({ ...testimonyDraft, text: e.target.value })} placeholder={t("How did God answer this?", "Comment Dieu a-t-Il repondu ?")} /><div className="permission-actions"><button className="button ghost" onClick={() => setTestimonyDraft(null)}>{t("Cancel", "Annuler")}</button><button className="button primary" onClick={async () => { await markPrayerAnswered(testimonyDraft.id, testimonyDraft.text.trim()); setTestimonyDraft(null); }}>{t("Save", "Enregistrer")}</button></div></section></div>}
  </>;
}
function GoalsScreen({ token, goals, refresh, language }: { token:string; goals: Goal[]; refresh:()=>Promise<void>; language: Lang }) {
  const [active,setActive]=useState<Goal|null>(null);
  const [showChallenges, setShowChallenges] = useState(false);
  const [showFasting, setShowFasting] = useState(false);
  const [showReadingPlans, setShowReadingPlans] = useState(false);
  const [showMemoryCards, setShowMemoryCards] = useState(false);
  const t = (en: string, fr: string) => tr(language, en, fr);
  return <><PageIntro title={t("Daily Goals", "Objectifs quotidiens")} subtitle={t("Open each assigned activity and complete the faithful step.", "Ouvrez chaque activite assignee et accomplissez l'etape fidele.")} /><div className="goal-list">{goals.map(goal => <button className={goal.done ? "goal-row complete" : "goal-row"} key={goal.id} onClick={()=>!goal.done&&setActive(goal)}><span>{goal.done?"OK":"o"}</span><b>{goal.text}</b></button>)}</div>
    <p className="growth-section-title">{t("Structured Growth", "Croissance structuree")}</p>
    <div className="growth-tile-list">
      <button className="growth-tile" onClick={() => setShowChallenges(true)}><span className="tile-icon coral">{"\u{1F3C6}"}</span><div><b>{t("Prayer Challenges", "Defis de priere")}</b><p>{t("Join a multi-day prayer challenge.", "Rejoignez un defi de priere sur plusieurs jours.")}</p></div></button>
      <button className="growth-tile" onClick={() => setShowFasting(true)}><span className="tile-icon green">{"\u{1F37D}"}</span><div><b>{t("Fasting Tracker", "Suivi de jeune")}</b><p>{t("Start a fast and track your progress.", "Commencez un jeune et suivez votre progression.")}</p></div></button>
      <button className="growth-tile" onClick={() => setShowReadingPlans(true)}><span className="tile-icon sky">{"\u{1F4D6}"}</span><div><b>{t("Bible Reading Plan", "Plan de lecture biblique")}</b><p>{t("Follow a guided plan through Scripture.", "Suivez un plan guide a travers l'Ecriture.")}</p></div></button>
      <button className="growth-tile" onClick={() => setShowMemoryCards(true)}><span className="tile-icon emerald">{"\u{1F0CF}"}</span><div><b>{t("Scripture Memory Cards", "Cartes memoire bibliques")}</b><p>{t("Flashcard your way to memorizing verses.", "Memorisez des versets avec des cartes.")}</p></div></button>
    </div>
    {active&&<GoalModal goal={active} token={token} refresh={refresh} close={()=>setActive(null)} />}
    {showChallenges && <ChallengesModal token={token} language={language} onClose={() => setShowChallenges(false)} />}
    {showFasting && <FastingTrackerModal token={token} language={language} onClose={() => setShowFasting(false)} />}
    {showReadingPlans && <ReadingPlansModal token={token} language={language} onClose={() => setShowReadingPlans(false)} />}
    {showMemoryCards && <MemoryCardsModal token={token} language={language} onClose={() => setShowMemoryCards(false)} />}
  </>;
}

function ChallengesModal({ token, language, onClose }: { token: string; language: Lang; onClose: () => void }) {
  const t = (en: string, fr: string) => tr(language, en, fr);
  const [challenges, setChallenges] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = async () => {
    try { setChallenges(await api<any[]>("/challenges", {}, token)); }
    catch { setChallenges([]); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const join = async (id: string) => {
    setBusyId(id);
    try { await api(`/challenges/${id}/join`, { method: "POST", body: JSON.stringify({}) }, token); await load(); }
    finally { setBusyId(null); }
  };
  const checkIn = async (id: string) => {
    setBusyId(id);
    try {
      const updated = await api<any>(`/challenges/${id}/check-in`, { method: "POST", body: JSON.stringify({}) }, token);
      setChallenges(current => current.map(c => c.id === id ? updated : c));
    } finally { setBusyId(null); }
  };

  return <div className="modal-backdrop" onClick={onClose}>
    <section className="mood-modal growth-modal" onClick={e => e.stopPropagation()}>
      <button className="modal-close" onClick={onClose} aria-label="Close">x</button>
      <p className="eyebrow">{t("Structured Growth", "Croissance structuree")}</p>
      <h2>{t("Prayer Challenges", "Defis de priere")}</h2>
      {loading ? <p>{t("Loading...", "Chargement...")}</p> : <div className="growth-card-list">
        {challenges.map(c => {
          const progress = c.duration_days ? Math.min(1, c.days_completed / c.duration_days) : 0;
          const busy = busyId === c.id;
          return <div className="growth-card" key={c.id}>
            <div className="growth-card-header"><b>{c.title}</b><span className="growth-badge">{c.duration_days} {t("days", "jours")}</span></div>
            <p>{c.description}</p>
            {c.enrolled && <><div className="growth-progress-bar"><i style={{ width: `${progress * 100}%` }} /></div><small>{c.finished ? t("Completed! 🎉", "Termine ! 🎉") : t(`Day ${c.days_completed} of ${c.duration_days}`, `Jour ${c.days_completed} sur ${c.duration_days}`)}</small></>}
            {!c.enrolled
              ? <button className="button primary full" disabled={busy} onClick={() => join(c.id)}>{t("Join Challenge", "Rejoindre le defi")}</button>
              : c.finished
                ? <button className="button secondary full" disabled>{t("Completed", "Termine")}</button>
                : <button className="button primary full" disabled={busy || c.checked_in_today} onClick={() => checkIn(c.id)}>{c.checked_in_today ? t("Checked in for today", "Enregistre aujourd'hui") : t("Check In Today", "Enregistrer aujourd'hui")}</button>}
          </div>;
        })}
      </div>}
    </section>
  </div>;
}

function FastingTrackerModal({ token, language, onClose }: { token: string; language: Lang; onClose: () => void }) {
  const t = (en: string, fr: string) => tr(language, en, fr);
  const types = [["water", t("Water Fast", "Jeune a l'eau")], ["daniel", t("Daniel Fast", "Jeune de Daniel")], ["partial", t("Partial Fast", "Jeune partiel")], ["full", t("Full Fast", "Jeune complet")]];
  const [active, setActive] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [elapsed, setElapsed] = useState("00:00:00");

  const load = async () => {
    try {
      const [a, h] = await Promise.all([api<any>("/fasts/active", {}, token), api<any[]>("/fasts", {}, token)]);
      setActive(a); setHistory(h);
    } catch { setHistory([]); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (!active) return;
    const tick = () => {
      const started = new Date(active.started_at).getTime();
      const diff = Math.max(0, Date.now() - started);
      const h = String(Math.floor(diff / 3600000)).padStart(2, "0");
      const m = String(Math.floor((diff % 3600000) / 60000)).padStart(2, "0");
      const s = String(Math.floor((diff % 60000) / 1000)).padStart(2, "0");
      setElapsed(`${h}:${m}:${s}`);
    };
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [active]);

  const start = async (fastType: string) => {
    setBusy(true);
    try { setActive(await api<any>("/fasts/start", { method: "POST", body: JSON.stringify({ fast_type: fastType }) }, token)); }
    catch (err: any) { window.alert(err?.message || t("Could not start fast.", "Impossible de commencer le jeune.")); }
    finally { setBusy(false); }
  };
  const end = async (status: "completed" | "broken") => {
    if (!active) return;
    setBusy(true);
    try { await api(`/fasts/${active.id}/end`, { method: "POST", body: JSON.stringify({ status }) }, token); setActive(null); await load(); }
    finally { setBusy(false); }
  };

  return <div className="modal-backdrop" onClick={onClose}>
    <section className="mood-modal growth-modal" onClick={e => e.stopPropagation()}>
      <button className="modal-close" onClick={onClose} aria-label="Close">x</button>
      <p className="eyebrow">{t("Structured Growth", "Croissance structuree")}</p>
      <h2>{t("Fasting Tracker", "Suivi de jeune")}</h2>
      {loading ? <p>{t("Loading...", "Chargement...")}</p> : active ? <div className="fasting-active">
        <p className="fasting-type">{types.find(x => x[0] === active.fast_type)?.[1] || "Fast"}</p>
        <p className="fasting-timer">{elapsed}</p>
        <p className="fasting-goal">{t(`Goal: ${active.goal_hours} hours`, `Objectif : ${active.goal_hours} heures`)}</p>
        <div className="fasting-actions"><button className="button ghost" disabled={busy} onClick={() => end("broken")}>{t("Break Fast", "Rompre le jeune")}</button><button className="button primary" disabled={busy} onClick={() => end("completed")}>{t("Complete", "Terminer")}</button></div>
      </div> : <>
        <p>{t("Choose a fast type to begin.", "Choisissez un type de jeune pour commencer.")}</p>
        <div className="fasting-type-list">{types.map(([id, label]) => <button key={id} className="button secondary full" disabled={busy} onClick={() => start(id)}>{label}</button>)}</div>
      </>}
      {history.length > 0 && <div className="fasting-history"><p className="growth-section-title">{t("History", "Historique")}</p>{history.map(f => <div className="fasting-history-row" key={f.id}><span>{types.find(x => x[0] === f.fast_type)?.[1] || "Fast"}</span><b className={`fast-status ${f.status}`}>{f.status}</b></div>)}</div>}
    </section>
  </div>;
}

function ReadingPlansModal({ token, language, onClose }: { token: string; language: Lang; onClose: () => void }) {
  const t = (en: string, fr: string) => tr(language, en, fr);
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = async () => {
    try { setPlans(await api<any[]>("/reading-plans", {}, token)); }
    catch { setPlans([]); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const start = async (id: string) => {
    setBusyId(id);
    try { await api(`/reading-plans/${id}/start`, { method: "POST", body: JSON.stringify({}) }, token); await load(); }
    finally { setBusyId(null); }
  };
  const checkOff = async (id: string) => {
    setBusyId(id);
    try {
      const updated = await api<any>(`/reading-plans/${id}/check-off`, { method: "POST", body: JSON.stringify({}) }, token);
      setPlans(current => current.map(p => p.id === id ? updated : p));
    } finally { setBusyId(null); }
  };

  return <div className="modal-backdrop" onClick={onClose}>
    <section className="mood-modal growth-modal" onClick={e => e.stopPropagation()}>
      <button className="modal-close" onClick={onClose} aria-label="Close">x</button>
      <p className="eyebrow">{t("Structured Growth", "Croissance structuree")}</p>
      <h2>{t("Bible Reading Plans", "Plans de lecture biblique")}</h2>
      {loading ? <p>{t("Loading...", "Chargement...")}</p> : <div className="growth-card-list">
        {plans.map(plan => {
          const progress = plan.duration_days ? Math.min(1, plan.days_completed / plan.duration_days) : 0;
          const currentDay = Array.isArray(plan.days) ? plan.days[plan.days_completed] : null;
          const busy = busyId === plan.id;
          return <div className="growth-card" key={plan.id}>
            <b>{plan.title}</b>
            <p>{plan.description}</p>
            {plan.started && !plan.finished && currentDay && <div className="reading-day-card"><b>{t(`Day ${currentDay.day}`, `Jour ${currentDay.day}`)}: {currentDay.titleEn}</b><p>{currentDay.referenceEn}</p></div>}
            {plan.started && <><div className="growth-progress-bar"><i style={{ width: `${progress * 100}%` }} /></div><small>{plan.finished ? t("Completed! 📖", "Termine ! 📖") : t(`Day ${plan.days_completed} of ${plan.duration_days}`, `Jour ${plan.days_completed} sur ${plan.duration_days}`)}</small></>}
            {!plan.started
              ? <button className="button primary full" disabled={busy} onClick={() => start(plan.id)}>{t("Start Plan", "Commencer le plan")}</button>
              : plan.finished
                ? <button className="button secondary full" disabled>{t("Completed", "Termine")}</button>
                : <button className="button primary full" disabled={busy || plan.checked_in_today} onClick={() => checkOff(plan.id)}>{plan.checked_in_today ? t("Today's reading done", "Lecture du jour terminee") : t("Mark Today's Reading Done", "Marquer la lecture du jour")}</button>}
          </div>;
        })}
      </div>}
    </section>
  </div>;
}

function MemoryCardsModal({ token, language, onClose }: { token: string; language: Lang; onClose: () => void }) {
  const t = (en: string, fr: string) => tr(language, en, fr);
  const [cards, setCards] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [flipped, setFlipped] = useState<Record<string, boolean>>({});

  const load = async () => {
    try { setCards(await api<any[]>("/memory-cards", {}, token)); }
    catch { setCards([]); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const addCard = async (id: string) => {
    setBusyId(id);
    try { await api(`/memory-cards/${id}/add`, { method: "POST", body: JSON.stringify({}) }, token); await load(); }
    finally { setBusyId(null); }
  };
  const review = async (id: string) => {
    setBusyId(id);
    try {
      const updated = await api<any>(`/memory-cards/${id}/review`, { method: "POST", body: JSON.stringify({}) }, token);
      setCards(current => current.map(c => c.id === id ? updated : c));
    } finally { setBusyId(null); }
  };
  const quiz = async (id: string, passed: boolean) => {
    setBusyId(id);
    try {
      const updated = await api<any>(`/memory-cards/${id}/quiz`, { method: "POST", body: JSON.stringify({ passed }) }, token);
      setCards(current => current.map(c => c.id === id ? updated : c));
      if (passed) window.alert(t("🎉 Verse mastered!", "🎉 Verset maitrise !"));
    } finally { setBusyId(null); }
  };

  return <div className="modal-backdrop" onClick={onClose}>
    <section className="mood-modal growth-modal" onClick={e => e.stopPropagation()}>
      <button className="modal-close" onClick={onClose} aria-label="Close">x</button>
      <p className="eyebrow">{t("Structured Growth", "Croissance structuree")}</p>
      <h2>{t("Scripture Memory Cards", "Cartes memoire bibliques")}</h2>
      <p>{t("Add a verse, flip the card to review it, then quiz yourself after 7 days.", "Ajoutez un verset, retournez la carte pour reviser, puis testez-vous apres 7 jours.")}</p>
      {loading ? <p>{t("Loading...", "Chargement...")}</p> : <div className="growth-card-list">
        {cards.map(card => {
          const busy = busyId === card.id;
          if (!card.added) {
            return <div className="growth-card" key={card.id}>
              <b>{card.reference}</b>
              <p>{card.verse}</p>
              <button className="button primary full" disabled={busy} onClick={() => addCard(card.id)}>{t("Add", "Ajouter")}</button>
            </div>;
          }
          const isFlipped = !!flipped[card.id];
          return <div className="growth-card" key={card.id}>
            <div className="memory-card-header"><b>{card.reference}</b>{card.mastered ? <span className="growth-badge mastered">{t("Mastered", "Maitrise")}</span> : card.days_until_quiz > 0 ? <span className="growth-badge">{t(`Quiz in ${card.days_until_quiz}d`, `Quiz dans ${card.days_until_quiz}j`)}</span> : null}</div>
            <button className={`memory-flip-card ${isFlipped ? "flipped" : ""}`.trim()} onClick={() => setFlipped({ ...flipped, [card.id]: !isFlipped })}>{isFlipped ? card.verse : t("Tap to reveal the verse", "Touchez pour reveler le verset")}</button>
            <div className="fasting-actions">
              <button className="button ghost" disabled={busy} onClick={() => review(card.id)}>{card.reviewed_today ? t("Reviewed today", "Revise aujourd'hui") : t("Mark Reviewed", "Marquer comme revise")}</button>
              {card.quiz_unlocked && <button className="button primary" disabled={busy} onClick={() => { if (window.confirm(t("Recite this verse from memory. Did you get it right?", "Recitez ce verset de memoire. L'avez-vous reussi ?"))) quiz(card.id, true); else quiz(card.id, false); }}>{t("Take Quiz", "Faire le quiz")}</button>}
            </div>
          </div>;
        })}
      </div>}
    </section>
  </div>;
}
function WellnessScreen({ token, onNavigate, user }: { token: string; onNavigate: (tab: AppTab) => void; user: User }) {
  const [wellness, setWellness] = useState<Wellness>({});
  const [active, setActive] = useState("goals");
  const [showAffirmations, setShowAffirmations] = useState(false);
  const [showBreathing, setShowBreathing] = useState(false);
  const [showSleep, setShowSleep] = useState(false);
  const [showPrayerRoom, setShowPrayerRoom] = useState(false);
  const [showWorship, setShowWorship] = useState(false);
  const [showWeeklyReview, setShowWeeklyReview] = useState(false);
  const [showCrisisSupport, setShowCrisisSupport] = useState(false);
  const [showUpgradeNote, setShowUpgradeNote] = useState(false);
  const isPremiumUser = !!user.isAdmin || user.plan === "premium";
  const t = (en: string, fr: string) => tr(user.language, en, fr);
  useEffect(() => { api<Wellness>("/onboarding/wellness", {}, token).then(setWellness).catch(() => setWellness({ overall: 68, insight: "Prayer, reflection, and daily goals are building a steadier rhythm.", pillars: { prayer: { score: 76 }, journal: { score: 58 }, goals: { score: 72 } } })); }, [token]);
  const pillar = (key: string) => wellness.pillars?.[key]?.score ?? 0;
  const details = {
    goals: { title: "Scripture Awareness", score: pillar("goals"), icon: <UiIcon name="goals" />, tone: "emerald", summary: "Daily goals and Scripture steps show how consistently you turn intention into practice.", next: "Open Daily Goals and complete one Scripture activity today.", signals: ["Completed goals", "Scripture actions", "Daily consistency"], target: "goals" as AppTab },
    prayer: { title: "Peace", score: pillar("prayer"), icon: <UiIcon name="pray" />, tone: "sky", summary: "Prayer activity reflects how often you pause, breathe, and bring your real life to God.", next: "Choose a guided prayer and stay with it for a quiet moment.", signals: ["Guided prayers", "Mood prayers", "Prayer time"], target: "prayers" as AppTab },
    journal: { title: "Rest", score: pillar("journal"), icon: <UiIcon name="journal" />, tone: "gold", summary: "Journal entries help measure reflection, emotional release, gratitude, and spiritual rest.", next: "Write one honest journal note about what you are carrying today.", signals: ["Journal rhythm", "Reflection depth", "Gratitude"], target: "journal" as AppTab },
    streak: { title: "Consistency", score: pillar("streak"), icon: <UiIcon name="wellness" />, tone: "green", summary: "Your visits, completed actions, and returning rhythm show how faithfully small habits are becoming part of your life.", next: "Return Home and complete one meaningful action today.", signals: ["Current streak", "Daily visits", "Repeat practice"], target: "home" as AppTab },
  };
  const selected = details[active as keyof typeof details];
  const affirmations = [
    "I am loved by God completely, even while I am still growing.",
    "I am held in peace; fear does not have the final word over my day.",
    "God is restoring my mind, renewing my strength, and guiding my next step.",
    "I can move slowly, breathe deeply, and trust that grace is already present.",
    "I am not alone. I am seen, supported, and strengthened for what is ahead.",
  ];
  return <><PageIntro title="Spiritual Wellness" subtitle="AI-guided faith health from onboarding and daily progress." /><div className="wellness-grid"><Panel className="score-panel wellness-score-card"><div className="score-ring" style={{ background: `conic-gradient(var(--emerald) 0 ${wellness.overall ?? 0}%,#e8f1ee ${wellness.overall ?? 0}% 100%)` }}><span>{wellness.overall ?? 0}%</span></div><div><p className="eyebrow">Your wellness score</p><h2>Growing steadily</h2><p>{wellness.insight ?? "Your score updates as you pray, journal, complete goals, and build consistency."}</p></div></Panel><div className="metric-grid wellness-metrics">{Object.entries(details).map(([key, item]) => <Stat key={key} value={`${item.score}%`} label={item.title} active={active === key} onClick={() => setActive(key)} />)}</div></div><Panel className="wellness-detail"><span className={`tile-icon ${selected.tone}`}>{selected.icon}</span><div><p className="eyebrow">Selected insight</p><h3>{selected.title}</h3><p>{selected.summary}</p><div className="wellness-signal-list">{selected.signals.map(signal => <button type="button" key={signal} onClick={() => onNavigate(selected.target)}>{signal}</button>)}</div><button type="button" className="action-step wellness-action" onClick={() => onNavigate(selected.target)}><b>Next step</b>{selected.next}<span>{"->"}</span></button></div></Panel><PrayerTile title="Guided Affirmations" body="Open five faith-filled declarations for peace, restoration, courage, and hope." icon={<MoodIcon name="sparkle" />} tone="green" onOpen={() => setShowAffirmations(true)} /><PrayerTile title="Breathing & Prayer Exercise" body="A guided 4-7-8 breathing rhythm paired with short prayer prompts — great for anxious moments." icon={<UiIcon name="wellness" />} tone="sky" onOpen={() => setShowBreathing(true)} /><PrayerTile title="Sleep Prayer" body="A calming night-mode screen with a slow prayer to help you rest, worry-free." icon={<UiIcon name="wellness" />} tone="gold" onOpen={() => setShowSleep(true)} /><PrayerTile title={isPremiumUser ? "Prayer Room" : "Prayer Room (Premium)"} body="An immersive, ambient timer for sitting quietly with God — 5 to 20 minutes." icon={<UiIcon name="wellness" />} tone="emerald" onOpen={() => isPremiumUser ? setShowPrayerRoom(true) : setShowUpgradeNote(true)} /><PrayerTile title={isPremiumUser ? "Worship Mode" : "Worship Mode (Premium)"} body="A curated worship playlist — tap a track to open it in YouTube or Spotify." icon={<MoodIcon name="sparkle" />} tone="coral" onOpen={() => isPremiumUser ? setShowWorship(true) : setShowUpgradeNote(true)} /><PrayerTile title="Weekly Spiritual Review" body="A short AI reflection on your week, refreshed every Sunday, plus space for your own thoughts." icon={<UiIcon name="wellness" />} tone="sky" onOpen={() => setShowWeeklyReview(true)} /><PrayerTile title="Grief & Crisis Support" body="Gentle content for heavy seasons, plus crisis resources — always free, always here." icon={<UiIcon name="wellness" />} tone="green" onOpen={() => setShowCrisisSupport(true)} />{showAffirmations && <div className="modal-backdrop" onClick={() => setShowAffirmations(false)}><section className="mood-modal affirmation-modal" onClick={event => event.stopPropagation()}><button className="modal-close prayer-close" onClick={() => setShowAffirmations(false)} aria-label="Close affirmations"><ClosePrayerIcon /></button><span className="tile-icon green"><MoodIcon name="sparkle" /></span><p className="eyebrow">Speak life over your day</p><h2>Guided Affirmations</h2><p>Read each declaration slowly. Pause after every line and let the words settle in your heart.</p><div className="affirmation-list">{affirmations.map((text, index) => <article key={text}><span>{String(index + 1).padStart(2, "0")}</span><p>{text}</p></article>)}</div></section></div>}{showBreathing && <BreathingExerciseModal onClose={() => setShowBreathing(false)} />}{showSleep && <SleepPrayerModal onClose={() => setShowSleep(false)} />}
    {showPrayerRoom && <PrayerRoomModal onClose={() => setShowPrayerRoom(false)} />}
    {showWorship && <WorshipModeModal token={token} language={user.language} onClose={() => setShowWorship(false)} />}
    {showWeeklyReview && <WeeklyReviewModal token={token} language={user.language} onClose={() => setShowWeeklyReview(false)} />}
    {showCrisisSupport && <CrisisSupportModal token={token} language={user.language} onClose={() => setShowCrisisSupport(false)} />}
    {showUpgradeNote && <div className="modal-backdrop" onClick={() => setShowUpgradeNote(false)}><section className="mood-modal" onClick={e => e.stopPropagation()}><p className="eyebrow">{t("Premium feature", "Fonction premium")}</p><h2>{t("This is a Premium feature", "Ceci est une fonction premium")}</h2><p>{t("Upgrade on the Android app to unlock it.", "Passez premium sur l application Android pour la debloquer.")}</p><button className="button primary full" onClick={() => setShowUpgradeNote(false)}>{t("Got it", "Compris")}</button></section></div>}
  </>;
}

function BreathingExerciseModal({ onClose }: { onClose: () => void }) {
  const phases = [{ id: "inhale", label: "Breathe in...", seconds: 4 }, { id: "hold", label: "Hold...", seconds: 7 }, { id: "exhale", label: "Breathe out...", seconds: 8 }] as const;
  const prayers = ["Lord, breathe Your peace into me.", "I release my worry into Your hands.", "You are near to me in this moment.", "Fill me with Your calm and quiet strength.", "I trust You with what I cannot control."];
  const [phaseIndex, setPhaseIndex] = useState(0);
  const [cycles, setCycles] = useState(0);
  const phase = phases[phaseIndex];

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (phaseIndex === phases.length - 1) {
        setCycles(c => c + 1);
        setPhaseIndex(0);
      } else {
        setPhaseIndex(phaseIndex + 1);
      }
    }, phase.seconds * 1000);
    return () => window.clearTimeout(timer);
  }, [phaseIndex]);

  return <div className="breathing-modal-backdrop" onClick={onClose}>
    <button className="modal-close breathing-close" onClick={(e) => { e.stopPropagation(); onClose(); }} aria-label="Close">x</button>
    <p className="breathing-title">4-7-8 Breathing</p>
    <p className="breathing-cycle">Cycle {cycles}</p>
    <div className={`breathing-circle phase-${phase.id}`}><span>{phase.label}</span></div>
    <p className="breathing-prayer">"{prayers[cycles % prayers.length]}"</p>
  </div>;
}

function SleepPrayerModal({ onClose }: { onClose: () => void }) {
  const prayers = [
    { prayer: "Lord, as I close my eyes tonight, I release every worry from today into Your hands. Watch over me as I sleep, and let me wake refreshed in Your peace.", verse: "I will lie down and sleep in peace, for you alone, Lord, make me dwell in safety.", ref: "Psalm 4:8" },
    { prayer: "Father, quiet my racing thoughts. Let Your presence surround this room, and let sleep come gently as a gift from You.", verse: "When you lie down, you will not be afraid; when you lie down, your sleep will be sweet.", ref: "Proverbs 3:24" },
    { prayer: "God, thank You for this day, its joys and its hard parts alike. Tonight I rest in knowing You are awake even when I am not.", verse: "He who watches over Israel will neither slumber nor sleep.", ref: "Psalm 121:4" },
    { prayer: "Lord, cover my mind with calm. Take every anxious thought and replace it with trust in Your unfailing care.", verse: "Cast all your anxiety on him because he cares for you.", ref: "1 Peter 5:7" },
  ];
  const [index, setIndex] = useState(0);
  useEffect(() => {
    const timer = window.setInterval(() => setIndex(i => (i + 1) % prayers.length), 14000);
    return () => window.clearInterval(timer);
  }, []);
  const current = prayers[index];
  return <div className="sleep-modal-backdrop" onClick={onClose}>
    <button className="modal-close sleep-close" onClick={(e) => { e.stopPropagation(); onClose(); }} aria-label="Close">x</button>
    <div className="sleep-modal-content" key={index}>
      <p className="sleep-prayer-text">{current.prayer}</p>
      <p className="sleep-verse-text">"{current.verse}"</p>
      <b className="sleep-verse-ref">{current.ref}</b>
    </div>
    <p className="sleep-hint">Rest well. A new prayer follows every 14 seconds.</p>
  </div>;
}

function PrayerRoomModal({ onClose }: { onClose: () => void }) {
  const durations = [5, 10, 15, 20];
  const prompts = [
    "Come as you are. There is nothing you need to fix before entering this space.",
    "Bring to mind one thing you are grateful for today.",
    "Rest in silence for a moment. He is near.",
    "Bring your worries here and lay them down, one by one.",
    "Whisper the name of someone you want to pray for.",
    "Let your breathing slow. There is no rush in this room.",
  ];
  const [minutes, setMinutes] = useState<number | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [promptIndex, setPromptIndex] = useState(0);

  useEffect(() => {
    if (minutes === null) return;
    const timer = window.setInterval(() => {
      setSecondsLeft(current => {
        if (current <= 1) {
          window.clearInterval(timer);
          return 0;
        }
        if ((current - 1) % 45 === 0) setPromptIndex(p => (p + 1) % prompts.length);
        return current - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [minutes]);

  const start = (value: number) => {
    setMinutes(value);
    setSecondsLeft(value * 60);
    setPromptIndex(0);
  };
  const format = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  const finished = minutes !== null && secondsLeft <= 0;

  return <div className="prayer-room-backdrop" onClick={onClose}>
    <button className="modal-close prayer-room-close" onClick={(e) => { e.stopPropagation(); onClose(); }} aria-label="Close">x</button>
    {minutes === null ? <div className="prayer-room-intro" onClick={e => e.stopPropagation()}>
      <p className="prayer-room-title">The Prayer Room</p>
      <p>An immersive, quiet space to sit with God. Choose how long you'd like to stay.</p>
      <div className="prayer-room-durations">{durations.map(d => <button key={d} onClick={() => start(d)}>{d} min</button>)}</div>
    </div> : <div className="prayer-room-session" onClick={e => e.stopPropagation()}>
      <div className="prayer-room-glow" />
      <p className="prayer-room-timer">{finished ? "Amen." : format(secondsLeft)}</p>
      <p className="prayer-room-prompt">{finished ? "Thank You for this time with You, Lord." : prompts[promptIndex]}</p>
      <button className="prayer-room-end" onClick={() => { setMinutes(null); setSecondsLeft(0); }}>{finished ? "Close" : "End session"}</button>
    </div>}
  </div>;
}

function WorshipModeModal({ token, language, onClose }: { token: string; language: Lang; onClose: () => void }) {
  const t = (en: string, fr: string) => tr(language, en, fr);
  const [tracks, setTracks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<any[]>("/worship-tracks", {}, token)
      .then(setTracks)
      .catch(() => setError(t("Worship Mode is a Premium feature.", "Le mode adoration est une fonction premium.")))
      .finally(() => setLoading(false));
  }, []);

  return <div className="modal-backdrop" onClick={onClose}>
    <section className="mood-modal worship-modal" onClick={e => e.stopPropagation()}>
      <button className="modal-close" onClick={onClose} aria-label="Close">x</button>
      <p className="eyebrow">{t("Worship Mode", "Mode adoration")}</p>
      <h2>{t("Tap a track to open it", "Touchez un morceau pour l'ouvrir")}</h2>
      {loading ? <p>{t("Loading...", "Chargement...")}</p> : error ? <p className="form-error">{error}</p> : <div className="worship-track-list">
        {tracks.map(track => <a className="worship-track-row" href={track.url} target="_blank" rel="noreferrer" key={track.id}>
          <div><b>{track.title}</b>{track.artist && <p>{track.artist}</p>}</div>
          {track.duration_label && <span>{track.duration_label}</span>}
        </a>)}
      </div>}
    </section>
  </div>;
}

function WeeklyReviewModal({ token, language, onClose }: { token: string; language: Lang; onClose: () => void }) {
  const t = (en: string, fr: string) => tr(language, en, fr);
  const [review, setReview] = useState<any>(null);
  const [reflection, setReflection] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api<any>(`/weekly-review?language=${language}`, {}, token)
      .then(data => { setReview(data); setReflection(data.user_reflection || ""); })
      .catch(() => setReview(null))
      .finally(() => setLoading(false));
  }, []);

  const save = async () => {
    if (!reflection.trim() || saving) return;
    setSaving(true);
    try {
      const data = await api<any>("/weekly-review/reflection", { method: "POST", body: JSON.stringify({ reflection: reflection.trim(), language }) }, token);
      setReview(data);
    } finally {
      setSaving(false);
    }
  };

  const stats = review?.stats || {};
  return <div className="modal-backdrop" onClick={onClose}>
    <section className="mood-modal weekly-review-modal" onClick={e => e.stopPropagation()}>
      <button className="modal-close" onClick={onClose} aria-label="Close">x</button>
      <p className="eyebrow">{t("Weekly Spiritual Review", "Bilan spirituel hebdomadaire")}</p>
      {loading ? <p>{t("Loading...", "Chargement...")}</p> : <>
        <h2>{t(`Week of ${review?.week_start_date || ""}`, `Semaine du ${review?.week_start_date || ""}`)}</h2>
        <p>{review?.ai_summary || t("Your week's reflection will appear here.", "Votre reflexion de la semaine apparaitra ici.")}</p>
        <div className="weekly-review-stats">
          <span>{stats.prayers ?? 0} {t("prayers", "prieres")}</span>
          <span>{stats.journalEntries ?? 0} {t("journal", "journal")}</span>
          <span>{stats.goalsCompleted ?? 0} {t("goals", "objectifs")}</span>
          <span>{stats.currentStreak ?? 0}{t("d streak", "j serie")}</span>
        </div>
        <p className="growth-section-title">{t("Your Reflection", "Votre reflexion")}</p>
        <textarea value={reflection} onChange={e => setReflection(e.target.value)} placeholder={t("How was your week with God?", "Comment s'est passee votre semaine avec Dieu ?")} rows={4} />
        <button className="button primary full" disabled={!reflection.trim() || saving} onClick={save}>{saving ? t("Saving...", "Enregistrement...") : t("Save Reflection", "Enregistrer la reflexion")}</button>
      </>}
    </section>
  </div>;
}

function CrisisSupportModal({ token, language, onClose }: { token: string; language: Lang; onClose: () => void }) {
  const t = (en: string, fr: string) => tr(language, en, fr);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<any>(`/mental-health-content/crisis-support?language=${language}`, {}, token)
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  return <div className="modal-backdrop" onClick={onClose}>
    <section className="mood-modal crisis-support-modal" onClick={e => e.stopPropagation()}>
      <button className="modal-close" onClick={onClose} aria-label="Close">x</button>
      <p className="eyebrow">{t("Grief & Crisis Support", "Deuil et soutien en cas de crise")}</p>
      <h2>{t("You are not alone", "Vous n'etes pas seul(e)")}</h2>
      {loading ? <p>{t("Loading...", "Chargement...")}</p> : <>
        <div className="crisis-resources">
          <p className="crisis-warning">{t("If you are in immediate danger, please contact local emergency services right away.", "Si vous etes en danger immediat, contactez immediatement les services d'urgence locaux.")}</p>
          {(data?.resources || []).map((r: any) => <div className="crisis-resource-row" key={r.name}><b>{r.name}</b><p>{r.detail}</p></div>)}
          {data?.note && <p className="crisis-note">{data.note}</p>}
        </div>
        <div className="growth-card-list">
          {(data?.content || []).map((item: any) => <div className="growth-card" key={item.id}><b>{item.title}</b><p>{item.content}</p></div>)}
        </div>
      </>}
    </section>
  </div>;
}

function CommunityScreen({ token, user }: { token: string; user: User }) {
  const t = (en: string, fr: string) => tr(user.language, en, fr);
  const isPremiumUser = !!user.isAdmin || user.plan === "premium";
  const [active, setActive] = useState<string | null>(null);
  const [showUpgradeNote, setShowUpgradeNote] = useState(false);
  const tiles = [
    { id: "prayer-chain", title: t("Prayer Chain", "Chaine de priere"), subtitle: t("Share a request and let others pray with you.", "Partagez une demande et laissez d'autres prier avec vous."), icon: "\u2764\ufe0f", premium: false },
    { id: "testimonies", title: t("Testimony Feed", "Fil des temoignages"), subtitle: t("Celebrate answered prayers with the community.", "Celebrez les prieres exaucees avec la communaute."), icon: "\u2728", premium: false },
    { id: "accountability", title: t("Accountability Partner", "Partenaire de responsabilisation"), subtitle: t("Pair up with someone to stay consistent together.", "Associez-vous a quelqu'un pour rester constant ensemble."), icon: "\ud83e\udd1d", premium: false },
    { id: "groups", title: isPremiumUser ? t("Prayer Groups", "Groupes de priere") : t("Prayer Groups (Premium)", "Groupes de priere (Premium)"), subtitle: t("Join a church or family group and pray together.", "Rejoignez un groupe d'eglise ou de famille."), icon: "\ud83d\udc65", premium: true },
    { id: "mentorship", title: isPremiumUser ? t("Spiritual Mentorship", "Mentorat spirituel") : t("Spiritual Mentorship (Premium)", "Mentorat spirituel (Premium)"), subtitle: t("Find a mentor or become one for someone else.", "Trouvez un mentor ou devenez-en un."), icon: "\ud83c\udf31", premium: true },
  ];
  const openTile = (id: string, premium: boolean) => {
    if (premium && !isPremiumUser) { setShowUpgradeNote(true); return; }
    setActive(id);
  };
  return <>
    <PageIntro title={t("Community", "Communaute")} subtitle={t("You're not alone in this. Pray with others, celebrate answered prayers, and grow together.", "Vous n'etes pas seul(e). Priez avec d'autres et grandissez ensemble.")} />
    <div className="growth-tile-list">
      {tiles.map(tile => <button className="growth-tile" key={tile.id} onClick={() => openTile(tile.id, tile.premium)}><span className="tile-icon coral">{tile.icon}</span><div><b>{tile.title}</b><p>{tile.subtitle}</p></div></button>)}
    </div>
    {active === "prayer-chain" && <PrayerChainModal token={token} language={user.language} onClose={() => setActive(null)} />}
    {active === "testimonies" && <TestimonyFeedModal token={token} language={user.language} onClose={() => setActive(null)} />}
    {active === "accountability" && <AccountabilityModal token={token} language={user.language} onClose={() => setActive(null)} />}
    {active === "groups" && <PrayerGroupsModal token={token} language={user.language} onClose={() => setActive(null)} />}
    {active === "mentorship" && <MentorshipModal token={token} language={user.language} onClose={() => setActive(null)} />}
    {showUpgradeNote && <div className="modal-backdrop" onClick={() => setShowUpgradeNote(false)}><section className="mood-modal" onClick={e => e.stopPropagation()}><p className="eyebrow">{t("Premium feature", "Fonction premium")}</p><h2>{t("This is a Premium feature", "Ceci est une fonction premium")}</h2><p>{t("Upgrade on the Android app to unlock it.", "Passez premium sur l application Android pour la debloquer.")}</p><button className="button primary full" onClick={() => setShowUpgradeNote(false)}>{t("Got it", "Compris")}</button></section></div>}
  </>;
}

function PrayerChainModal({ token, language, onClose }: { token: string; language: Lang; onClose: () => void }) {
  const t = (en: string, fr: string) => tr(language, en, fr);
  const [requests, setRequests] = useState<any[]>([]);
  const [text, setText] = useState("");
  const [anonymous, setAnonymous] = useState(false);
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = () => api<any[]>("/prayer-chain", {}, token).then(setRequests).catch(() => setRequests([])).finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

  const post = async () => {
    if (!text.trim() || posting) return;
    setPosting(true);
    try {
      const request = await api<any>("/prayer-chain", { method: "POST", body: JSON.stringify({ text: text.trim(), is_anonymous: anonymous }) }, token);
      setRequests(current => [request, ...current]);
      setText("");
    } finally { setPosting(false); }
  };
  const pray = async (id: string) => {
    setBusyId(id);
    try {
      const updated = await api<any>(`/prayer-chain/${id}/pray`, { method: "POST", body: JSON.stringify({}) }, token);
      setRequests(current => current.map(r => r.id === id ? updated : r));
    } finally { setBusyId(null); }
  };

  return <div className="modal-backdrop" onClick={onClose}>
    <section className="mood-modal growth-modal community-modal" onClick={e => e.stopPropagation()}>
      <button className="modal-close" onClick={onClose} aria-label="Close">x</button>
      <p className="eyebrow">{t("Community", "Communaute")}</p>
      <h2>{t("Prayer Chain", "Chaine de priere")}</h2>
      <textarea value={text} onChange={e => setText(e.target.value)} placeholder={t("What would you like prayer for?", "Pour quoi voulez-vous qu'on prie ?")} rows={3} />
      <label className="community-checkbox"><input type="checkbox" checked={anonymous} onChange={e => setAnonymous(e.target.checked)} /> {t("Post anonymously", "Publier anonymement")}</label>
      <button className="button primary full" disabled={!text.trim() || posting} onClick={post}>{posting ? t("Posting...", "Publication...") : t("Share Request", "Partager la demande")}</button>
      {loading ? <p>{t("Loading...", "Chargement...")}</p> : <div className="growth-card-list">
        {requests.map(r => <div className="growth-card" key={r.id}>
          <p>{r.text}</p>
          <div className="community-row"><span>{r.is_anonymous ? t("Anonymous", "Anonyme") : (r.author || t("A friend", "Un ami"))}</span>
            <button className="button ghost" disabled={busyId === r.id || r.prayed_by_me || r.is_mine} onClick={() => pray(r.id)}>{r.prayed_by_me ? t(`Prayed (${r.prayer_count})`, `Prie (${r.prayer_count})`) : t(`I Prayed This (${r.prayer_count})`, `J'ai prie (${r.prayer_count})`)}</button>
          </div>
        </div>)}
      </div>}
    </section>
  </div>;
}

function TestimonyFeedModal({ token, language, onClose }: { token: string; language: Lang; onClose: () => void }) {
  const t = (en: string, fr: string) => tr(language, en, fr);
  const [testimonies, setTestimonies] = useState<any[]>([]);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [anonymous, setAnonymous] = useState(false);
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = () => api<any[]>("/testimonies", {}, token).then(setTestimonies).catch(() => setTestimonies([])).finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

  const post = async () => {
    if (!title.trim() || !content.trim() || posting) return;
    setPosting(true);
    try {
      const testimony = await api<any>("/testimonies", { method: "POST", body: JSON.stringify({ title: title.trim(), content: content.trim(), is_anonymous: anonymous }) }, token);
      setTestimonies(current => [testimony, ...current]);
      setTitle(""); setContent("");
    } finally { setPosting(false); }
  };
  const react = async (id: string) => {
    setBusyId(id);
    try {
      const result = await api<any>(`/testimonies/${id}/react`, { method: "POST", body: JSON.stringify({}) }, token);
      setTestimonies(current => current.map(item => item.id === id ? { ...item, amen_count: result.amen_count, reacted_by_me: result.reacted_by_me } : item));
    } finally { setBusyId(null); }
  };

  return <div className="modal-backdrop" onClick={onClose}>
    <section className="mood-modal growth-modal community-modal" onClick={e => e.stopPropagation()}>
      <button className="modal-close" onClick={onClose} aria-label="Close">x</button>
      <p className="eyebrow">{t("Community", "Communaute")}</p>
      <h2>{t("Testimony Feed", "Fil des temoignages")}</h2>
      <input value={title} onChange={e => setTitle(e.target.value)} placeholder={t("A short title", "Un titre court")} />
      <textarea value={content} onChange={e => setContent(e.target.value)} placeholder={t("Share how God answered your prayer...", "Partagez comment Dieu a repondu a votre priere...")} rows={3} />
      <label className="community-checkbox"><input type="checkbox" checked={anonymous} onChange={e => setAnonymous(e.target.checked)} /> {t("Post anonymously", "Publier anonymement")}</label>
      <button className="button primary full" disabled={!title.trim() || !content.trim() || posting} onClick={post}>{posting ? t("Sharing...", "Partage...") : t("Share Testimony", "Partager le temoignage")}</button>
      {loading ? <p>{t("Loading...", "Chargement...")}</p> : <div className="growth-card-list">
        {testimonies.map(item => <div className="growth-card" key={item.id}>
          <b>{item.title}</b><p>{item.content}</p>
          <div className="community-row"><span>{item.is_anonymous ? t("Anonymous", "Anonyme") : (item.author || t("A friend", "Un ami"))}</span>
            <button className="button ghost" disabled={busyId === item.id} onClick={() => react(item.id)}>{item.reacted_by_me ? "\u2764\ufe0f" : "\ud83e\udd0d"} {t(`Amen (${item.amen_count || 0})`, `Amen (${item.amen_count || 0})`)}</button>
          </div>
        </div>)}
      </div>}
    </section>
  </div>;
}

function AccountabilityModal({ token, language, onClose }: { token: string; language: Lang; onClose: () => void }) {
  const t = (en: string, fr: string) => tr(language, en, fr);
  const [partner, setPartner] = useState<any>(null);
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [codeInput, setCodeInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = () => api<any>("/accountability/partner", {}, token).then(data => setPartner(data.partner)).catch(() => setPartner(null)).finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

  const generate = async () => {
    setBusy(true); setError(null);
    try { const data = await api<any>("/accountability/invite", { method: "POST", body: JSON.stringify({}) }, token); setInviteCode(data.invite_code); }
    catch (err: any) { setError(err?.message || t("Could not generate invite.", "Impossible de generer l'invitation.")); }
    finally { setBusy(false); }
  };
  const accept = async () => {
    if (!codeInput.trim()) return;
    setBusy(true); setError(null);
    try { await api("/accountability/accept", { method: "POST", body: JSON.stringify({ invite_code: codeInput.trim() }) }, token); await load(); }
    catch (err: any) { setError(err?.message || t("Invalid code.", "Code invalide.")); }
    finally { setBusy(false); }
  };
  const nudge = async () => {
    setBusy(true);
    try { await api("/accountability/nudge", { method: "POST", body: JSON.stringify({}) }, token); window.alert(t("Nudge sent!", "Rappel envoye !")); }
    finally { setBusy(false); }
  };

  return <div className="modal-backdrop" onClick={onClose}>
    <section className="mood-modal community-modal" onClick={e => e.stopPropagation()}>
      <button className="modal-close" onClick={onClose} aria-label="Close">x</button>
      <p className="eyebrow">{t("Community", "Communaute")}</p>
      <h2>{t("Accountability Partner", "Partenaire de responsabilisation")}</h2>
      {loading ? <p>{t("Loading...", "Chargement...")}</p> : partner ? <div className="growth-card">
        <b>{partner.name}</b>
        <p>{t(`${partner.current_streak}-day streak`, `Serie de ${partner.current_streak} jours`)}</p>
        <button className="button primary full" disabled={busy} onClick={nudge}>{t("Send a Nudge", "Envoyer un rappel")}</button>
      </div> : <>
        <p>{t("Pair up with someone to stay consistent together.", "Associez-vous a quelqu'un pour rester constant.")}</p>
        <div className="growth-card">
          <b>{t("Invite a Partner", "Inviter un partenaire")}</b>
          {inviteCode ? <p className="community-invite-code">{inviteCode}</p> : <button className="button primary full" disabled={busy} onClick={generate}>{t("Generate Invite Code", "Generer un code d'invitation")}</button>}
        </div>
        <div className="growth-card">
          <b>{t("Have a Code?", "Vous avez un code ?")}</b>
          <input value={codeInput} onChange={e => setCodeInput(e.target.value)} placeholder={t("Enter invite code", "Entrez le code")} />
          <button className="button primary full" disabled={!codeInput.trim() || busy} onClick={accept}>{t("Accept Invite", "Accepter l'invitation")}</button>
        </div>
        {error && <p className="form-error">{error}</p>}
      </>}
    </section>
  </div>;
}

function PrayerGroupsModal({ token, language, onClose }: { token: string; language: Lang; onClose: () => void }) {
  const t = (en: string, fr: string) => tr(language, en, fr);
  const [groups, setGroups] = useState<any[]>([]);
  const [detail, setDetail] = useState<any>(null);
  const [requestText, setRequestText] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = () => api<any[]>("/prayer-groups", {}, token).then(setGroups).catch(() => setGroups([])).finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

  const create = async () => {
    const name = window.prompt(t("Group name?", "Nom du groupe ?"));
    if (!name) return;
    try { await api("/prayer-groups", { method: "POST", body: JSON.stringify({ name }) }, token); await load(); } catch (_e) { /* ignore */ }
  };
  const join = async (id: string) => {
    setBusyId(id);
    try { await api(`/prayer-groups/${id}/join`, { method: "POST", body: JSON.stringify({}) }, token); await load(); await openDetail(id); }
    finally { setBusyId(null); }
  };
  const openDetail = async (id: string) => {
    try { setDetail(await api<any>(`/prayer-groups/${id}`, {}, token)); } catch (_e) { /* ignore */ }
  };
  const postRequest = async () => {
    if (!requestText.trim() || !detail) return;
    try {
      await api(`/prayer-groups/${detail.id}/requests`, { method: "POST", body: JSON.stringify({ text: requestText.trim() }) }, token);
      setRequestText("");
      await openDetail(detail.id);
    } catch (_e) { /* ignore */ }
  };

  return <div className="modal-backdrop" onClick={onClose}>
    <section className="mood-modal growth-modal community-modal" onClick={e => e.stopPropagation()}>
      <button className="modal-close" onClick={detail ? () => setDetail(null) : onClose} aria-label="Close">x</button>
      <p className="eyebrow">{t("Community", "Communaute")}</p>
      {!detail ? <>
        <h2>{t("Prayer Groups", "Groupes de priere")}</h2>
        <button className="button secondary full" onClick={create}>{t("+ Create Group", "+ Creer un groupe")}</button>
        {loading ? <p>{t("Loading...", "Chargement...")}</p> : <div className="growth-card-list">
          {groups.map(g => <div className="growth-card" key={g.id}>
            <div className="community-row"><b>{g.name}</b><span>{t(`${g.member_count} members`, `${g.member_count} membres`)}</span></div>
            {g.description && <p>{g.description}</p>}
            {g.is_member ? <button className="button secondary full" onClick={() => openDetail(g.id)}>{t("View", "Voir")}</button> : <button className="button primary full" disabled={busyId === g.id} onClick={() => join(g.id)}>{t("Join", "Rejoindre")}</button>}
          </div>)}
        </div>}
      </> : <>
        <h2>{detail.name}</h2>
        <textarea value={requestText} onChange={e => setRequestText(e.target.value)} placeholder={t("Share a prayer request with the group", "Partagez une demande avec le groupe")} rows={3} />
        <button className="button primary full" disabled={!requestText.trim()} onClick={postRequest}>{t("Post", "Publier")}</button>
        <div className="growth-card-list">
          {(detail.requests || []).map((r: any) => <div className="growth-card" key={r.id}><p>{r.text}</p><span>{r.author || t("Anonymous", "Anonyme")}</span></div>)}
        </div>
      </>}
    </section>
  </div>;
}

function MentorshipModal({ token, language, onClose }: { token: string; language: Lang; onClose: () => void }) {
  const t = (en: string, fr: string) => tr(language, en, fr);
  const [mentors, setMentors] = useState<any[]>([]);
  const [matches, setMatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = () => Promise.all([
    api<any[]>("/mentorship/mentors", {}, token).catch(() => []),
    api<any[]>("/mentorship/my-matches", {}, token).catch(() => []),
  ]).then(([m, mm]) => { setMentors(m); setMatches(mm); }).finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

  const becomeMentor = async () => {
    const bio = window.prompt(t("A short bio about your walk with God:", "Une courte bio sur votre marche avec Dieu :"));
    if (bio === null) return;
    try { await api("/mentorship/profile", { method: "POST", body: JSON.stringify({ bio }) }, token); window.alert(t("You're now listed as a mentor.", "Vous etes maintenant liste comme mentor.")); } catch (_e) { /* ignore */ }
  };
  const request = async (mentorUserId: string) => {
    setBusyId(mentorUserId);
    try { await api("/mentorship/request", { method: "POST", body: JSON.stringify({ mentor_user_id: mentorUserId }) }, token); await load(); }
    finally { setBusyId(null); }
  };
  const respond = async (matchId: string, accept: boolean) => {
    setBusyId(matchId);
    try { await api(`/mentorship/${matchId}/respond`, { method: "POST", body: JSON.stringify({ accept }) }, token); await load(); }
    finally { setBusyId(null); }
  };
  const checkIn = async (matchId: string) => {
    const note = window.prompt(t("How is your walk with God this week?", "Comment va votre marche avec Dieu cette semaine ?"));
    if (!note) return;
    try { await api(`/mentorship/${matchId}/check-in`, { method: "POST", body: JSON.stringify({ note }) }, token); await load(); } catch (_e) { /* ignore */ }
  };

  return <div className="modal-backdrop" onClick={onClose}>
    <section className="mood-modal growth-modal community-modal" onClick={e => e.stopPropagation()}>
      <button className="modal-close" onClick={onClose} aria-label="Close">x</button>
      <p className="eyebrow">{t("Community", "Communaute")}</p>
      <h2>{t("Spiritual Mentorship", "Mentorat spirituel")}</h2>
      <button className="button secondary full" onClick={becomeMentor}>{t("Become a Mentor", "Devenir mentor")}</button>
      {loading ? <p>{t("Loading...", "Chargement...")}</p> : <>
        {matches.length > 0 && <div className="growth-card-list">
          {matches.map(m => <div className="growth-card" key={m.id}>
            <b>{t(`${m.other_person} (${m.role === "mentor" ? "you're mentoring" : "your mentor"})`, `${m.other_person}`)}</b>
            <p>{t(`Status: ${m.status}`, `Statut : ${m.status}`)}</p>
            {m.status === "pending" && m.role === "mentor" && <div className="community-row">
              <button className="button ghost" disabled={busyId === m.id} onClick={() => respond(m.id, false)}>{t("Decline", "Refuser")}</button>
              <button className="button primary" disabled={busyId === m.id} onClick={() => respond(m.id, true)}>{t("Accept", "Accepter")}</button>
            </div>}
            {m.status === "active" && <button className="button ghost full" onClick={() => checkIn(m.id)}>{t(`${(m.check_ins || []).length} check-ins — Check In`, `${(m.check_ins || []).length} suivis — Verifier`)}</button>}
          </div>)}
        </div>}
        <p className="growth-section-title">{t("Available Mentors", "Mentors disponibles")}</p>
        <div className="growth-card-list">
          {mentors.map(mentor => <div className="growth-card" key={mentor.mentor_user_id}>
            <b>{mentor.name}</b>{mentor.bio && <p>{mentor.bio}</p>}
            <button className="button primary full" disabled={busyId === mentor.mentor_user_id} onClick={() => request(mentor.mentor_user_id)}>{t("Request", "Demander")}</button>
          </div>)}
          {mentors.length === 0 && <p>{t("No mentors available yet. Be the first!", "Aucun mentor disponible. Soyez le premier !")}</p>}
        </div>
      </>}
    </section>
  </div>;
}
function AiScreen({ user, token, monetization, refreshMonetization }: { user: User; token: string; monetization: MonetizationStatus | null; refreshMonetization: () => Promise<void> }) {
  const t = (en: string, fr: string) => tr(user.language, en, fr);
  const initialMessage: ChatMessage = { role: "assistant", content: t("Hello. I am your Bible and prayer AI. Ask me for a prayer, verse, or encouragement.", "Bonjour. Je suis votre IA biblique et de priere. Demandez-moi une priere, un verset ou un encouragement.") };
  const defaultSessionId = `rs-user-${user.email.toLowerCase()}`;
  const [sessionId, setSessionId] = useState(defaultSessionId);
  const [sessions, setSessions] = useState<{ sessionId: string; updatedAt: string; preview: string }[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([initialMessage]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [aiStatus, setAiStatus] = useState<MonetizationStatus | null>(monetization);
  const [rewardGateOpen, setRewardGateOpen] = useState(false);
  const [countdown, setCountdown] = useState(5);
  const [queuedMessage, setQueuedMessage] = useState<string | null>(null);
  const [showScriptureSearch, setShowScriptureSearch] = useState(false);
  const [showPrayerWriter, setShowPrayerWriter] = useState(false);
  const [showCompanion, setShowCompanion] = useState(false);
  const [showSermon, setShowSermon] = useState(false);
  const [showDreamJournal, setShowDreamJournal] = useState(false);
  const [showUpgradeNote, setShowUpgradeNote] = useState(false);
  const isPremiumUser = !!user.isAdmin || user.plan === "premium";

  useEffect(() => { setAiStatus(monetization); }, [monetization]);
  useEffect(() => {
    if (!rewardGateOpen) return;
    setCountdown(5);
    const timer = window.setInterval(() => setCountdown(value => value <= 1 ? 0 : value - 1), 1000);
    return () => window.clearInterval(timer);
  }, [rewardGateOpen]);

  const loadSessions = async () => {
    try {
      const data = await api<any>("/ai/sessions", {}, token);
      setSessions(Array.isArray(data?.sessions) ? data.sessions : []);
    } catch {
      setSessions([]);
    }
  };

  const loadHistory = async (nextSessionId: string) => {
    setHistoryLoading(true);
    try {
      const data = await api<any>(`/ai/history?sessionId=${encodeURIComponent(nextSessionId)}`, {}, token);
      const rows = Array.isArray(data?.messages) ? data.messages : [];
      if (!rows.length) setMessages([initialMessage]);
      else {
        const mapped = rows
          .map((item: any) => ({ role: item.role === "assistant" || item.role === "model" ? "assistant" : "user", content: String(item.content || "") }))
          .filter((item: ChatMessage) => item.content.trim().length > 0);
        setMessages(mapped.length ? mapped : [initialMessage]);
      }
      setSessionId(nextSessionId);
    } catch {
      setMessages([initialMessage]);
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    loadHistory(defaultSessionId);
    loadSessions();
  }, [user.email]);

  const startNewConversation = () => {
    const nextSession = `rs-user-${user.email.toLowerCase()}-${Date.now()}`;
    setSessionId(nextSession);
    setMessages([initialMessage]);
    setInput("");
  };

  const performSend = async (value: string, unlockToken?: string) => {
    const history = [...messages, { role: "user" as const, content: value }];
    setMessages(history);
    setInput("");
    setTyping(true);
    try {
      const data = await api<any>("/ai/chat", {
        method: "POST",
        body: JSON.stringify({
          message: value,
          sessionId,
          language: user.language,
          userEmail: user.email,
          unlockToken,
          history: history.map(m => ({ role: m.role === "assistant" ? "model" : "user", content: m.content })),
        }),
      }, token);
      setMessages(prev => [...prev, { role: "assistant", content: data.reply }]);
      await loadSessions();
      await refreshMonetization();
    } catch (err) {
      const message = err instanceof Error ? err.message : t("I could not connect right now. Please try again shortly.", "Je ne peux pas me connecter pour le moment. Veuillez reessayer bientot.");
      setMessages(prev => [...prev, { role: "assistant", content: message }]);
      await refreshMonetization();
    } finally {
      setTyping(false);
    }
  };

  const send = async (suggestion?: string) => {
    const value = (suggestion || input).trim();
    if (!value || typing) return;
    if (!isPremiumUser) {
      const remaining = aiStatus?.ai?.remainingToday ?? monetization?.ai?.remainingToday ?? 0;
      if (remaining <= 0) {
        setMessages(prev => [...prev, { role: "assistant", content: t("You have used all 5 free AI sessions for today. Please come back tomorrow or upgrade to Premium.", "Vous avez utilise vos 5 sessions IA gratuites pour aujourd hui. Revenez demain ou passez a Premium.") }]);
        return;
      }
      setQueuedMessage(value);
      setInput("");
      setRewardGateOpen(true);
      return;
    }
    await performSend(value);
  };

  const claimAdAndContinue = async () => {
    if (!queuedMessage) return;
    try {
      const unlock = await api<any>("/monetization/ai/unlock", { method: "POST", body: JSON.stringify({}) }, token);
      setAiStatus(current => current ? { ...current, ai: { ...current.ai, ...unlock } } : current);
      setRewardGateOpen(false);
      const message = queuedMessage;
      setQueuedMessage(null);
      await performSend(message, unlock.unlockToken);
    } catch (err) {
      setRewardGateOpen(false);
      setQueuedMessage(null);
      setMessages(prev => [...prev, { role: "assistant", content: err instanceof Error ? err.message : t("AI access is unavailable right now.", "L acces IA est indisponible pour le moment.") }]);
      await refreshMonetization();
    }
  };

  return <><PageIntro title={t("AI Prayer Companion", "Assistant de priere IA")} subtitle={t("A signed-in space for prayer, Scripture, and reflection.", "Un espace connecte pour la priere, l Ecriture et la reflexion.")} />
    <div className="ai-feature-row"><button className="button secondary" onClick={() => setShowScriptureSearch(true)}>{t("Topical Scripture Search", "Recherche de versets")}</button><button className="button secondary" onClick={() => isPremiumUser ? setShowPrayerWriter(true) : setShowUpgradeNote(true)}>{isPremiumUser ? t("AI Prayer Writer", "Redacteur de prieres IA") : t("AI Prayer Writer (Premium)", "Redacteur de prieres IA (Premium)")}</button><button className="button secondary" onClick={() => isPremiumUser ? setShowCompanion(true) : setShowUpgradeNote(true)}>{isPremiumUser ? t("Spiritual Companion", "Compagnon spirituel") : t("Spiritual Companion (Premium)", "Compagnon spirituel (Premium)")}</button><button className="button secondary" onClick={() => isPremiumUser ? setShowSermon(true) : setShowUpgradeNote(true)}>{isPremiumUser ? t("Sermon Summarizer", "Resume de sermon") : t("Sermon Summarizer (Premium)", "Resume de sermon (Premium)")}</button><button className="button secondary" onClick={() => isPremiumUser ? setShowDreamJournal(true) : setShowUpgradeNote(true)}>{isPremiumUser ? t("Dream & Vision Journal", "Journal de reves") : t("Dream & Vision Journal (Premium)", "Journal de reves (Premium)")}</button></div>
    {!isPremiumUser && <Panel className="ai-access-panel"><h3>{t("Free AI access", "Acces IA gratuit")}</h3><p>{t("Watch one short ad before each AI use. Daily limit: 5.", "Regardez une courte pub avant chaque utilisation de l IA. Limite quotidienne : 5.")}</p><b>{t(`Remaining today: ${aiStatus?.ai?.remainingToday ?? monetization?.ai?.remainingToday ?? 0}`, `Restant aujourd hui : ${aiStatus?.ai?.remainingToday ?? monetization?.ai?.remainingToday ?? 0}`)}</b></Panel>}<div className="suggestions">{[t("Give me a prayer for anxiety", "Donne-moi une priere contre l anxiete"), t("Bible verse for strength", "Verset biblique pour la force"), t("Prayer for healing", "Priere pour la guerison"), t("How can I strengthen my faith?", "Comment puis-je fortifier ma foi ?")].map(x => <button onClick={() => send(x)} key={x}>{x}</button>)}</div><div className="ai-history-row"><button className="button secondary" onClick={startNewConversation}>{t("New conversation", "Nouvelle conversation")}</button>{sessions.slice(0, 5).map((item, index) => <button className={`ai-session-chip ${item.sessionId === sessionId ? "active" : ""}`.trim()} key={`${item.sessionId}-${index}`} onClick={() => loadHistory(item.sessionId)} title={item.preview}>{new Date(item.updatedAt).toLocaleDateString()} - {item.preview?.slice(0, 24) || t("Conversation", "Conversation")}</button>)}</div><Panel className="chat-panel"><div className="messages">{historyLoading && <p className="typing">{t("Loading previous conversation...", "Chargement de la conversation precedente...")}</p>}{messages.map((m, i) => <p className={`message ${m.role}`} key={i}>{m.content}</p>)}{typing && <p className="typing">{t("Writing a thoughtful response...", "Redaction d une reponse...")}</p>}</div><div className="chat-compose"><textarea value={input} onChange={e => setInput(e.target.value)} placeholder={t("Ask about Bible or prayer", "Posez une question sur la Bible ou la priere")} /><button className="button primary" onClick={() => send()}>{t("Send", "Envoyer")}</button></div></Panel>{rewardGateOpen && <div className="modal-backdrop"><section className="mood-modal ai-reward-modal"><p className="eyebrow">{t("Sponsored access", "Acces sponsorise")}</p><h2>{user.language === "fr" ? monetization?.ads?.aiGate?.titleFr || "Regardez cette courte pub pour utiliser l IA" : monetization?.ads?.aiGate?.titleEn || "Watch this short ad to use AI"}</h2><p>{user.language === "fr" ? monetization?.ads?.aiGate?.bodyFr || "Les utilisateurs gratuits peuvent debloquer une conversation IA en regardant un court message sponsorise." : monetization?.ads?.aiGate?.bodyEn || "Free users can unlock one AI conversation by watching a short sponsor message."}</p><Panel className="ai-sponsor-card"><b>ReviveSpring Premium</b><p>{t("No ads. More peace. Full access.", "Pas de pubs. Plus de paix. Acces complet.")}</p></Panel><div className="permission-actions"><button className="button ghost" onClick={() => { setRewardGateOpen(false); setQueuedMessage(null); }}>{t("Cancel", "Annuler")}</button><button className="button primary" disabled={countdown > 0} onClick={claimAdAndContinue}>{countdown > 0 ? t(`Continue in ${countdown}s`, `Continuer dans ${countdown}s`) : (user.language === "fr" ? monetization?.ads?.aiGate?.ctaFr || "Continuer vers l IA" : monetization?.ads?.aiGate?.ctaEn || "Continue to AI")}</button></div></section></div>}
    {showScriptureSearch && <ScriptureSearchModal token={token} language={user.language} onClose={() => setShowScriptureSearch(false)} />}
    {showPrayerWriter && <AiPrayerWriterModal token={token} language={user.language} onClose={() => setShowPrayerWriter(false)} />}
    {showCompanion && <AiCompanionModal token={token} language={user.language} onClose={() => setShowCompanion(false)} />}
    {showSermon && <SermonSummarizerModal token={token} language={user.language} onClose={() => setShowSermon(false)} />}
    {showDreamJournal && <DreamJournalModal token={token} language={user.language} onClose={() => setShowDreamJournal(false)} />}
    {showUpgradeNote && <div className="modal-backdrop" onClick={() => setShowUpgradeNote(false)}><section className="mood-modal" onClick={e => e.stopPropagation()}><p className="eyebrow">{t("Premium feature", "Fonction premium")}</p><h2>{t("AI Prayer Writer is Premium", "Le redacteur de prieres IA est premium")}</h2><p>{t("Upgrade on the Android app to unlock AI Prayer Writer.", "Passez premium sur l application Android pour debloquer le redacteur de prieres IA.")}</p><button className="button primary full" onClick={() => setShowUpgradeNote(false)}>{t("Got it", "Compris")}</button></section></div>}
    </>;
}

function ScriptureSearchModal({ token, language, onClose }: { token: string; language: Lang; onClose: () => void }) {
  const t = (en: string, fr: string) => tr(language, en, fr);
  const [topic, setTopic] = useState("");
  const [results, setResults] = useState<{ reference: string; verse: string; note?: string }[]>([]);
  const [closingPrayer, setClosingPrayer] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [searchedOnce, setSearchedOnce] = useState(false);
  const suggestions = ["Dealing with fear", "Forgiveness", "Waiting on God", "Financial provision", "Healing"];

  useEffect(() => {
    api<any>("/scripture-search/status", {}, token).then(data => setRemaining(data.remainingToday)).catch(() => {});
  }, [token]);

  const search = async (value?: string) => {
    const query = (value ?? topic).trim();
    if (!query || loading) return;
    if (value) setTopic(value);
    setLoading(true);
    setError(null);
    setSearchedOnce(true);
    setClosingPrayer(null);
    try {
      const data = await api<any>("/scripture-search", { method: "POST", body: JSON.stringify({ topic: query, language }) }, token);
      setResults(Array.isArray(data.results) ? data.results : []);
      setClosingPrayer(typeof data.closingPrayer === "string" && data.closingPrayer.trim() ? data.closingPrayer : null);
      setRemaining(typeof data.remainingToday === "number" ? data.remainingToday : null);
    } catch (err: any) {
      setResults([]);
      setError(err?.status === 403
        ? t("You've used all 3 free searches today. Upgrade for unlimited searches, or come back tomorrow.", "Vous avez utilise vos 3 recherches gratuites du jour. Passez premium pour des recherches illimitees, ou revenez demain.")
        : t("Couldn't complete the search. Please try again.", "Impossible de terminer la recherche. Veuillez reessayer."));
    } finally {
      setLoading(false);
    }
  };

  return <div className="modal-backdrop" onClick={onClose}>
    <section className="mood-modal scripture-search-modal" onClick={e => e.stopPropagation()}>
      <button className="modal-close" onClick={onClose} aria-label="Close">x</button>
      <p className="eyebrow">{t("Topical Scripture Search", "Recherche de versets")}</p>
      <h2>{t("Search a topic or feeling", "Recherchez un sujet ou un ressenti")}</h2>
      <input value={topic} onChange={e => setTopic(e.target.value)} placeholder={t('e.g. "dealing with anxiety"', 'ex. "gerer l anxiete"')} onKeyDown={e => { if (e.key === "Enter") search(); }} />
      <div className="scripture-suggestion-row">{suggestions.map(item => <button key={item} className="button ghost" disabled={loading} onClick={() => search(item)}>{item}</button>)}</div>
      <button className="button primary full" disabled={loading || !topic.trim()} onClick={() => search()}>{loading ? t("Searching...", "Recherche...") : t("Search Scripture", "Rechercher")}</button>
      {remaining !== null && <p className="scripture-remaining">{t(`${remaining} free search${remaining === 1 ? "" : "es"} left today`, `${remaining} recherche${remaining === 1 ? "" : "s"} gratuite${remaining === 1 ? "" : "s"} restante${remaining === 1 ? "" : "s"} aujourd'hui`)}</p>}
      {error && <p className="form-error">{error}</p>}
      {!loading && searchedOnce && !error && results.length === 0 && <p>{t("No verses found for that topic. Try rephrasing it.", "Aucun verset trouve pour ce sujet. Essayez une autre formulation.")}</p>}
      <div className="scripture-results">{results.map((item, index) => <div className="scripture-result-card" key={`${item.reference}-${index}`}><b>{item.reference}</b><p className="scripture-verse-text">"{item.verse}"</p>{item.note && <p className="scripture-note">{item.note}</p>}</div>)}</div>
      {closingPrayer && <div className="scripture-closing-prayer"><p className="scripture-closing-label">{t("A prayer with these verses", "Une priere avec ces versets")}</p><p>{closingPrayer}</p></div>}
    </section>
  </div>;
}

function AiPrayerWriterModal({ token, language, onClose }: { token: string; language: Lang; onClose: () => void }) {
  const t = (en: string, fr: string) => tr(language, en, fr);
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ prayer: string; verse?: string; verseRef?: string } | null>(null);

  const generate = async () => {
    const value = description.trim();
    if (!value || loading) return;
    setLoading(true);
    setError(null);
    try {
      const data = await api<any>("/ai-prayer-writer", { method: "POST", body: JSON.stringify({ description: value, language }) }, token);
      setResult(data);
    } catch (err: any) {
      setError(err?.status === 403
        ? t("AI Prayer Writer is a Premium feature.", "Le redacteur de prieres IA est une fonction premium.")
        : t("Couldn't write a prayer right now. Please try again.", "Impossible d ecrire une priere pour le moment. Veuillez reessayer."));
    } finally {
      setLoading(false);
    }
  };

  return <div className="modal-backdrop" onClick={onClose}>
    <section className="mood-modal prayer-writer-modal" onClick={e => e.stopPropagation()}>
      <button className="modal-close" onClick={onClose} aria-label="Close">x</button>
      <p className="eyebrow">{t("AI Prayer Writer", "Redacteur de prieres IA")}</p>
      <h2>{t("Describe what's on your heart", "Decrivez ce que vous portez")}</h2>
      <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder={t('e.g. "my son is starting a new job and I\'m anxious for him"', 'ex. "mon fils commence un nouvel emploi et je suis inquiet pour lui"')} rows={4} />
      <button className="button primary full" disabled={loading || !description.trim()} onClick={generate}>{loading ? t("Writing your prayer...", "Redaction de votre priere...") : t("Write My Prayer", "Ecrire ma priere")}</button>
      {error && <p className="form-error">{error}</p>}
      {result && <div className="prayer-writer-result">
        <p className="prayer-writer-text">{result.prayer}</p>
        {result.verse && <div className="prayer-writer-verse"><p>"{result.verse}"</p><b>{result.verseRef}</b></div>}
        <p className="prayer-writer-note">{t("Saved to your prayers — you can mark it answered later from the Journal.", "Enregistree dans vos prieres — vous pourrez la marquer comme exaucee depuis le Journal.")}</p>
      </div>}
    </section>
  </div>;
}

function AiCompanionModal({ token, language, onClose }: { token: string; language: Lang; onClose: () => void }) {
  const t = (en: string, fr: string) => tr(language, en, fr);
  const [messages, setMessages] = useState<{ role: string; content: string }[]>([]);
  const [input, setInput] = useState("");
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    api<any>("/ai-companion/history", {}, token)
      .then(data => {
        const history = Array.isArray(data.messages) ? data.messages : [];
        setMessages(history.length ? history : [{ role: "assistant", content: t("I'm here with you — your Spiritual Companion. Tell me what's on your heart today.", "Je suis avec vous — votre Compagnon spirituel. Dites-moi ce que vous portez aujourd'hui.") }]);
      })
      .catch(() => setMessages([]))
      .finally(() => setLoadingHistory(false));
  }, []);

  const send = async () => {
    const text = input.trim();
    if (!text || sending) return;
    setMessages(current => [...current, { role: "user", content: text }]);
    setInput("");
    setSending(true);
    try {
      const data = await api<any>("/ai-companion/chat", { method: "POST", body: JSON.stringify({ message: text, language }) }, token);
      setMessages(current => [...current, { role: "assistant", content: data.reply }]);
    } catch (err: any) {
      setMessages(current => [...current, { role: "assistant", content: err?.status === 403 ? t("The Spiritual Companion is a Premium feature.", "Le compagnon spirituel est une fonction premium.") : t("I couldn't respond just now. Please try again.", "Je n'ai pas pu repondre. Veuillez reessayer.") }]);
    } finally {
      setSending(false);
    }
  };

  return <div className="modal-backdrop" onClick={onClose}>
    <section className="mood-modal companion-modal" onClick={e => e.stopPropagation()}>
      <button className="modal-close" onClick={onClose} aria-label="Close">x</button>
      <p className="eyebrow">{t("Spiritual Companion", "Compagnon spirituel")}</p>
      <h2>{t("A companion that remembers your journey", "Un compagnon qui se souvient de votre parcours")}</h2>
      <div className="companion-messages">
        {loadingHistory ? <p>{t("Loading...", "Chargement...")}</p> : messages.map((m, i) => <p className={`message ${m.role}`} key={i}>{m.content}</p>)}
        {sending && <p className="typing">{t("Writing a thoughtful response...", "Redaction d'une reponse...")}</p>}
      </div>
      <div className="chat-compose"><textarea value={input} onChange={e => setInput(e.target.value)} placeholder={t("Share what's on your heart...", "Partagez ce que vous portez...")} /><button className="button primary" disabled={sending} onClick={send}>{t("Send", "Envoyer")}</button></div>
    </section>
  </div>;
}

function SermonSummarizerModal({ token, language, onClose }: { token: string; language: Lang; onClose: () => void }) {
  const t = (en: string, fr: string) => tr(language, en, fr);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ summary: string; keyPoints: string[]; plan: { day: number; title: string; action: string }[] } | null>(null);

  const summarize = async () => {
    const value = text.trim();
    if (!value || loading) return;
    setLoading(true);
    setError(null);
    try {
      const data = await api<any>("/ai-sermon-summarizer", { method: "POST", body: JSON.stringify({ text: value, language }) }, token);
      setResult(data);
    } catch (err: any) {
      setError(err?.status === 403 ? t("AI Sermon Summarizer is a Premium feature.", "Le resume de sermon IA est une fonction premium.") : t("Couldn't summarize right now. Please try again.", "Impossible de resumer pour le moment."));
    } finally {
      setLoading(false);
    }
  };

  return <div className="modal-backdrop" onClick={onClose}>
    <section className="mood-modal sermon-modal" onClick={e => e.stopPropagation()}>
      <button className="modal-close" onClick={onClose} aria-label="Close">x</button>
      <p className="eyebrow">{t("AI Sermon Summarizer", "Resume de sermon IA")}</p>
      <h2>{t("Paste your sermon notes", "Collez vos notes de sermon")}</h2>
      <textarea value={text} onChange={e => setText(e.target.value)} placeholder={t("Paste sermon notes or a rough transcript...", "Collez des notes de sermon ou une transcription...")} rows={6} />
      <button className="button primary full" disabled={loading || !text.trim()} onClick={summarize}>{loading ? t("Summarizing...", "Resume en cours...") : t("Summarize Sermon", "Resumer le sermon")}</button>
      {error && <p className="form-error">{error}</p>}
      {result && <div className="sermon-result">
        <p className="growth-section-title">{t("Summary", "Resume")}</p>
        <p>{result.summary}</p>
        {result.keyPoints?.length > 0 && <ul className="sermon-key-points">{result.keyPoints.map((point, i) => <li key={i}>{point}</li>)}</ul>}
        {result.plan?.map(day => <div className="growth-card" key={day.day}><b>{t(`Day ${day.day}`, `Jour ${day.day}`)}: {day.title}</b><p>{day.action}</p></div>)}
      </div>}
    </section>
  </div>;
}

function DreamJournalModal({ token, language, onClose }: { token: string; language: Lang; onClose: () => void }) {
  const t = (en: string, fr: string) => tr(language, en, fr);
  const [entries, setEntries] = useState<any[]>([]);
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<any[]>("/dream-journal", {}, token).then(setEntries).catch(() => setEntries([])).finally(() => setLoading(false));
  }, []);

  const submit = async () => {
    const value = description.trim();
    if (!value || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const entry = await api<any>("/dream-journal", { method: "POST", body: JSON.stringify({ description: value, language }) }, token);
      setEntries(current => [entry, ...current]);
      setDescription("");
    } catch (err: any) {
      setError(err?.status === 403 ? t("AI Dream/Vision Journal is a Premium feature.", "Le journal de reves IA est une fonction premium.") : t("Couldn't save your entry right now.", "Impossible d'enregistrer votre entree."));
    } finally {
      setSubmitting(false);
    }
  };

  return <div className="modal-backdrop" onClick={onClose}>
    <section className="mood-modal dream-journal-modal" onClick={e => e.stopPropagation()}>
      <button className="modal-close" onClick={onClose} aria-label="Close">x</button>
      <p className="eyebrow">{t("Dream & Vision Journal", "Journal de reves")}</p>
      <h2>{t("Describe your dream or vision", "Decrivez votre reve ou vision")}</h2>
      <p>{t("Reflections here are for prayerful consideration, not certain interpretation.", "Les reflexions ici sont pour une consideration priante, pas une interpretation certaine.")}</p>
      <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder={t("Describe your dream or vision...", "Decrivez votre reve ou vision...")} rows={4} />
      <button className="button primary full" disabled={submitting || !description.trim()} onClick={submit}>{submitting ? t("Reflecting...", "Reflexion en cours...") : t("Get a Reflection", "Obtenir une reflexion")}</button>
      {error && <p className="form-error">{error}</p>}
      {loading ? <p>{t("Loading...", "Chargement...")}</p> : <div className="growth-card-list">
        {entries.map(entry => <div className="growth-card" key={entry.id}>
          <b>{entry.title}</b>
          <p>{entry.content}</p>
          {entry.ai_interpretation && <div className="dream-interpretation">{entry.ai_interpretation}</div>}
        </div>)}
      </div>}
    </section>
  </div>;
}

function CustomerCareScreen({ user, token, onTicketSent }: { user: User; token: string; onTicketSent: () => Promise<void> }) {
  const t = (en: string, fr: string) => tr(user.language, en, fr);
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: "assistant", content: t(`Hi ${user.fullName.split(" ")[0] || "Friend"}, welcome to ReviveSpring Care. Tell us what you need help with and our team will follow up.`, `Bonjour ${user.fullName.split(" ")[0] || "ami"}, bienvenue au service ReviveSpring. Dites-nous ce dont vous avez besoin et notre equipe vous repondra.`) },
  ]);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [subject, setSubject] = useState(t("Customer care message", "Message au service client"));
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loadingTickets, setLoadingTickets] = useState(false);
  const [replyingTicketId, setReplyingTicketId] = useState<string | null>(null);

  const loadTickets = async () => {
    setLoadingTickets(true);
    try {
      const data = await api<any>("/support/tickets", {}, token);
      setTickets(Array.isArray(data?.tickets) ? data.tickets : []);
    } catch {
      setTickets([]);
    } finally {
      setLoadingTickets(false);
    }
  };

  useEffect(() => {
    void loadTickets();
  }, [token]);

  const sendMessage = async (event: FormEvent) => {
    event.preventDefault();
    const value = message.trim();
    if (!value || busy) return;
    setBusy(true);
    try {
      await api<SupportTicket>("/support/tickets", { method: "POST", body: JSON.stringify({ subject, message: value }) }, token);
      setMessages(prev => [...prev, { role: "user", content: value }, { role: "assistant", content: t("Message received. Customer care can now view this in the admin dashboard and reply to your account.", "Message recu. Le service client peut maintenant le voir dans le tableau admin et repondre a votre compte.") }]);
      setMessage("");
      setSent(true);
      await loadTickets();
      await onTicketSent();
    } catch (err) {
      setMessages(prev => [...prev, { role: "assistant", content: err instanceof Error ? err.message : t("We could not send this message right now.", "Nous ne pouvons pas envoyer ce message pour le moment.") }]);
    } finally {
      setBusy(false);
    }
  };

  const sendReply = async (ticket: SupportTicket) => {
    const draft = (replyDrafts[ticket.id] || "").trim();
    if (!draft || replyingTicketId === ticket.id || ticket.status === "closed") return;
    setReplyingTicketId(ticket.id);
    try {
      await api<SupportTicket>(`/support/tickets/${ticket.id}/messages`, { method: "POST", body: JSON.stringify({ message: draft }) }, token);
      setReplyDrafts(prev => ({ ...prev, [ticket.id]: "" }));
      await loadTickets();
    } catch (err) {
      setMessages(prev => [...prev, { role: "assistant", content: err instanceof Error ? err.message : t("We could not send this reply right now.", "Nous ne pouvons pas envoyer cette reponse pour le moment.") }]);
    } finally {
      setReplyingTicketId(current => current === ticket.id ? null : current);
    }
  };

  return <><PageIntro title={t("Customer Care", "Service client")} subtitle={t("A calm support space for account, prayer, billing, and app questions.", "Un espace d'aide paisible pour les questions de compte, de priere, de facturation et d'application.")} action={<span className="care-status"><i /> {t("Support desk online", "Assistance en ligne")}</span>} /><div className="care-grid"><Panel className="care-hero"><span className="care-orb"><UiIcon name="support" size={28} /></span><div><p className="eyebrow">ReviveSpring help desk</p><h2>{t("We are here to help you keep growing.", "Nous sommes la pour vous aider a continuer de grandir.")}</h2><p>{t("Drop a message below. Your account information will be attached so admins can review and reply directly.", "Laissez un message ci-dessous. Les informations de votre compte seront jointes afin que les administrateurs puissent examiner et repondre directement.")}</p></div></Panel><div className="care-quick-list"><article><b>{t("Account help", "Aide au compte")}</b><p>{t("Login, Google sign-in, profile, and language settings.", "Connexion, Google sign-in, profil et parametres de langue.")}</p></article><article><b>{t("Prayer support", "Aide a la priere")}</b><p>{t("Library, daily prayers, wellness score, and saved records.", "Bibliotheque, prieres quotidiennes, score de bien-etre et enregistrements sauvegardes.")}</p></article><article><b>{t("Billing care", "Aide a la facturation")}</b><p>{t("Premium access, plan questions, and payment follow-up.", "Acces premium, questions sur le forfait et suivi des paiements.")}</p></article></div></div><Panel className="care-chat-panel"><div className="messages care-messages">{messages.map((item, index) => <p className={`message ${item.role}`} key={`${item.role}-${index}`}>{item.content}</p>)}{sent && <p className="typing">{t(`Support ticket created for ${user.email}.`, `Ticket d'assistance cree pour ${user.email}.`)}</p>}</div><form className="chat-compose care-compose" onSubmit={sendMessage}><input value={subject} onChange={event => setSubject(event.target.value)} placeholder={t("Subject", "Sujet")} /><textarea value={message} onChange={event => setMessage(event.target.value)} placeholder={t("Write your message to customer care...", "Ecrivez votre message au service client...")} /><button className="button primary" disabled={!message.trim() || busy}>{busy ? t("Sending...", "Envoi...") : t("Send message", "Envoyer le message")}</button></form></Panel><Panel><SectionTitle title={t("Your conversations", "Vos conversations")} subtitle={t("Review your support history and continue any open ticket.", "Consultez l'historique de votre assistance et poursuivez tout ticket ouvert.")} />{loadingTickets ? <p>{t("Loading conversations...", "Chargement des conversations...")}</p> : tickets.length ? <div className="admin-list">{tickets.map(ticket => { const isClosed = ticket.status === "closed"; return <div className="admin-row support-ticket-row" key={ticket.id}><div><b>{ticket.subject}</b><small>{new Date(ticket.updatedAt || ticket.createdAt || Date.now()).toLocaleString()} / {ticket.status}</small><div className="support-thread">{ticket.messages?.map((entry, index) => <p key={`${ticket.id}-${index}`} className={entry.role === "admin" ? "admin-reply" : ""}><b>{entry.role === "admin" ? t("Care", "Assistance") : t("You", "Vous")}:</b> {entry.body}</p>)}</div>{isClosed ? <small>{t("This conversation has been closed. You can still read the full history here.", "Cette conversation est fermee. Vous pouvez toujours lire tout l'historique ici.")}</small> : <><textarea value={replyDrafts[ticket.id] || ""} onChange={event => setReplyDrafts(prev => ({ ...prev, [ticket.id]: event.target.value }))} placeholder={t("Continue this conversation...", "Continuez cette conversation...")} /><div className="admin-actions"><button onClick={() => sendReply(ticket)} disabled={replyingTicketId === ticket.id || !(replyDrafts[ticket.id] || "").trim()}>{replyingTicketId === ticket.id ? t("Sending...", "Envoi...") : t("Send reply", "Envoyer la reponse")}</button></div></>}</div></div>; })}</div> : <p>{t("No support conversations yet.", "Aucune conversation d'assistance pour le moment.")}</p>}</Panel></>;
}

function NotificationScreen({ token, notifications, refresh, language }: { token: string; notifications: AppNotification[]; refresh: () => Promise<void>; language: Lang }) {
  const t = (en: string, fr: string) => tr(language, en, fr);
  const markAll = async () => {
    await api("/notifications/read-all", { method: "POST" }, token);
    await refresh();
  };
  const markOne = async (item: AppNotification) => {
    if (item.readAt) return;
    await api(`/notifications/${item.id}/read`, { method: "PATCH" }, token);
    await refresh();
  };
  return <><PageIntro title={t("Notifications", "Notifications")} subtitle={t("Security alerts, customer-care replies, and account updates.", "Alertes de securite, reponses du service client et mises a jour du compte.")} action={<button className="button secondary" onClick={markAll}>{t("Mark all read", "Tout marquer comme lu")}</button>} /><div className="notification-list">{notifications.length ? notifications.map(item => <button className={`notification-card ${item.readAt ? "" : "unread"}`.trim()} key={item.id} onClick={() => markOne(item)}><span className="notification-mark"><UiIcon name={item.type === "support_reply" ? "support" : "notification"} size={18} /></span><div><b>{item.title}</b><p>{item.body}</p><small>{new Date(item.createdAt).toLocaleString()} {item.readAt ? t("/ read", "/ lu") : t("/ unread", "/ non lu")}</small></div></button>) : <Panel><SectionTitle title={t("No notifications yet", "Aucune notification pour le moment")} subtitle={t("Security alerts and customer care replies will appear here.", "Les alertes de securite et les reponses du service client apparaitront ici.")} /></Panel>}</div></>;
}

function ProfileScreen({ user, token, language, setLanguage, updateUser, signOut, onDeleted, openAdmin, monetization }: { user: User; token: string; language: Lang; setLanguage: (language: Lang | null) => void; updateUser: (user: User | null) => void; signOut: () => void; onDeleted: () => void; openAdmin?: () => void; monetization: MonetizationStatus | null }) {
  const [emails, setEmails] = useState(user.dailyEmailEnabled !== false);
  const [pushEnabled, setPushEnabled] = useState(user.pushNotificationsEnabled !== false);
  const [selectedLanguage, setSelectedLanguage] = useState<Lang>(language);
  const [bibleVersion, setBibleVersion] = useState<string>(user.bibleVersion || "NIV");
  const [deleteReason, setDeleteReason] = useState("");
  const [deleteFeedback, setDeleteFeedback] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [showMilestones, setShowMilestones] = useState(false);
  const t = (en: string, fr: string) => tr(selectedLanguage, en, fr);
  const navigate = useNavigate();
  useEffect(() => {
    setEmails(user.dailyEmailEnabled !== false);
    setPushEnabled(user.pushNotificationsEnabled !== false);
    setSelectedLanguage(language);
    setBibleVersion(user.bibleVersion || "NIV");
  }, [user, language]);
  const saveProfile = async (changes: Partial<Pick<User, "language" | "dailyEmailEnabled" | "pushNotificationsEnabled" | "bibleVersion">>) => {
    setSavingSettings(true);
    try {
      const data = await api<any>("/auth/me", {
        method: "PATCH",
        body: JSON.stringify({
          language: changes.language ?? selectedLanguage,
          dailyEmailEnabled: changes.dailyEmailEnabled ?? emails,
          pushNotificationsEnabled: changes.pushNotificationsEnabled ?? pushEnabled,
          bibleVersion: changes.bibleVersion ?? bibleVersion,
          timezone: user.timezone || detectTimezone(),
          reminderHour: typeof user.reminderHour === "number" ? user.reminderHour : 9,
          reminderMinute: typeof user.reminderMinute === "number" ? user.reminderMinute : 0,
        }),
      }, token);
      const nextUser = mapUser(data.user || data);
      setLanguage(nextUser.language);
      updateUser(nextUser);
      setSelectedLanguage(nextUser.language);
      setEmails(nextUser.dailyEmailEnabled !== false);
      setPushEnabled(nextUser.pushNotificationsEnabled !== false);
      setBibleVersion(nextUser.bibleVersion || "NIV");
      localStorage.setItem("rs_language", nextUser.language);
      localStorage.setItem("rs_user", JSON.stringify(nextUser));
    } finally {
      setSavingSettings(false);
    }
  };
  const deleteAccount = async () => {
    if (!deleteReason.trim() || !deleteFeedback.trim() || deleting) return;
    if (!window.confirm(t("Delete your account and all related records? This cannot be undone.", "Supprimer votre compte et toutes les donnees associees ? Cette action est irreversible."))) return;
    setDeleting(true);
    setDeleteError("");
    try {
      await api("/auth/me", { method: "DELETE", body: JSON.stringify({ reason: deleteReason.trim(), feedback: deleteFeedback.trim() }) }, token);
      onDeleted();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : t("Could not delete your account.", "Impossible de supprimer votre compte."));
    } finally {
      setDeleting(false);
    }
  };
  return <><PageIntro title={t("My Profile", "Mon profil")} subtitle={t("Personal settings, account care, and testimony.", "Parametres personnels, gestion du compte et temoignage.")} /><div className="profile-grid"><Panel><div className="profile-hero"><UserAvatar user={user} className="profile-avatar" /><div><h2>{user.fullName}</h2><p>{(user.isAdmin ? "premium" : user.plan).toUpperCase()} {t("PLAN", "FORFAIT")}</p></div></div><div className="profile-line"><span>{t("Email", "E-mail")}</span><b>{user.email}</b></div><div className="profile-line"><span>{t("Language", "Langue")}</span><select value={selectedLanguage} disabled={savingSettings} onChange={async event => { const nextLanguage = event.target.value as Lang; setSelectedLanguage(nextLanguage); await saveProfile({ language: nextLanguage }); }}><option value="en">English</option><option value="fr">Francais</option></select></div><div className="profile-line"><span>{t("Bible Version", "Version de la Bible")}</span><select value={bibleVersion} disabled={savingSettings} onChange={async event => { const nextVersion = event.target.value; setBibleVersion(nextVersion); await saveProfile({ bibleVersion: nextVersion }); }}><option value="NIV">NIV — New International Version</option><option value="KJV">KJV — King James Version</option><option value="NLT">NLT — New Living Translation</option><option value="ESV">ESV — English Standard Version</option></select></div><div className="profile-line"><span>{t("Sign-in method", "Methode de connexion")}</span><b>{(user.authProvider || "email").toUpperCase()}</b></div></Panel><Panel><h3>{t("Premium access", "Acces premium")}</h3><p>{user.isAdmin ? t("Admin accounts are automatically premium and will not see ads.", "Les comptes admin sont automatiquement premium et ne voient pas de publicites.") : user.plan === "premium" ? t("Your account is premium. Ads are removed and premium features stay unlocked.", "Votre compte est premium. Les publicites sont retirees et les fonctions premium restent debloquees.") : user.plan === "standard" ? t("Your account is Standard. Ads are removed — upgrade to Premium for unlimited AI and the full wellness library.", "Votre compte est Standard. Les publicites sont retirees — passez a Premium pour l IA illimitee et la bibliotheque bien-etre complete.") : t("Free users see app ads and must watch one short ad before each AI use. Upgrade on the Android app to remove ads.", "Les utilisateurs gratuits voient des pubs dans l application et doivent regarder une courte pub avant chaque utilisation de l IA. Passez premium sur l application Android pour retirer les pubs.")}</p>{!user.isAdmin && user.plan !== "premium" && <div className="profile-premium-note">{(monetization?.plans || []).map(plan => <p key={plan.tier}><b>{plan.tier === "premium" ? "Premium" : "Standard"}:</b> {language === "fr" ? plan.labelFr : plan.labelEn} — {t(`$${plan.firstTermPriceUsd} for the first ${plan.termMonths} months`, `${plan.firstTermPriceUsd} $ pour les premiers ${plan.termMonths} mois`)}</p>)}<p>{t("Subscriptions are currently available on the Android app.", "Les abonnements sont actuellement disponibles sur l application Android.")}</p></div>}</Panel><Panel><h3>{t("Preferences", "Preferences")}</h3><label className="switch-row"><div><b>{t("Daily prayer emails", "E-mails de priere quotidiens")}</b><p>{t("Receive a personalized prayer every day.", "Recevez chaque jour une priere personnalisee.")}</p></div><input type="checkbox" checked={emails} disabled={savingSettings} onChange={async () => { const nextValue = !emails; setEmails(nextValue); await saveProfile({ dailyEmailEnabled: nextValue }); }} /></label><label className="switch-row"><div><b>{t("Push notifications", "Notifications push")}</b><p>{t("Allow reminders and account alerts on this device.", "Autorisez les rappels et les alertes de compte sur cet appareil.")}</p></div><input type="checkbox" checked={pushEnabled} disabled={savingSettings} onChange={async () => { const nextValue = !pushEnabled; setPushEnabled(nextValue); await saveProfile({ pushNotificationsEnabled: nextValue }); }} /></label><div className="profile-actions">{openAdmin && <button className="button secondary" onClick={openAdmin}>{t("Open admin dashboard", "Ouvrir le tableau admin")}</button>}<button className="button danger" onClick={signOut}>{t("Sign out", "Se deconnecter")}</button></div></Panel><Panel><h3>{t("Privacy", "Confidentialite")}</h3><p>{t("Review ReviveSpring's Privacy Policy and Cookie Policy.", "Consultez la politique de confidentialite et la politique relative aux cookies de ReviveSpring.")}</p><LegalLinks language={language} /></Panel><Panel><h3>{t("Delete account", "Supprimer le compte")}</h3><p>{t("Before you leave, please tell us why. This feedback is required so the team can keep improving ReviveSpring.", "Avant de partir, dites-nous pourquoi. Ce retour est necessaire pour aider l'equipe a ameliorer ReviveSpring.")}</p><input value={deleteReason} onChange={event => setDeleteReason(event.target.value)} placeholder={t("Short reason for leaving", "Raison breve du depart")} /><textarea value={deleteFeedback} onChange={event => setDeleteFeedback(event.target.value)} placeholder={t("What made you decide to delete your account?", "Qu'est-ce qui vous a pousse a supprimer votre compte ?")} rows={5} />{deleteError && <p className="form-error">{deleteError}</p>}<button className="button danger full" disabled={!deleteReason.trim() || !deleteFeedback.trim() || deleting} onClick={deleteAccount}>{deleting ? t("Deleting account...", "Suppression du compte...") : t("Delete my account", "Supprimer mon compte")}</button></Panel><Panel><h3>{t("Faith Milestones", "Etapes de foi")}</h3><p>{t("View the badges you've earned on your journey.", "Consultez les badges que vous avez obtenus sur votre parcours.")}</p><button className="button secondary full" onClick={() => setShowMilestones(true)}>{t("View My Badges", "Voir mes badges")}</button></Panel></div>{showMilestones && <MilestonesModal token={token} language={language} onClose={() => setShowMilestones(false)} />}</>;
}

function MilestonesModal({ token, language, onClose }: { token: string; language: Lang; onClose: () => void }) {
  const t = (en: string, fr: string) => tr(language, en, fr);
  const [milestones, setMilestones] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<any>("/milestones/check", { method: "POST", body: JSON.stringify({}) }, token)
      .then(data => {
        setMilestones(Array.isArray(data.milestones) ? data.milestones : []);
        const newlyAwarded: string[] = Array.isArray(data.newlyAwarded) ? data.newlyAwarded : [];
        if (newlyAwarded.length) {
          const titles = (data.milestones || []).filter((m: any) => newlyAwarded.includes(m.key)).map((m: any) => m.titleEn).join(", ");
          if (titles) window.setTimeout(() => window.alert(`🎉 ${t("New badge earned", "Nouveau badge obtenu")}: ${titles}`), 300);
        }
      })
      .catch(() => setMilestones([]))
      .finally(() => setLoading(false));
  }, []);

  return <div className="modal-backdrop" onClick={onClose}>
    <section className="mood-modal growth-modal milestones-modal" onClick={e => e.stopPropagation()}>
      <button className="modal-close" onClick={onClose} aria-label="Close">x</button>
      <p className="eyebrow">{t("Faith Milestones", "Etapes de foi")}</p>
      <h2>{t("Your Badges", "Vos badges")}</h2>
      {loading ? <p>{t("Loading...", "Chargement...")}</p> : <div className="badge-grid">
        {milestones.map(m => <div className={`badge-card ${m.achieved ? "achieved" : ""}`.trim()} key={m.id}>
          <span className="badge-icon">{m.achieved ? "🏅" : "🔒"}</span>
          <b>{m.titleEn}</b>
          <p>{m.descriptionEn}</p>
          {!m.achieved && <div className="growth-progress-bar small"><i style={{ width: `${Math.min(1, m.progress) * 100}%` }} /></div>}
        </div>)}
      </div>}
    </section>
  </div>;
}

const ADMIN_SECTIONS = [
  ["overview", "Overview"],
  ["users", "Users"],
  ["content", "Prayer Library"],
  ["wellness", "Wellness"],
  ["salvation", "Salvation"],
  ["analytics", "Analytics"],
  ["subscriptions", "Subscriptions"],
  ["communication", "Notifications"],
  ["care", "Customer Care"],
  ["settings", "App Settings"],
  ["ai", "AI Support"],
  ["store", "Store Listing"],
] as const;

function formatAdminDate(value?: string | null) {
  if (!value) return "No date";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "No date" : date.toLocaleDateString();
}

function AdminControlCenter({ token }: { token: string }) {
  const [section, setSection] = useState("overview");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<any>({});
  const [users, setUsers] = useState<any[]>([]);
  const [library, setLibrary] = useState<any[]>([]);
  const [mental, setMental] = useState<any[]>([]);
  const [salvation, setSalvation] = useState<any[]>([]);
  const [settings, setSettings] = useState<any[]>([]);
  const [conversations, setConversations] = useState<any[]>([]);
  const [supportTickets, setSupportTickets] = useState<SupportTicket[]>([]);
  const [supportReplies, setSupportReplies] = useState<Record<string, string>>({});
  const [deletionFeedback, setDeletionFeedback] = useState<DeletionFeedback[]>([]);
  const [knowledge, setKnowledge] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [prayerForm, setPrayerForm] = useState({ category: "morning", titleEn: "", titleFr: "", verseEn: "", verseFr: "", verseRef: "", prayerEn: "", prayerFr: "", actionEn: "", actionFr: "", isPremium: false, isVisible: true });
  const [mentalForm, setMentalForm] = useState({ category: "anxiety", titleEn: "", titleFr: "", contentEn: "", contentFr: "", audioUrl: "", isPremium: true, isVisible: true });
  const [goalForm, setGoalForm] = useState({ titleEn: "", titleFr: "", kind: "scripture", contentEn: "", contentFr: "", durationSeconds: 10, isActive: true });
  const [verseForm, setVerseForm] = useState({ verseEn: "", verseFr: "", reference: "", activeOn: "", isActive: true });
  const [salvationForm, setSalvationForm] = useState({ key: "intro", contentEn: "", contentFr: "" });
  const [settingForm, setSettingForm] = useState({ key: "safety_disclaimer_en", value: "" });
  const [knowledgeForm, setKnowledgeForm] = useState({ category: "general", question: "", answerEn: "", answerFr: "", isActive: true });
  const [broadcastForm, setBroadcastForm] = useState({ prayer: "", verse: "", ref: "", action: "" });

  const loadAdmin = async () => {
    setLoading(true);
    setNotice("");
    try {
      const results = await Promise.allSettled([
        api<any>("/admin/stats", {}, token),
        api<any>(`/admin/users?limit=25${search ? `&search=${encodeURIComponent(search)}` : ""}`, {}, token),
        api<any[]>("/admin/library", {}, token),
        api<any[]>("/admin/mental-health", {}, token),
        api<any[]>("/admin/salvation", {}, token),
        api<any[]>("/admin/settings", {}, token),
        api<any>("/admin/ai/conversations?limit=10", {}, token),
        api<any[]>("/admin/ai/knowledge", {}, token),
        api<any>("/admin/support/tickets?limit=50", {}, token),
        api<any>("/admin/deletion-feedback?limit=50", {}, token),
      ]);
      const [statsResult, userResult, libraryResult, mentalResult, salvationResult, settingsResult, convoResult, knowledgeResult, supportResult, deletionResult] = results;

      if (statsResult.status === "fulfilled") setStats(statsResult.value);
      if (userResult.status === "fulfilled") setUsers(userResult.value.users || []);
      if (libraryResult.status === "fulfilled") setLibrary(libraryResult.value || []);
      if (mentalResult.status === "fulfilled") setMental(mentalResult.value || []);
      if (salvationResult.status === "fulfilled") setSalvation(salvationResult.value || []);
      if (settingsResult.status === "fulfilled") setSettings(settingsResult.value || []);
      if (convoResult.status === "fulfilled") setConversations(convoResult.value.conversations || []);
      if (knowledgeResult.status === "fulfilled") setKnowledge(knowledgeResult.value || []);
      if (supportResult.status === "fulfilled") setSupportTickets(supportResult.value.tickets || []);
      if (deletionResult.status === "fulfilled") setDeletionFeedback(deletionResult.value.feedback || []);

      const rejected = results.filter((result) => result.status === "rejected");
      if (rejected.length) {
        const firstError = rejected[0] as PromiseRejectedResult;
        setNotice(firstError.reason instanceof Error ? firstError.reason.message : "Some admin data could not be loaded.");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadAdmin(); }, [token]);

  const run = async (message: string, task: () => Promise<unknown>) => {
    setNotice("");
    try {
      await task();
      setNotice(message);
      await loadAdmin();
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Admin action failed.");
    }
  };
  const saveSetting = (key: string, value: string) => run("Setting saved.", () => api(`/admin/settings/${encodeURIComponent(key)}`, { method: "PATCH", body: JSON.stringify({ value }) }, token));
  const updateUser = (userId: string, path: string, body: Record<string, unknown>, message: string) => run(message, () => api(`/admin/users/${userId}${path}`, { method: "PATCH", body: JSON.stringify(body) }, token));
  const deleteUser = (userId: string) => window.confirm("Delete this user and all related records?") && run("User deleted.", () => api(`/admin/users/${userId}`, { method: "DELETE" }, token));
  const sendVerificationEmail = (userId: string) => run("Verification email sent.", () => api(`/admin/users/${userId}/verify`, { method: "PATCH", body: JSON.stringify({}) }, token));
  const changeUserRole = (user: any) => {
    const nextRole = user.role === "admin" ? "user" : "admin";
    const confirmCode = nextRole === "admin" ? window.prompt("Enter the admin confirmation code to grant admin access.") || "" : "";
    return updateUser(user.id, "/role", { role: nextRole, confirmCode }, user.role === "admin" ? "Admin access removed." : "Admin access granted.");
  };
  const replyToTicket = (ticket: SupportTicket) => {
    const message = (supportReplies[ticket.id] || "").trim();
    if (!message) return;
    run("Customer care reply sent.", () => api(`/admin/support/tickets/${ticket.id}/reply`, { method: "POST", body: JSON.stringify({ message }) }, token)).then(() => setSupportReplies(prev => ({ ...prev, [ticket.id]: "" })));
  };
  const closeTicket = (ticket: SupportTicket) => {
    if (ticket.status === "closed") return;
    run("Conversation ended.", () => api(`/admin/support/tickets/${ticket.id}/close`, { method: "POST" }, token));
  };

  const settingsMap = Object.fromEntries(settings.map((item) => [item.key, item.value]));
  const salvationUsers = users.filter((user) => user.salvationPrayedAt);
  const activePlanUsers = users.filter((user) => user.subscriptionStatus === "premium");

  return <div className="admin-control">
    <PageIntro title="Admin Management" subtitle="Full ReviveSpring backend control without touching code." action={<button className="button secondary" onClick={loadAdmin}>{loading ? "Refreshing..." : "Refresh"}</button>} />
    <div className="metric-grid admin admin-metrics">
      <Stat value={`${stats.totalUsers ?? "--"}`} label="Users" />
      <Stat value={`${stats.dailyActiveUsers ?? "--"}`} label="Daily active" />
      <Stat value={`${stats.premiumUsers ?? "--"}`} label="Premium" />
      <Stat value={`${stats.standardUsers ?? "--"}`} label="Standard" />
      <Stat value={`${stats.conversionRate ?? 0}%`} label="Conversion" />
      <Stat value={`${stats.salvationUsers ?? "--"}`} label="Salvation" />
      <Stat value={`${stats.totalPrayers ?? "--"}`} label="Prayers" />
      <Stat value={`${stats.totalJournal ?? "--"}`} label="Journal" />
      <Stat value={`${stats.disabledUsers ?? "--"}`} label="Disabled" />
    </div>
    {notice && <p className="admin-notice">{notice}</p>}
    <div className="admin-tabs">{ADMIN_SECTIONS.map(([id, label]) => <button key={id} className={section === id ? "active" : ""} onClick={() => setSection(id)}>{label}</button>)}</div>

    {section === "overview" && <div className="admin-section-grid">
      <AdminModule title="Live database" body="Users, prayers, journal entries, daily goals, wellness content, salvation content, and AI records are connected to backend tables." items={["Admin-only access", "Live refresh", "Database-backed changes"]} />
      <AdminModule title="Popular moods" body="Mood and prayer usage from real prayer records." items={(stats.topMoods || []).map((item: any) => `${item.mood}: ${item.count}`)} />
      <Panel><SectionTitle title="Recent users" subtitle="Newest registered accounts." /><AdminUserList users={stats.recentUsers || users.slice(0, 5)} /></Panel>
      <AdminModule title="Revenue status" body="Subscriptions are manageable from user plans. Stripe and RevenueCat reporting can be stored in settings until payment webhooks are added." items={[`Premium users: ${stats.premiumUsers ?? 0}`, `Standard users: ${stats.standardUsers ?? 0}`, `Free users: ${stats.freeUsers ?? 0}`, `Conversion: ${stats.conversionRate ?? 0}%`]} />
    </div>}

    {section === "users" && <div className="main-column">
      <Panel><SectionTitle title="User management" subtitle="Send verification emails, disable access, delete users, or change subscriptions." /><div className="admin-search"><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name or email" /><button className="button secondary" onClick={loadAdmin}>Search</button></div><AdminUserList users={users} actions={(user) => <><button onClick={() => sendVerificationEmail(user.id)} disabled={user.isEmailVerified}>Send verify email</button><button onClick={() => updateUser(user.id, "/disable", { disabled: !user.isDisabled }, user.isDisabled ? "User enabled." : "User disabled.")}>{user.isDisabled ? "Enable" : "Disable"}</button><select value={user.subscriptionStatus || "free"} onChange={e => updateUser(user.id, "/plan", { plan: e.target.value }, "Plan updated.")}><option value="free">Free</option><option value="standard">Standard</option><option value="premium">Premium</option></select><button onClick={() => changeUserRole(user)}>{user.role === "admin" ? "Remove admin" : "Make admin"}</button><button className="danger" onClick={() => deleteUser(user.id)}>Delete</button></>} /></Panel>
      <Panel><SectionTitle title="Prayer of Salvation records" subtitle="Users who prayed and saved the date." /><AdminUserList users={salvationUsers} empty="No salvation prayer records yet." /></Panel>
      <Panel><SectionTitle title="Account deletion feedback" subtitle="Required feedback left by users before deleting their accounts." /><div className="admin-list">{deletionFeedback.length ? deletionFeedback.map(item => <div className="admin-row" key={item.id}><div><b>{item.reason}</b><p>{item.feedback}</p><small>{item.user_full_name || "Former user"} / {item.user_email} / {new Date(item.created_at).toLocaleString()}</small></div></div>) : <p>No account deletion feedback yet.</p>}</div></Panel>
    </div>}

    {section === "content" && <div className="admin-section-grid">
      <Panel><SectionTitle title="Add prayer" subtitle="English and French library content. A unique prayer ID is generated automatically when saved." /><AdminInput label="Category" value={prayerForm.category} onChange={value => setPrayerForm({ ...prayerForm, category: value })} /><AdminInput label="Title EN" value={prayerForm.titleEn} onChange={value => setPrayerForm({ ...prayerForm, titleEn: value })} /><AdminInput label="Title FR" value={prayerForm.titleFr} onChange={value => setPrayerForm({ ...prayerForm, titleFr: value })} /><AdminText label="Prayer EN" value={prayerForm.prayerEn} onChange={value => setPrayerForm({ ...prayerForm, prayerEn: value })} /><AdminText label="Prayer FR" value={prayerForm.prayerFr} onChange={value => setPrayerForm({ ...prayerForm, prayerFr: value })} /><AdminInput label="Verse reference" value={prayerForm.verseRef} onChange={value => setPrayerForm({ ...prayerForm, verseRef: value })} /><AdminInput label="Action step EN" value={prayerForm.actionEn} onChange={value => setPrayerForm({ ...prayerForm, actionEn: value })} /><Toggle label="Premium content" checked={prayerForm.isPremium} onChange={value => setPrayerForm({ ...prayerForm, isPremium: value })} /><button className="button primary full" disabled={!prayerForm.titleEn || !prayerForm.prayerEn} onClick={() => run("Prayer added.", () => api("/admin/library", { method: "POST", body: JSON.stringify(prayerForm) }, token))}>Add prayer</button></Panel>
      <Panel><SectionTitle title="Prayer library" subtitle="Edit visibility or remove records." /><AdminContentList items={library} onToggle={(item) => run("Prayer visibility updated.", () => api(`/admin/library/${item.id}`, { method: "PATCH", body: JSON.stringify({ isVisible: !item.isVisible }) }, token))} onDelete={(item) => run("Prayer deleted.", () => api(`/admin/library/${item.id}`, { method: "DELETE" }, token))} /></Panel>
      <Panel><SectionTitle title="Daily verse card" subtitle="Update the home screen verse rotation." /><AdminText label="Verse EN" value={verseForm.verseEn} onChange={value => setVerseForm({ ...verseForm, verseEn: value })} /><AdminText label="Verse FR" value={verseForm.verseFr} onChange={value => setVerseForm({ ...verseForm, verseFr: value })} /><AdminInput label="Reference" value={verseForm.reference} onChange={value => setVerseForm({ ...verseForm, reference: value })} /><AdminInput label="Active date YYYY-MM-DD" value={verseForm.activeOn} onChange={value => setVerseForm({ ...verseForm, activeOn: value })} /><button className="button primary full" disabled={!verseForm.verseEn || !verseForm.reference} onClick={() => run("Daily verse added.", () => api("/admin/verse", { method: "POST", body: JSON.stringify({ ...verseForm, activeOn: verseForm.activeOn || null }) }, token))}>Add verse</button></Panel>
    </div>}

    {section === "wellness" && <div className="admin-section-grid">
      <Panel><SectionTitle title="Premium wellness content" subtitle="Anxiety, sleep, grief, identity, prompts, and audio." /><AdminInput label="Category" value={mentalForm.category} onChange={value => setMentalForm({ ...mentalForm, category: value })} /><AdminInput label="Title EN" value={mentalForm.titleEn} onChange={value => setMentalForm({ ...mentalForm, titleEn: value })} /><AdminInput label="Title FR" value={mentalForm.titleFr} onChange={value => setMentalForm({ ...mentalForm, titleFr: value })} /><AdminText label="Content EN" value={mentalForm.contentEn} onChange={value => setMentalForm({ ...mentalForm, contentEn: value })} /><AdminText label="Content FR" value={mentalForm.contentFr} onChange={value => setMentalForm({ ...mentalForm, contentFr: value })} /><AdminInput label="Audio URL" value={mentalForm.audioUrl} onChange={value => setMentalForm({ ...mentalForm, audioUrl: value })} /><Toggle label="Visible to users" checked={mentalForm.isVisible} onChange={value => setMentalForm({ ...mentalForm, isVisible: value })} /><Toggle label="Premium" checked={mentalForm.isPremium} onChange={value => setMentalForm({ ...mentalForm, isPremium: value })} /><button className="button primary full" disabled={!mentalForm.titleEn || !mentalForm.contentEn} onClick={() => run("Wellness content added.", () => api("/admin/mental-health", { method: "POST", body: JSON.stringify(mentalForm) }, token))}>Add wellness item</button></Panel>
      <Panel><SectionTitle title="Wellness library" subtitle="Control previews and visibility." /><AdminContentList items={mental} onToggle={(item) => run("Wellness visibility updated.", () => api(`/admin/mental-health/${item.id}`, { method: "PATCH", body: JSON.stringify({ isVisible: !item.isVisible }) }, token))} onDelete={(item) => run("Wellness content deleted.", () => api(`/admin/mental-health/${item.id}`, { method: "DELETE" }, token))} /></Panel>
      <Panel><SectionTitle title="Daily goals" subtitle="Organize assigned daily user tasks." /><AdminInput label="Goal title EN" value={goalForm.titleEn} onChange={value => setGoalForm({ ...goalForm, titleEn: value })} /><AdminInput label="Goal title FR" value={goalForm.titleFr} onChange={value => setGoalForm({ ...goalForm, titleFr: value })} /><AdminInput label="Kind" value={goalForm.kind} onChange={value => setGoalForm({ ...goalForm, kind: value })} /><AdminText label="Content EN" value={goalForm.contentEn} onChange={value => setGoalForm({ ...goalForm, contentEn: value })} /><AdminInput label="Duration seconds" value={`${goalForm.durationSeconds}`} onChange={value => setGoalForm({ ...goalForm, durationSeconds: Number(value) || 10 })} /><button className="button primary full" disabled={!goalForm.titleEn} onClick={() => run("Daily goal template added.", () => api("/admin/goals", { method: "POST", body: JSON.stringify(goalForm) }, token))}>Add daily goal</button></Panel>
    </div>}

    {section === "salvation" && <div className="admin-section-grid">
      <Panel><SectionTitle title="Prayer of Salvation" subtitle="Edit free salvation content." /><AdminInput label="Content key" value={salvationForm.key} onChange={value => setSalvationForm({ ...salvationForm, key: value })} /><AdminText label="Content EN" value={salvationForm.contentEn} onChange={value => setSalvationForm({ ...salvationForm, contentEn: value })} /><AdminText label="Content FR" value={salvationForm.contentFr} onChange={value => setSalvationForm({ ...salvationForm, contentFr: value })} /><button className="button primary full" disabled={!salvationForm.key || !salvationForm.contentEn} onClick={() => run("Salvation content saved.", () => api(`/admin/salvation/${encodeURIComponent(salvationForm.key)}`, { method: "PATCH", body: JSON.stringify({ contentEn: salvationForm.contentEn, contentFr: salvationForm.contentFr }) }, token))}>Save salvation content</button></Panel>
      <Panel><SectionTitle title="Current salvation content" subtitle="Intro, prayer, verses, and guide steps." /><AdminContentList items={salvation.map(item => ({ ...item, titleEn: item.key, contentEn: item.contentEn, isVisible: true }))} /></Panel>
      <Panel><SectionTitle title="Saved prayer dates" subtitle="Users who prayed the Prayer of Salvation." /><AdminUserList users={salvationUsers} empty="No salvation records yet." /></Panel>
    </div>}

    {section === "analytics" && <div className="admin-section-grid">
      <AdminModule title="Key statistics" body="Live platform totals." items={[`Registered users: ${stats.totalUsers ?? 0}`, `Daily active users: ${stats.dailyActiveUsers ?? 0}`, `Answered prayers: ${stats.answeredPrayers ?? "Demo"}`, `Conversion rate: ${stats.conversionRate ?? 0}%`]} />
      <AdminModule title="Most used moods" body="From completed prayer records." items={(stats.topMoods || []).map((item: any) => `${item.mood}: ${item.count}`)} />
      <AdminModule title="Feature popularity" body="Tracked from backend records." items={[`Prayers: ${stats.totalPrayers ?? 0}`, `Journal entries: ${stats.totalJournal ?? 0}`, `Daily goals: ${stats.totalGoals ?? 0}`, `Salvation prayers: ${stats.salvationUsers ?? 0}`]} />
    </div>}

    {section === "subscriptions" && <div className="admin-section-grid">
      <Panel><SectionTitle title="Subscription management" subtitle="Change a user's plan manually." /><AdminUserList users={users} actions={(user) => <select value={user.subscriptionStatus || "free"} onChange={e => updateUser(user.id, "/plan", { plan: e.target.value }, "Plan updated.")}><option value="free">Free</option><option value="standard">Standard</option><option value="premium">Premium</option></select>} /></Panel>
      <AdminModule title="Revenue reports" body="Use settings to store Stripe and RevenueCat links or report notes until payment webhooks are connected." items={[`Stripe: ${settingsMap.stripe_dashboard_url || "Not set"}`, `RevenueCat: ${settingsMap.revenuecat_dashboard_url || "Not set"}`, `Monthly note: ${settingsMap.monthly_revenue_note || "Not set"}`]} />
      <Panel><SectionTitle title="Payment links and notes" subtitle="Keep non-technical references in the dashboard." /><QuickSettings keys={["stripe_dashboard_url", "revenuecat_dashboard_url", "monthly_revenue_note", "yearly_revenue_note", "subscription_currency", "subscription_first_term_months", "subscription_first_term_discount_percent", "subscription_standard_price_usd", "subscription_premium_price_usd", "subscription_google_play_standard_product_id", "subscription_google_play_premium_product_id", "ads_enabled", "ads_banner_enabled", "ai_ad_unlock_enabled", "ai_ad_daily_limit", "ad_banner_title_en", "ad_banner_title_fr", "ad_banner_body_en", "ad_banner_body_fr", "ad_banner_cta_en", "ad_banner_cta_fr", "ai_ad_title_en", "ai_ad_title_fr", "ai_ad_body_en", "ai_ad_body_fr", "ai_ad_cta_en", "ai_ad_cta_fr"]} settings={settingsMap} onSave={saveSetting} /></Panel>
    </div>}

    {section === "communication" && <div className="admin-section-grid">
      <Panel><SectionTitle title="Broadcast message" subtitle="Send a prayer email to verified opted-in users." /><AdminText label="Prayer message" value={broadcastForm.prayer} onChange={value => setBroadcastForm({ ...broadcastForm, prayer: value })} /><AdminInput label="Verse" value={broadcastForm.verse} onChange={value => setBroadcastForm({ ...broadcastForm, verse: value })} /><AdminInput label="Reference" value={broadcastForm.ref} onChange={value => setBroadcastForm({ ...broadcastForm, ref: value })} /><AdminInput label="Action step" value={broadcastForm.action} onChange={value => setBroadcastForm({ ...broadcastForm, action: value })} /><button className="button primary full" onClick={() => run("Broadcast sent.", () => api("/admin/email/broadcast", { method: "POST", body: JSON.stringify({ prayer: { mood: "announcement", prayer: broadcastForm.prayer, verse: broadcastForm.verse, ref: broadcastForm.ref, action: broadcastForm.action } }) }, token))}>Send broadcast</button><button className="button secondary full" onClick={() => run("Test email sent.", () => api("/admin/email/test", { method: "POST" }, token))}>Send test email</button></Panel>
      <Panel><SectionTitle title="Reminder messages" subtitle="Edit default prayer reminder copy." /><QuickSettings keys={["daily_reminder_en", "daily_reminder_fr", "weekly_reminder_en", "weekly_reminder_fr", "notification_event_message"]} settings={settingsMap} onSave={saveSetting} /></Panel>
      <AdminModule title="Push notifications" body="Message copy and schedules can be managed here. Actual phone push delivery requires device-token storage and FCM/APNs credentials on the backend." items={["Daily reminder copy", "Weekly reminder copy", "One-time announcement copy"]} />
    </div>}

    {section === "care" && <div className="main-column">
      <Panel><SectionTitle title="Customer care tickets" subtitle="View users, their account information, problems, and admin replies." /><div className="admin-list">{supportTickets.length ? supportTickets.map(ticket => { const last = ticket.messages?.[ticket.messages.length - 1]; const isClosed = ticket.status === "closed"; return <div className="admin-row support-ticket-row" key={ticket.id}><div><b>{ticket.subject}</b><p>{last?.body || "No message"}</p><small>{ticket.user?.fullName || "Friend"} / {ticket.user?.email || "No email"} / {ticket.user?.subscriptionStatus || "free"} / {ticket.status}</small><div className="support-thread">{ticket.messages?.map((message, index) => <p key={`${ticket.id}-${index}`} className={message.role === "admin" ? "admin-reply" : ""}><b>{message.role === "admin" ? "Admin" : "User"}:</b> {message.body}</p>)}</div><textarea value={supportReplies[ticket.id] || ""} onChange={event => setSupportReplies(prev => ({ ...prev, [ticket.id]: event.target.value }))} placeholder={isClosed ? "This conversation has been closed." : "Reply to this customer..."} disabled={isClosed} />{isClosed && <small>This conversation is closed. The customer can still read the history, but cannot send new messages in this chat.</small>}</div><div className="admin-actions"><button onClick={() => replyToTicket(ticket)} disabled={isClosed || !(supportReplies[ticket.id] || "").trim()}>Reply</button><button className="button secondary" onClick={() => closeTicket(ticket)} disabled={isClosed}>{isClosed ? "Closed" : "End conversation"}</button></div></div>; }) : <p>No customer care tickets yet.</p>}</div></Panel>
    </div>}

    {section === "settings" && <div className="admin-section-grid">
      <Panel><SectionTitle title="App settings" subtitle="Safety, language defaults, welcome page, and feature visibility." /><AdminInput label="Setting key" value={settingForm.key} onChange={value => setSettingForm({ ...settingForm, key: value })} /><AdminText label="Value" value={settingForm.value} onChange={value => setSettingForm({ ...settingForm, value })} /><button className="button primary full" disabled={!settingForm.key} onClick={() => saveSetting(settingForm.key, settingForm.value)}>Save setting</button></Panel>
      <Panel><SectionTitle title="Quick settings" subtitle="Common app customization values." /><QuickSettings keys={["default_language", "safety_disclaimer_en", "safety_disclaimer_fr", "logged_out_welcome_en", "logged_out_welcome_fr", "feature_wellness_visible", "feature_salvation_visible"]} settings={settingsMap} onSave={saveSetting} /></Panel>
      <Panel><SectionTitle title="All settings" subtitle="Stored key-value configuration." /><div className="admin-list">{settings.map(item => <div className="admin-row" key={item.key}><b>{item.key}</b><p>{item.value}</p></div>)}</div></Panel>
    </div>}

    {section === "ai" && <div className="admin-section-grid">
      <Panel><SectionTitle title="AI knowledge base" subtitle="Update FAQs and support answers used by the agent." /><AdminInput label="Category" value={knowledgeForm.category} onChange={value => setKnowledgeForm({ ...knowledgeForm, category: value })} /><AdminText label="Question" value={knowledgeForm.question} onChange={value => setKnowledgeForm({ ...knowledgeForm, question: value })} /><AdminText label="Answer EN" value={knowledgeForm.answerEn} onChange={value => setKnowledgeForm({ ...knowledgeForm, answerEn: value })} /><AdminText label="Answer FR" value={knowledgeForm.answerFr} onChange={value => setKnowledgeForm({ ...knowledgeForm, answerFr: value })} /><Toggle label="Active" checked={knowledgeForm.isActive} onChange={value => setKnowledgeForm({ ...knowledgeForm, isActive: value })} /><button className="button primary full" disabled={!knowledgeForm.question || !knowledgeForm.answerEn} onClick={() => run("Knowledge base item added.", () => api("/admin/ai/knowledge", { method: "POST", body: JSON.stringify(knowledgeForm) }, token))}>Add knowledge</button></Panel>
      <Panel><SectionTitle title="Support conversations" subtitle="Recent ReviveSpring AI support messages." /><div className="admin-list">{conversations.map(item => <div className="admin-row" key={item.id}><b>{item.userEmail || item.sessionId}</b><p>{Array.isArray(item.messages) && item.messages.length ? item.messages[item.messages.length - 1].content : "No messages"}</p><small>{new Date(item.updatedAt).toLocaleString()}</small></div>)}</div></Panel>
      <Panel><SectionTitle title="Knowledge records" subtitle="Current agent training notes." /><AdminContentList items={knowledge.map(item => ({ ...item, titleEn: item.question, contentEn: item.answerEn, isVisible: item.isActive }))} onToggle={(item) => run("Knowledge status updated.", () => api(`/admin/ai/knowledge/${item.id}`, { method: "PATCH", body: JSON.stringify({ isActive: !item.isActive }) }, token))} onDelete={(item) => run("Knowledge deleted.", () => api(`/admin/ai/knowledge/${item.id}`, { method: "DELETE" }, token))} /></Panel>
    </div>}

    {section === "store" && <div className="admin-section-grid">
      <Panel><SectionTitle title="App Store and Google Play" subtitle="Edit descriptions and keywords in English and French." /><QuickSettings keys={["app_store_description_en", "app_store_description_fr", "play_store_description_en", "play_store_description_fr", "store_keywords_en", "store_keywords_fr", "seo_title", "seo_description"]} settings={settingsMap} onSave={saveSetting} /></Panel>
      <AdminModule title="Listing checklist" body="These values are saved in the backend for your publishing workflow." items={["English descriptions", "French descriptions", "Keywords", "SEO title and description"]} />
    </div>}
  </div>;
}

function AdminModule({ title, body, items }: { title: string; body: string; items: string[] }) {
  return <Panel><SectionTitle title={title} subtitle={body} /><div className="admin-list">{items.length ? items.map(item => <p className="admin-check" key={item}>{item}</p>) : <p>No records yet.</p>}</div></Panel>;
}

function AdminInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="field admin-field"><span>{label}</span><input value={value} onChange={e => onChange(e.target.value)} /></label>;
}

function AdminText({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="field admin-field"><span>{label}</span><textarea value={value} onChange={e => onChange(e.target.value)} /></label>;
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return <label className="switch-row admin-toggle"><b>{label}</b><input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} /></label>;
}

function AdminUserList({ users, actions, empty = "No users found." }: { users: any[]; actions?: (user: any) => React.ReactNode; empty?: string }) {
  if (!users.length) return <p>{empty}</p>;
  return <div className="admin-list">{users.map(user => <div className="admin-row user" key={user.id}><div className="admin-user-summary">{user.profileImageUrl || user.profile_image_url ? <img className="admin-user-image" src={user.profileImageUrl || user.profile_image_url} alt={user.fullName || user.email} /> : <span className="admin-user-fallback">{initials(user.fullName || user.email)}</span>}<div><b>{user.fullName || "Friend"}</b><p>{user.email}</p><small>{user.language || "en"} / {formatAdminDate(user.createdAt)} / {(user.authProvider || "email")} / {user.isEmailVerified ? "verified" : "unverified"}{user.salvationPrayedAt ? ` / salvation ${formatAdminDate(user.salvationPrayedAt)}` : ""}</small></div></div><span className="admin-pill">{user.subscriptionStatus || "free"}</span>{actions && <div className="admin-actions">{actions(user)}</div>}</div>)}</div>;
}

function AdminContentList({ items, onToggle, onDelete }: { items: any[]; onToggle?: (item: any) => void; onDelete?: (item: any) => void }) {
  if (!items.length) return <p>No content records yet.</p>;
  return <div className="admin-list">{items.slice(0, 12).map(item => <div className="admin-row" key={item.id || item.key}><div><b>{item.titleEn || item.key || item.question}</b><p>{item.contentEn || item.prayerEn || item.answerEn || item.verseEn}</p><small>{item.category || item.verseRef || item.reference || "general"} / {item.isPremium ? "premium" : "free"} / {item.isVisible === false ? "hidden" : "visible"}</small></div><div className="admin-actions">{onToggle && <button onClick={() => onToggle(item)}>{item.isVisible === false || item.isActive === false ? "Show" : "Hide"}</button>}{onDelete && <button className="danger" onClick={() => onDelete(item)}>Delete</button>}</div></div>)}</div>;
}

function QuickSettings({ keys, settings, onSave }: { keys: string[]; settings: Record<string, string>; onSave: (key: string, value: string) => void }) {
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  return <div className="admin-list">{keys.map(key => {
    const value = drafts[key] ?? settings[key] ?? "";
    return <div className="admin-row setting" key={key}><label className="field"><span>{key}</span><textarea value={value} onChange={e => setDrafts({ ...drafts, [key]: e.target.value })} /></label><button className="button secondary" onClick={() => onSave(key, value)}>Save</button></div>;
  })}</div>;
}

function AdminScreen({ token, goals, entries }: { token:string; goals: Goal[]; entries: JournalEntry[] }) { const[goalTitle,setGoalTitle]=useState("");const[goalContent,setGoalContent]=useState("");const[prayerTitle,setPrayerTitle]=useState("");const[prayerText,setPrayerText]=useState("");const[verse,setVerse]=useState("");const[reference,setReference]=useState("");const[notice,setNotice]=useState("");const[stats,setStats]=useState<any>({});const[users,setUsers]=useState<any[]>([]);useEffect(()=>{api<any>("/admin/stats",{},token).then(setStats).catch(()=>{});api<any>("/admin/users?limit=10",{},token).then(data=>setUsers(data.users||[])).catch(()=>{});},[token,notice]);const addGoal=async()=>{await api("/admin/goals",{method:"POST",body:JSON.stringify({titleEn:goalTitle,contentEn:goalContent,kind:"scripture",durationSeconds:10})},token);setGoalTitle("");setGoalContent("");setNotice("Daily goal template added.")};const addPrayer=async()=>{await api("/admin/library",{method:"POST",body:JSON.stringify({category:"guided",titleEn:prayerTitle,prayerEn:prayerText})},token);setPrayerTitle("");setPrayerText("");setNotice("Prayer added to rotation.")};const addVerse=async()=>{await api("/admin/verse",{method:"POST",body:JSON.stringify({verseEn:verse,reference})},token);setVerse("");setReference("");setNotice("Daily verse added to the rotation.")};return <><PageIntro title="Admin Management" subtitle="Dedicated backend and database control center." /><div className="metric-grid admin"><Stat value={`${stats.totalUsers ?? "--"}`} label="Users" /><Stat value={`${stats.totalPrayers ?? entries.length}`} label="Prayers" /><Stat value={`${stats.totalGoals ?? goals.length}`} label="Goals" /><Stat value={`${stats.totalJournal ?? entries.length}`} label="Journal" /></div>{notice&&<p className="admin-notice">{notice}</p>}<Panel><SectionTitle title="Recent users" subtitle="Live records from the database." /> <div className="admin-table">{users.map(user=><p key={user.id}><b>{user.fullName||"Friend"}</b><span>{user.email}</span><small>{user.role} / {user.subscriptionStatus}</small></p>)}</div></Panel><div className="admin-editor-grid"><Panel><SectionTitle title="Add daily goal" subtitle="Assigned when users open today's goals."/><div className="form-stack"><input value={goalTitle} onChange={e=>setGoalTitle(e.target.value)} placeholder="Goal title"/><textarea value={goalContent} onChange={e=>setGoalContent(e.target.value)} placeholder="Bible passage or activity instructions"/><button disabled={!goalTitle.trim()} className="button primary" onClick={addGoal}>Add daily goal</button></div></Panel><Panel><SectionTitle title="Add rotating prayer" subtitle="Shown in a fresh order on the Pray screen."/><div className="form-stack"><input value={prayerTitle} onChange={e=>setPrayerTitle(e.target.value)} placeholder="Prayer title"/><textarea value={prayerText} onChange={e=>setPrayerText(e.target.value)} placeholder="Prayer text"/><button disabled={!prayerTitle.trim()||!prayerText.trim()} className="button primary" onClick={addPrayer}>Add prayer</button></div></Panel><Panel><SectionTitle title="Add daily verse" subtitle="Rotates automatically when no date is specified."/><div className="form-stack"><textarea value={verse} onChange={e=>setVerse(e.target.value)} placeholder="Bible verse"/><input value={reference} onChange={e=>setReference(e.target.value)} placeholder="Reference"/><button disabled={!verse.trim()||!reference.trim()} className="button primary" onClick={addVerse}>Add verse</button></div></Panel></div></>; }

function PageIntro({ title, subtitle, action }: { title: string; subtitle: string; action?: React.ReactNode }) { return <header className="page-intro"><div><p className="eyebrow">ReviveSpring</p><h2>{title}</h2><p>{subtitle}</p></div>{action}</header>; }
function SectionTitle({ title, subtitle }: { title: string; subtitle?: string }) { return <div className="section-title"><h3>{title}</h3>{subtitle && <p>{subtitle}</p>}</div>; }
function Panel({ children, className = "" }: { children: React.ReactNode; className?: string }) { return <section className={`panel ${className}`}>{children}</section>; }
function Stat({ value, label, onClick, active = false }: { value: string; label: string; onClick?: () => void; active?: boolean }) { return <button type="button" aria-pressed={onClick ? active : undefined} className={`stat ${onClick ? "clickable" : ""} ${active ? "active" : ""}`.trim()} onClick={onClick}><b>{value}</b><span>{label}</span>{onClick && <small>{active ? "Viewing details" : "Tap to explore"}</small>}</button>; }
function PrayerTile({ title, body, icon, tone, onOpen }: { title: string; body: string; icon: React.ReactNode; tone: string; onOpen?:()=>void }) {
  return <button type="button" className={`prayer-tile ${onOpen ? "clickable" : "display-only"}`.trim()} onClick={onOpen} aria-label={onOpen ? `Open ${title}` : title}><span className={`tile-icon ${tone}`}>{icon}</span><div><h3>{title}</h3><p>{body}</p></div>{onOpen && <span className="prayer-arrow" aria-hidden="true">{">"}</span>}</button>;
}
function getMoodPrayer(mood: string) {
  return MOOD_PRAYERS[mood] || MOOD_PRAYERS.Anxious;
}
function moodPrayerItem(mood: string): PrayerItem {
  const prayer = getMoodPrayer(mood);
  const selectedVerse = prayer.verses[Math.floor(Math.random() * prayer.verses.length)];
  return { identifier: `mood-${slugify(mood)}`, title: `Prayer for ${mood}`, body: prayer.body, icon: <MoodIcon name={prayer.icon} />, tone: prayer.tone, mood, verse: selectedVerse.verse, reference: selectedVerse.reference, action: prayer.action };
}
function prayerExperience(item: PrayerItem): PrayerExperience {
  const topic = `${item.mood || ""} ${item.title}`.toLowerCase();
  const moodMatch = Object.keys(MOOD_PRAYERS).find(name => topic.includes(name.toLowerCase()));
  const moodPrayer = moodMatch ? MOOD_PRAYERS[moodMatch] : undefined;
  const anxiety = topic.includes("anx");
  const healing = topic.includes("heal");
  const family = topic.includes("family");
  const morning = topic.includes("morning") || topic.includes("renewal");
  const scriptures = moodPrayer?.verses || (anxiety ? MOOD_PRAYERS.Anxious.verses : healing ? MOOD_PRAYERS.Healing.verses : family ? MOOD_PRAYERS["Family concern"].verses : morning ? [
    { verse: "Cause me to hear thy lovingkindness in the morning; for in thee do I trust.", reference: "Psalm 143:8" },
    { verse: "It is of the Lord's mercies that we are not consumed... they are new every morning.", reference: "Lamentations 3:22-23" },
    { verse: "This is the day which the Lord hath made; we will rejoice and be glad in it.", reference: "Psalm 118:24" },
  ] : [
    { verse: item.verse || "The Lord is near to all who call upon him.", reference: item.reference || "Psalm 145:18" },
    { verse: "God is our refuge and strength, a very present help in trouble.", reference: "Psalm 46:1" },
    { verse: "Commit thy way unto the Lord; trust also in him.", reference: "Psalm 37:5" },
  ]);
  return {
    scriptures,
    confessions: anxiety ? [
      "God's peace guards my heart and mind.",
      "I release the future and receive grace for this moment.",
      "Fear may speak, but it does not lead me; the Spirit of God does.",
    ] : healing ? [
      "God is present in every part of my healing journey.",
      "My pain is seen, and restoration is still possible.",
      "I receive strength for today and hope for tomorrow.",
    ] : family ? [
      "God's wisdom and peace are welcome in my home.",
      "I choose patient words, forgiveness, and faithful love.",
      "My family is held in God's care even when I cannot control every outcome.",
    ] : [
      "God is with me, guiding me with wisdom and grace.",
      "I can take today's next faithful step without fear.",
      "My hope is rooted in God's unchanging love.",
    ],
    guidedPrayer: moodPrayer?.body || item.body,
    encouragement: anxiety ? [
      "You do not need to solve everything before you can breathe.",
      "Peace can arrive in small moments: one breath, one verse, one honest prayer.",
      "Needing support is not weak faith. God often brings care through safe people.",
    ] : [
      "Growth is still happening in the quiet places you cannot yet measure.",
      "God meets honest hearts, not perfect performances.",
      "A small faithful response today can become tomorrow's stronger rhythm.",
    ],
  };
}
function MoodModal({ mood, token, refresh, close }: { mood: string; token:string; refresh:()=>Promise<void>; close: () => void }) { const item=moodPrayerItem(mood); return <TimedPrayerModal item={item} token={token} refresh={refresh} close={close}/>; }
function ClosePrayerIcon() { return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12" /><path d="M18 6L6 18" /></svg>; }
function TimedPrayerModal({item,token,refresh,close}:{item:PrayerItem;token:string;refresh:()=>Promise<void>;close:()=>void}){
  const required=15;
  const experience=prayerExperience(item);
  const[recorded,setRecorded]=useState(()=>{try{return localStorage.getItem(prayerStorageKey(item))==="true"}catch{return false}});
  useEffect(()=>{
    if(recorded) return;
    const key=prayerStorageKey(item);
    const timer=window.setTimeout(async()=>{
      try{
        await api("/prayers/complete",{method:"POST",body:JSON.stringify({mood:item.mood||"guided",prayer_identifier:prayerIdentifier(item),prayer_text:item.body,bible_verse:item.verse,bible_reference:item.reference,action_step:item.action,elapsed_seconds:required})},token);
        localStorage.setItem(key,"true");
        setRecorded(true);
        await refresh();
      }catch{}
    },required*1000);
    return()=>window.clearTimeout(timer);
  },[item,recorded,refresh,token]);
  return <div className="modal-backdrop" onClick={close}><section className="mood-modal hovering-prayer prayer-experience-modal" onClick={e=>e.stopPropagation()}><button className="modal-close prayer-close" onClick={close} aria-label="Close prayer"><ClosePrayerIcon /></button><span className={`tile-icon ${item.tone}`}>{item.icon}</span><p className="eyebrow">{item.title}</p><h2>A complete prayer experience for this season.</h2><PrayerResourceSection icon="01" title="Relevant Scriptures">{experience.scriptures.map(scripture => <blockquote key={scripture.reference}><q>{scripture.verse}</q><b>{scripture.reference}</b></blockquote>)}</PrayerResourceSection><PrayerResourceSection icon="02" title="Faith Confessions"><div className="prayer-resource-list">{experience.confessions.map(confession => <p key={confession}>{confession}</p>)}</div></PrayerResourceSection><PrayerResourceSection icon="03" title="Guided Prayer"><p className="guided-prayer-copy">{experience.guidedPrayer}</p>{item.action&&<p className="action-step"><b>Faith step</b>{item.action}</p>}</PrayerResourceSection><PrayerResourceSection icon="04" title="Words of Encouragement and Hope"><div className="prayer-resource-list hope">{experience.encouragement.map(message => <p key={message}>{message}</p>)}</div></PrayerResourceSection><p className="timer-copy">{recorded?"Prayer recorded once for this unique prayer.":"This prayer will be recorded once after a quiet moment here."}</p></section></div>
}
function PrayerResourceSection({ icon, title, children }: { icon: string; title: string; children: React.ReactNode }) {
  return <section className="prayer-resource-section"><header><span>{icon}</span><h3>{title}</h3></header>{children}</section>;
}
function GoalModal({goal,token,refresh,close}:{goal:Goal;token:string;refresh:()=>Promise<void>;close:()=>void}){const[seconds,setSeconds]=useState(0);const required=goal.durationSeconds||10;useEffect(()=>{const timer=window.setInterval(()=>setSeconds(value=>value+1),1000);return()=>clearInterval(timer)},[]);return <div className="modal-backdrop" onClick={close}><section className="mood-modal" onClick={e=>e.stopPropagation()}><button className="modal-close" onClick={close}>x</button><p className="eyebrow">{goal.kind||"Daily goal"}</p><h2>{goal.text}</h2><p>{goal.content||"Take a quiet moment to complete this activity faithfully."}</p><p className="timer-copy">{seconds>=required?"Ready to mark complete.":`Stay here for ${required-seconds} more seconds.`}</p><button disabled={seconds<required} className="button primary full" onClick={async()=>{await api(`/goals/${goal.id}/complete`,{method:"POST",body:JSON.stringify({elapsed_seconds:seconds})},token);await refresh();close()}}>Complete goal</button></section></div>}
function Field({ label, value, onChange, placeholder, type = "text" }: { label: string; value: string; onChange: (value: string) => void; placeholder: string; type?: string }) { return <label className="field"><span>{label}</span><input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} type={type} /></label>; }
function initials(name?: string) {
  const parts = (name || "Friend").trim().split(/\s+/).filter(Boolean);
  return (parts.length ? parts.map(part => part[0]).join("") : "F").slice(0, 2).toUpperCase();
}



