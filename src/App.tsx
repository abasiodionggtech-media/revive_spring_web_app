import { CSSProperties, Component, FormEvent, useEffect, useRef, useState } from "react";
import { Navigate, Route, Routes, useNavigate } from "react-router-dom";

type Lang = "en" | "fr";
type AppTab = "home" | "prayers" | "journal" | "goals" | "wellness" | "ai" | "profile" | "admin";
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
};
type Goal = { id: string; text: string; done: boolean; kind?: string; content?: string; durationSeconds?: number };
type JournalEntry = { id: string; body: string; date: string };
type ChatMessage = { role: "assistant" | "user"; content: string };
type Analytics = { totalPrayers: number; visitCount: number; currentStreak: number; answeredPrayers: number; completedGoals: number };
type PrayerItem = { id?: string; title: string; body: string; icon: string; tone: string; mood?: string; verse?: string; reference?: string; action?: string };
type Wellness = { overall?: number; insight?: string; pillars?: Record<string, { score?: number; count?: number }> };
type SlideKind = "info" | "choice" | "multi" | "statement" | "chart" | "reminder" | "builder" | "commit";
type Slide = { id: string; kind: SlideKind; title: string; body?: string; statement?: string; options?: string[] };
type ReminderSettings = {
  hour: number;
  minute: number;
  timezone: string;
  dailyEmailEnabled: boolean;
  pushNotificationsEnabled: boolean;
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
    return <main className="splash-screen">
      <Brand />
      <h1>Let us refresh your session</h1>
      <p>Your saved browser session is out of date. Refreshing will take you back to sign in safely.</p>
      <button className="button primary" onClick={() => {
        localStorage.removeItem("rs_user");
        localStorage.removeItem("rs_token");
        localStorage.removeItem("rs_onboarded");
        window.location.href = "/auth";
      }}>Refresh session</button>
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
  };
}
function mapGoal(raw: any): Goal {
  return { id: raw.id, text: raw.text, done: raw.completed === true, kind: raw.kind, content: raw.content, durationSeconds: raw.duration_seconds || 10 };
}
const LANG_LABELS: Record<Lang, string> = { en: "English", fr: "Francais" };
const NAV_ITEMS: { id: AppTab; label: string; icon: string }[] = [
  { id: "home", label: "Home", icon: "âŒ‚" },
  { id: "prayers", label: "Pray", icon: "â™¡" },
  { id: "journal", label: "Journal", icon: "âœŽ" },
  { id: "goals", label: "Goals", icon: "âš‘" },
  { id: "wellness", label: "Wellness", icon: "âœ¿" },
  { id: "ai", label: "AI Companion", icon: "âœ¦" },
  { id: "profile", label: "Profile", icon: "â—‹" },
];
const PRAYER_LIBRARY = [
  { title: "Morning Renewal", body: "Lord, align my heart with peace, wisdom, and courage today.", icon: "â˜€", tone: "emerald" },
  { title: "Anxiety Support", body: "A quiet prayer for calm breathing and steady faith.", icon: "â‰ˆ", tone: "lime" },
  { title: "Healing", body: "A hopeful prayer for body, mind, and relationships.", icon: "+", tone: "green" },
  { title: "Family", body: "Cover the people I love with unity and grace.", icon: "â™¡", tone: "coral" },
];
const MOODS = ["Anxious", "Financial stress", "Sad", "Confused", "Grateful", "Healing", "Need a job", "Protection", "Need peace", "Lonely", "Overwhelmed", "Tired", "Hopeful", "Joyful", "Tempted", "Discouraged", "Seeking wisdom", "Family concern"];
const CHART_NAMES = ["Naomi", "Micah", "Esther", "Daniel", "Grace", "Elias", "Hannah", "Caleb", "Abigail", "Josiah"];
const CHART_SERIES = [
  { id: "growth", label: "Spiritual growth", percent: 92, accent: "gold" },
  { id: "healing", label: "Healing", percent: 58, accent: "leaf" },
  { id: "decisions", label: "Decisions", percent: 71, accent: "sky" },
  { id: "relationships", label: "Relationships", percent: 84, accent: "coral" },
] as const;
const REMINDER_HOURS = Array.from({ length: 12 }, (_, index) => index + 1);
const REMINDER_MINUTES = Array.from({ length: 12 }, (_, index) => index * 5);
const ONBOARDING: Slide[] = [
  { id: "story", kind: "info", title: "This is what's possible when Scripture meets real life", body: "Stories from people finding joy, purpose, and direction with daily guidance." },
  { id: "unique", kind: "info", title: "Every journey of faith is unique", body: "We'll help you create a path that fits your life, not someone else's." },
  { id: "topic", kind: "choice", title: "Which topic would you like to explore first?", body: "This will not limit your experience with ReviveSpring.", options: ["Biblical Self Discovery", "Build Unshakable Faith", "Parenting", "Financial Peace", "Other"] },
  { id: "chart", kind: "chart", title: "You've already taken a powerful step", body: "86% of users who focused on one topic in their first month found more peace, clarity, and direction." },
  { id: "motivation", kind: "multi", title: "What motivates you to grow spiritually?", body: "Select all that apply", options: ["Becoming a better person", "Finding deeper meaning", "Helping others", "Overcoming struggles", "Other"] },
  { id: "balance", kind: "statement", title: "Do you agree with this statement?", statement: "Spending time on spiritual growth makes my life feel balanced.", options: ["No", "Yes"] },
  { id: "answers", kind: "statement", title: "Do you agree with this statement?", statement: "I think the Bible has answers to most of life's questions, but at times, I come across passages that are hard to interpret.", options: ["No", "Yes"] },
  { id: "help", kind: "info", title: "When Scripture feels confusing, we are here to help", body: "Faith, questions, and the hard days too." },
  { id: "beliefs", kind: "choice", title: "Have you ever struggled to live out your beliefs?", options: ["Yes, all the time", "Sometimes", "Rarely", "Never"] },
  { id: "living", kind: "info", title: "Shift from knowing to living", body: "Stories from people who felt just like you do now and where they are today." },
  { id: "focus", kind: "statement", title: "Does this sound familiar?", statement: "I often find my mind wandering when I'm trying to focus on reading.", options: ["Not really", "That's me"] },
  { id: "busy", kind: "choice", title: "How often does life feel too busy for quiet time with God?", options: ["All the time", "Sometimes", "Rarely", "Never"] },
  { id: "promise", kind: "info", title: "Small moments, lasting peace - that's our promise to you", body: "Five minutes each morning to center your heart and carry God's presence through your day." },
  { id: "connect", kind: "multi", title: "How do you usually find God in your day?", body: "Select all that apply", options: ["Prayer", "Worship music", "Reading the Bible", "Reflecting in nature", "Journaling my thoughts", "Other"] },
  { id: "hardest", kind: "info", title: "What if Scripture came to you in your hardest moments?", body: "Verses chosen for your struggles, with wisdom that turns pain into purpose." },
  { id: "devotional", kind: "choice", title: "Which describes your ideal devotional experience?", options: ["Simple and actionable", "Deep and thought-provoking", "Uplifting and inspiring", "Guided and structured"] },
  { id: "pace", kind: "info", title: "However you like to connect, we meet you there", body: "Read, listen, reflect, and grow at your pace." },
  { id: "reading", kind: "info", title: "We don't just add to your reading list - we change how you live", body: "Short, relevant devotionals that make Scripture applicable and easy." },
  { id: "time", kind: "choice", title: "How much time are you willing to dedicate to your spiritual growth?", options: ["5 min/day - Short", "10 min/day - Average", "15 min/day - Significant", "20 min/day - Dedicated"] },
  { id: "routine", kind: "reminder", title: "It takes just 21 days to form a new spiritual routine!", body: "Notifications will help you stay on track and push you to achieve your goals." },
  { id: "outcome", kind: "multi", title: "What can we help you do?", body: "This will not limit your experience with ReviveSpring.", options: ["Hear God's voice more clearly", "Find my calling and next steps", "Understand scripture more deeply", "Heal from past hurts", "Break free from destructive patterns", "Align my life with my beliefs"] },
  { id: "summary", kind: "info", title: "Got it! We'll help you understand scripture more deeply", body: "Your personal path is almost ready." },
  { id: "rhythm", kind: "info", title: "Scripture becomes life here! Let's build your daily rhythm", body: "Daily prayer, Scripture, quizzes, and one-time actions shaped for you." },
  { id: "finish", kind: "builder", title: "Creating your personal path...", body: "Setting goals", statement: "Are you inclined to finish what you start?", options: ["No", "Yes"] },
  { id: "challenge", kind: "builder", title: "Creating your personal path...", body: "Adapting growth areas", statement: "Do you tend to stray from the path when faced with challenges?", options: ["No", "Yes"] },
  { id: "verse", kind: "builder", title: "Creating your personal path...", body: "Picking content", statement: "Do you find it challenging to find the right Bible verse?", options: ["No", "Yes"] },
  { id: "pact", kind: "commit", title: "Commitment pact", body: "This isn't a big vow - it's a small yes to growing with God." },
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
      <Route path="/auth" element={<AuthPage language={language ?? "en"} onLogin={(nextUser, nextToken) => { setUser(nextUser); setToken(nextToken); setOnboarded(!!nextUser.hasCompletedOnboarding); }} />} />
      <Route path="/verify" element={<VerifyPage onVerified={(nextUser, nextToken) => { setUser(nextUser); setToken(nextToken); setOnboarded(!!nextUser.hasCompletedOnboarding); }} />} />
      <Route path="/onboarding" element={activeUser && token ? <OnboardingPage language={language ?? "en"} token={token} user={activeUser} onComplete={(updatedUser) => { setOnboarded(true); setUser(updatedUser); }} /> : <Navigate to="/auth" replace />} />
      <Route path="/app" element={activeUser && token && isOnboarded ? <MainApp user={activeUser} token={token} signOut={() => { setUser(null); setToken(null); }} updateUser={setUser} language={language ?? "en"} /> : <Navigate to={setupPath} replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </AppErrorBoundary>
  );
}

function SplashPage({ nextPath }: { nextPath: string }) {
  const navigate = useNavigate();
  useEffect(() => {
    const timer = window.setTimeout(() => navigate(nextPath, { replace: true }), 1800);
    return () => window.clearTimeout(timer);
  }, [navigate, nextPath]);
  return <main className="splash-screen">
    <div className="splash-logo image"><img src="/revivespring-icon.png" alt="ReviveSpring" /></div>
    <h1>ReviveSpring</h1>
    <p>Revive Your Spirit. Renew Your Day.</p>
    <div className="splash-loader"><i /></div>
    <button className="link-button" onClick={() => navigate(nextPath, { replace: true })}>Continue</button>
  </main>;
}

function Brand({ compact = false }: { compact?: boolean }) {
  return <div className={`brand ${compact ? "compact" : ""}`}><span className="brand-mark">âœ¦</span><span><b>ReviveSpring</b>{!compact && <small>Faith for every day</small>}</span></div>;
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
    <span className="large-icon">â—·</span>
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
  return <div className="scroll-picker">
    <span>{label}</span>
    <div className="scroll-picker-list" role="listbox" aria-label={label}>
      {values.map((item) => <button type="button" key={String(item)} className={item === selected ? "active" : ""} onClick={() => onSelect(item)}>{format(item)}</button>)}
    </div>
  </div>;
}

function LanguagePage({ current, onSelect }: { current: Lang | null; onSelect: (lang: Lang) => void }) {
  const navigate = useNavigate();
  return <PublicShell>
    <div className="auth-card language-card">
      <Brand />
      <p className="kicker">Personalize your journey</p><h1>Choose your language</h1>
      <p className="lead">Choisissez votre langue. You can change this later in your profile.</p>
      <div className="language-options">{(["en", "fr"] as Lang[]).map(lang =>
        <button className={`language-option ${current === lang ? "selected" : ""}`} onClick={() => onSelect(lang)} key={lang}>
          <span className="language-icon">{lang === "en" ? "EN" : "FR"}</span><b>{LANG_LABELS[lang]}</b><small>{lang === "en" ? "Continue in English" : "Continuer en francais"}</small>
        </button>)}
      </div>
      <button className="button primary full" disabled={!current} onClick={() => navigate("/auth")}>Continue <span>â†’</span></button>
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
            const data = await api<any>("/auth/google", { method: "POST", body: JSON.stringify({ id_token: response.credential, language }) });
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
        const data = await api<any>("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });
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
    <Brand /><p className="kicker">Welcome to your quiet space</p><h1>{signup ? "Create your account" : "Welcome back"}</h1>
    <p className="lead">{signup ? "Start a daily rhythm shaped around your faith." : "Continue your prayer and reflection journey."}</p>
    <div className="segmented"><button className={!signup ? "active" : ""} onClick={() => setSignup(false)}>Sign in</button><button className={signup ? "active" : ""} onClick={() => setSignup(true)}>Sign up</button></div>
    <form onSubmit={submit} className="form-stack">
      {error && <p className="form-error">{error}</p>}
      {signup && <Field label="Full name" value={name} onChange={setName} placeholder="Your full name" />}
      <Field label="Email address" value={email} onChange={setEmail} placeholder="you@example.com" type="email" />
      <Field label="Password" value={password} onChange={setPassword} placeholder="At least 6 characters" type="password" />
      <button className="button primary full" disabled={busy || email.length < 5 || password.length < 6 || (signup && !name.trim())}>{busy ? "Please wait..." : signup ? "Create account" : "Sign in"} <span>â†’</span></button>
    </form>
    {GOOGLE_CLIENT_ID ? <div className="google-button" ref={googleButton} /> : <p className="form-error">Set VITE_GOOGLE_CLIENT_ID to enable Google Sign-In on the web.</p>}
    <button className="link-button" onClick={() => setSignup(!signup)}>{signup ? "Already have an account? Sign in" : "New here? Create an account"}</button>
  </div></PublicShell>;
}

function VerifyPage({ onVerified }: { onVerified: (user: User, token: string) => void }) {
  const [code, setCode] = useState(""); const [error, setError] = useState(""); const navigate = useNavigate();
  const pending = sessionStorage.getItem("rs_pending_email");
  if (!pending) return <Navigate to="/auth" replace />;
  return <PublicShell><div className="auth-card"><Brand /><div className="large-icon">âœ‰</div><p className="kicker">One last step</p><h1>Verify your email</h1>
    <p className="lead">Enter the 6-digit code sent to your inbox. For this preview, any six digits will work.</p>
    <Field label="Verification code" value={code} onChange={setCode} placeholder="000000" />
    {error && <p className="form-error">{error}</p>}
    <button className="button primary full" disabled={code.length !== 6} onClick={async () => { try { const data = await api<any>("/auth/verify-otp", { method:"POST", body:JSON.stringify({ email:pending, otp:code }) }); onVerified(mapUser(data.user), data.token); sessionStorage.removeItem("rs_pending_email"); navigate("/onboarding"); } catch (err) { setError(err instanceof Error ? err.message : "Verification failed."); } }}>Verify and continue <span>â†’</span></button>
  </div></PublicShell>;
}

function PublicShell({ children }: { children: React.ReactNode }) {
  const [quote, setQuote] = useState(0);
  useEffect(() => {
    const timer = window.setInterval(() => setQuote((value) => (value + 1) % ROTATING_QUOTES.length), 5 * 60 * 1000);
    return () => window.clearInterval(timer);
  }, []);
  const active = ROTATING_QUOTES[quote];
  return <main className="public-shell"><div className="public-aside"><Brand /><div><p className="eyebrow">Revive your spirit. Renew your day.</p><h2>A calmer place to pray, reflect, and grow with purpose.</h2><p>Daily guidance meets real life, one faithful step at a time.</p></div><div className="aside-verse"><span>Daily reflection</span><q className="fade-quote" key={active.reference}>{active.verse}</q><b>{active.reference}</b></div></div><div className="public-main">{children}</div></main>;
}

function OnboardingPage({ language, token, user, onComplete }: { language:Lang; token: string; user: User; onComplete: (user: User) => void }) {
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [committed, setCommitted] = useState(false);
  const [reminderSettings, setReminderSettings] = useState<ReminderSettings>(() => initialReminderSettings(user));
  const [commitFxOrigin, setCommitFxOrigin] = useState<{ x: number; y: number } | null>(null);
  const [commitFxActive, setCommitFxActive] = useState(false);
  const finishingRef = useRef(false);
  const navigate = useNavigate();
  const slide = ONBOARDING[index], selected = answers[slide.id] || [];
  const needsAnswer = ["choice", "multi", "statement", "builder"].includes(slide.kind);
  const canContinue = slide.kind === "commit" ? committed : !needsAnswer || selected.length > 0;
  const select = (option: string) => setAnswers(prev => ({ ...prev, [slide.id]: slide.kind === "multi" ? (selected.includes(option) ? selected.filter(x => x !== option) : [...selected, option]) : [option] }));

  const completeOnboarding = async () => {
    if (finishingRef.current) return;
    finishingRef.current = true;
    const payload = { language, answers, committed: true, completedAt: new Date().toISOString(), reminderTime: reminderSettings };
    await api("/onboarding/save", { method: "POST", body: JSON.stringify(payload) }, token);
    onComplete({
      ...user,
      hasCompletedOnboarding: true,
      language,
      timezone: reminderSettings.timezone,
      reminderHour: reminderSettings.hour,
      reminderMinute: reminderSettings.minute,
      dailyEmailEnabled: reminderSettings.dailyEmailEnabled,
      pushNotificationsEnabled: reminderSettings.pushNotificationsEnabled,
    });
    navigate("/app");
  };

  const commitWithAnimation = (origin: { x: number; y: number }) => {
    setCommitted(true);
    setCommitFxOrigin(origin);
    setCommitFxActive(true);
    window.setTimeout(() => { void completeOnboarding(); }, 820);
  };

  return <main className={`onboarding-shell ${commitFxActive ? "commit-transitioning" : ""}`.trim()}>
    {commitFxOrigin && <div className={`commit-burst ${commitFxActive ? "active" : ""}`} style={{ left: `${commitFxOrigin.x}px`, top: `${commitFxOrigin.y}px` }} />}
    <header className="onboarding-header"><Brand compact /><div className="onboarding-progress"><div><span>About you</span><b>{index + 1} / {ONBOARDING.length}</b></div><div className="progress"><i style={{ width: `${((index + 1) / ONBOARDING.length) * 100}%` }} /></div></div><button className="icon-button" onClick={() => setIndex(Math.max(0, index - 1))} disabled={index === 0 || commitFxActive} title="Previous step">â†</button></header>
    <section className="onboarding-content"><div className="onboarding-stage" key={slide.id}><p className="kicker">Your personal path</p><h1>{slide.title}</h1>{slide.body && <p className="onboarding-lead">{slide.body}</p>}<div className="onboarding-stage-body"><SlideContent slide={slide} selected={selected} select={select} committed={committed} setCommitted={setCommitted} reminderSettings={reminderSettings} setReminderSettings={setReminderSettings} onCommitTap={commitWithAnimation} /></div></div></section>
    <footer className="onboarding-footer"><button className="button ghost" onClick={() => setIndex(Math.max(0, index - 1))} disabled={index === 0 || commitFxActive}>Back</button><button className="button primary" disabled={!canContinue || commitFxActive} onClick={async () => { if (index === ONBOARDING.length - 1) { await completeOnboarding(); } else setIndex(index + 1); }}>{index === ONBOARDING.length - 1 ? "Enter ReviveSpring" : "Continue"} <span>â†’</span></button></footer>
  </main>;
}

function SlideContent({ slide, selected, select, committed, setCommitted, reminderSettings, setReminderSettings, onCommitTap }: { slide: Slide; selected: string[]; select: (value: string) => void; committed: boolean; setCommitted: (value: boolean) => void; reminderSettings: ReminderSettings; setReminderSettings: (value: ReminderSettings) => void; onCommitTap: (origin: { x: number; y: number }) => void }) {
  if (slide.kind === "chart") return <OnboardingChartCard />;
  if (slide.kind === "reminder") return <ReminderSetupCard value={reminderSettings} onChange={setReminderSettings} />;
  if (slide.kind === "commit") return <div className="commit-card"><p>A few moments each day with God's Word.<br />A safe space to reflect and recharge.</p><button className={`commit-button ${committed ? "done" : ""}`} onClick={(event) => { const rect = event.currentTarget.getBoundingClientRect(); setCommitted(true); onCommitTap({ x: rect.left + (rect.width / 2), y: rect.top + (rect.height / 2) }); }}>{committed ? "âœ“" : "â˜"}</button><b>{committed ? "Committed" : "Tap to commit"}</b></div>;
  if (slide.kind === "builder") return <div className="builder-card"><span>Personalizing your path</span><div className="progress"><i style={{ width: "72%" }} /></div><h3>{slide.statement}</h3><AnimatedOptionGrid options={slide.options || []} selected={selected} select={select} /></div>;
  if (slide.kind === "statement") return <div><blockquote>{slide.statement}</blockquote><AnimatedOptionGrid options={slide.options || []} selected={selected} select={select} /></div>;
  if (slide.options) return <AnimatedOptionGrid options={slide.options} selected={selected} select={select} multi={slide.kind === "multi"} />;
  return <div className="story-grid"><article><b>Carol</b><span>â˜…â˜…â˜…â˜…â˜…</span><p>"I wake up filled with joy and purpose."</p></article><article><b>Alex</b><span>â˜…â˜…â˜…â˜…â˜…</span><p>"This has helped me build a real relationship with God."</p></article><article><b>Mike</b><span>â˜…â˜…â˜…â˜…â˜…</span><p>"Spiritual growth now feels possible each day."</p></article></div>;
}
function OptionGrid({ options, selected, select, multi }: { options: string[]; selected: string[]; select: (value: string) => void; multi?: boolean }) {
  return <div className="option-grid">{options.map(option => <button key={option} className={selected.includes(option) ? "selected" : ""} onClick={() => select(option)}><span>{option}</span><i>{selected.includes(option) ? "âœ“" : multi ? "â–¡" : "â—‹"}</i></button>)}</div>;
}
function AnimatedOptionGrid({ options, selected, select, multi }: { options: string[]; selected: string[]; select: (value: string) => void; multi?: boolean }) {
  return <div className="option-grid">{options.map((option, index) => <button key={option} className={`onboarding-option ${selected.includes(option) ? "selected" : ""}`.trim()} style={{ "--enter-delay": `${220 + (index * 90)}ms` } as CSSProperties} onClick={() => select(option)}><span>{option}</span><i>{selected.includes(option) ? "Ã¢Å“â€œ" : multi ? "Ã¢â€“Â¡" : "Ã¢â€”â€¹"}</i></button>)}</div>;
}

function MainApp({ user, token, signOut, updateUser, language }: { user: User; token: string; signOut: () => void; updateUser: (user: User | null) => void; language: Lang }) {
  const [tab, setTab] = useState<AppTab>("home");
  const [goals, setGoals] = useState<Goal[]>([]);
  const [journal, setJournal] = useState<JournalEntry[]>([]);
  const [analytics, setAnalytics] = useState<Analytics>({ totalPrayers:0, visitCount:0, currentStreak:0, answeredPrayers:5, completedGoals:0 });
  const [verse, setVerse] = useState({ verse:"I can do all things through Christ who strengthens me.", reference:"Philippians 4:13" });
  const [library, setLibrary] = useState<PrayerItem[]>(PRAYER_LIBRARY);
  const refresh = async () => {
    const [goalData, journalData, analyticsData, verseData, libraryData] = await Promise.all([
      api<any[]>("/goals", {}, token), api<any[]>("/journal", {}, token), api<Analytics>("/analytics", {}, token),
      api<any>("/daily-verse", {}, token).catch(() => verse), api<any[]>("/library", {}, token).catch(() => []),
    ]);
    setGoals(goalData.map(mapGoal)); setJournal(journalData.map(item => ({ id:item.id, body:item.content, date:item.created_date || "Today" })));
    setAnalytics(analyticsData); setVerse(verseData);
    if (libraryData.length) setLibrary(libraryData.map(item => ({ id:item.id, title:item.titleEn, body:item.prayerEn, icon:"â™¡", tone:"emerald", mood:item.category, verse:item.verseEn, reference:item.verseRef, action:item.actionEn })));
  };
  useEffect(() => {
    api<any>("/auth/me", {}, token).then((currentUser) => {
      updateUser(mapUser(currentUser));
      return refresh();
    }).catch(signOut);
  }, []);
  const navItems = user.isAdmin ? [...NAV_ITEMS, { id: "admin" as const, label: "Admin", icon: "âš™" }] : NAV_ITEMS;
  const title = navItems.find(item => item.id === tab)?.label || "Admin";
  return <div className="app-shell"><aside className="sidebar"><Brand /><nav>{navItems.map(item => <NavButton item={item} active={tab === item.id} onClick={() => setTab(item.id)} key={item.id} />)}</nav><button className="sidebar-profile" onClick={() => setTab("profile")}><UserAvatar user={user} className="sidebar-avatar" /><div><b>{user.fullName}</b><small>{user.plan} plan</small></div></button></aside>
    <div className="workspace"><header className="app-header"><div><p className="eyebrow">{new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}</p><h1>{title}</h1></div><button className="avatar-button" onClick={() => setTab("profile")} title="Open profile"><UserAvatar user={user} className="header-avatar" /></button></header>
      <div className="screen-wrap">
        {tab === "home" && <HomeScreen user={user} token={token} goals={goals} analytics={analytics} refresh={refresh} openAi={() => setTab("ai")} openPrayers={() => setTab("prayers")} />}
        {tab === "prayers" && <PrayerScreen items={library} token={token} refresh={refresh} openAi={() => setTab("ai")} />}
        {tab === "journal" && <JournalScreen token={token} entries={journal} setEntries={setJournal} />}
        {tab === "goals" && <GoalsScreen token={token} goals={goals} refresh={refresh} />}
        {tab === "wellness" && <WellnessScreen token={token} />}
        {tab === "ai" && <AiScreen user={user} />}
        {tab === "profile" && <ProfileScreen user={user} language={language} signOut={signOut} openAdmin={user.isAdmin ? () => setTab("admin") : undefined} />}
        {tab === "admin" && user.isAdmin && <AdminControlCenter token={token} />}
      </div>
    </div><nav className="mobile-nav">{navItems.map(item => <NavButton item={item} active={tab === item.id} onClick={() => setTab(item.id)} key={item.id} />)}</nav></div>;
}

function NavButton({ item, active, onClick }: { item: { label: string; icon: string }; active: boolean; onClick: () => void }) { return <button className={active ? "nav-item active" : "nav-item"} onClick={onClick}><span>{item.icon}</span><b>{item.label}</b></button>; }
function HomeScreen({ user, token, goals, analytics, refresh, openAi, openPrayers }: { user: User; token:string; goals: Goal[]; analytics:Analytics; refresh:()=>Promise<void>; openAi: () => void; openPrayers: () => void }) {
  const [mood, setMood] = useState<string | null>(null), done = goals.filter(g => g.done).length;
  const [quote, setQuote] = useState(0);
  useEffect(() => {
    const timer = window.setInterval(() => setQuote((value) => (value + 1) % ROTATING_QUOTES.length), 5 * 60 * 1000);
    return () => window.clearInterval(timer);
  }, []);
  const activeQuote = ROTATING_QUOTES[quote];
  const firstName = (user.fullName || "Friend").trim().split(" ")[0] || "Friend";
  return <><section className="welcome-row"><div><p className="eyebrow">A fresh spring for your spirit today</p><h2>Good morning, {firstName}</h2></div><button className="button primary" onClick={openAi}>âœ¦ Ask AI Companion</button></section>
    <div className="dashboard-grid"><div className="main-column"><article className="verse-card fade-panel" key={activeQuote.reference}><p>Verse of the day</p><q>{activeQuote.verse}</q><b>{activeQuote.reference}</b></article><section><SectionTitle title="How are you feeling?" subtitle="Choose a feeling for a personal prayer." /><div className="mood-grid">{MOODS.map(x => <button onClick={() => setMood(x)} key={x}><span>{moodIcon(x)}</span>{x}</button>)}</div></section></div>
      <div className="side-column"><div className="stat-grid"><Stat value={`${analytics.totalPrayers}`} label="Prayers" onClick={openPrayers} /><Stat value={`${analytics.currentStreak}`} label="Streak" /><Stat value={`${analytics.visitCount}`} label="Visits" /><Stat value="5" label="Answered" /></div><Panel><SectionTitle title="Today's goals" subtitle={`${done} of ${goals.length} complete`} />{goals.map(goal => <div className="mini-goal" key={goal.id}><span className={goal.done ? "done" : ""}>{goal.done ? "âœ“" : ""}</span><p>{goal.text}</p></div>)}</Panel></div></div>{mood && <MoodModal mood={mood} token={token} refresh={refresh} close={() => setMood(null)} />}</>;
}
function PrayerScreen({ items, token, refresh, openAi }: { items:PrayerItem[]; token:string; refresh:()=>Promise<void>; openAi: () => void }) { const [active,setActive]=useState<PrayerItem|null>(null); return <><PageIntro title="Prayer Library" subtitle="Saved prayers and guided moments for every season." action={<button className="button primary" onClick={openAi}>âœ¦ Ask AI Companion</button>} /><div className="library-grid">{items.map(p => <PrayerTile {...p} onOpen={()=>setActive(p)} key={p.id || p.title} />)}</div>{active&&<TimedPrayerModal item={active} token={token} refresh={refresh} close={()=>setActive(null)} />}</>; }
function JournalScreen({ token, entries, setEntries }: { token:string; entries: JournalEntry[]; setEntries: (entries: JournalEntry[]) => void }) {
  const [text, setText] = useState(""); return <><PageIntro title="Prayer Journal" subtitle="Record requests, make room for reflection, and celebrate answers." /><Panel className="journal-compose"><textarea value={text} onChange={e => setText(e.target.value)} placeholder="What are you carrying today?" /><button className="button primary" onClick={async () => { if (text.trim()) { const entry=await api<any>("/journal",{method:"POST",body:JSON.stringify({title:text.slice(0,54),content:text})},token); setEntries([{ id:entry.id, body:entry.content, date:entry.created_date }, ...entries]); setText(""); } }}>+ Add entry</button></Panel><div className="entry-list">{entries.map(entry => <Panel key={entry.id}><small>{entry.date}</small><p>{entry.body}</p></Panel>)}</div></>;
}
function GoalsScreen({ token, goals, refresh }: { token:string; goals: Goal[]; refresh:()=>Promise<void> }) {
  const [active,setActive]=useState<Goal|null>(null);
  return <><PageIntro title="Daily Goals" subtitle="Open each assigned activity and complete the faithful step." /><div className="goal-list">{goals.map(goal => <button className={goal.done ? "goal-row complete" : "goal-row"} key={goal.id} onClick={()=>!goal.done&&setActive(goal)}><span>{goal.done?"âœ“":"â—‹"}</span><b>{goal.text}</b></button>)}</div>{active&&<GoalModal goal={active} token={token} refresh={refresh} close={()=>setActive(null)} />}</>;
}
function WellnessScreen({ token }: { token: string }) {
  const [wellness, setWellness] = useState<Wellness>({});
  useEffect(() => { api<Wellness>("/onboarding/wellness", {}, token).then(setWellness).catch(() => setWellness({})); }, [token]);
  const pillar = (key: string) => wellness.pillars?.[key]?.score ?? 0;
  return <><PageIntro title="Spiritual Wellness" subtitle="AI-guided faith health from onboarding and daily progress." /><div className="wellness-grid"><Panel className="score-panel"><div className="score-ring" style={{ background: `conic-gradient(var(--emerald) 0 ${wellness.overall ?? 0}%,#e8f1ee ${wellness.overall ?? 0}% 100%)` }}><span>{wellness.overall ?? 0}%</span></div><div><p className="eyebrow">Your wellness score</p><h2>Growing steadily</h2><p>{wellness.insight ?? "Your score updates as you pray, journal, complete goals, and build consistency."}</p></div></Panel><div className="metric-grid"><Stat value={`${pillar("goals")}%`} label="Scripture Awareness" /><Stat value={`${pillar("prayer")}%`} label="Peace" /><Stat value={`${pillar("journal")}%`} label="Rest" /></div></div><PrayerTile title="Guided Affirmation" body="I am loved, held, restored, and strengthened for today." icon="â™¡" tone="green" /></>;
}
function AiScreen({user}:{user:User}) {
  const initialMessage: ChatMessage = { role: "assistant", content: "Hello. I am your Bible and prayer AI. Ask me for a prayer, verse, or encouragement." };
  const defaultSessionId = `rs-user-${user.email.toLowerCase()}`;
  const [sessionId, setSessionId] = useState(defaultSessionId);
  const [sessions, setSessions] = useState<{ sessionId: string; updatedAt: string; preview: string }[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([initialMessage]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);

  const loadSessions = async () => {
    try {
      const data = await api<any>(`/ai/sessions?userEmail=${encodeURIComponent(user.email)}`);
      setSessions(Array.isArray(data?.sessions) ? data.sessions : []);
    } catch {
      setSessions([]);
    }
  };

  const loadHistory = async (nextSessionId: string) => {
    setHistoryLoading(true);
    try {
      const data = await api<any>(`/ai/history?sessionId=${encodeURIComponent(nextSessionId)}&userEmail=${encodeURIComponent(user.email)}`);
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

  const send = async (suggestion?: string) => {
    const value = (suggestion || input).trim();
    if (!value || typing) return;
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
          history: history.map(m => ({ role: m.role === "assistant" ? "model" : "user", content: m.content })),
        }),
      });
      setMessages(prev => [...prev, { role: "assistant", content: data.reply }]);
      await loadSessions();
    } catch {
      setMessages(prev => [...prev, { role: "assistant", content: "I could not connect right now. Please try again shortly." }]);
    } finally {
      setTyping(false);
    }
  };

  return <><PageIntro title="AI Prayer Companion" subtitle="A signed-in space for prayer, Scripture, and reflection." /><div className="suggestions">{["Give me a prayer for anxiety", "Bible verse for strength", "Prayer for healing", "How can I strengthen my faith?"].map(x => <button onClick={() => send(x)} key={x}>{x}</button>)}</div><div className="ai-history-row"><button className="button secondary" onClick={startNewConversation}>New conversation</button>{sessions.slice(0, 5).map((item, index) => <button className={`ai-session-chip ${item.sessionId === sessionId ? "active" : ""}`.trim()} key={`${item.sessionId}-${index}`} onClick={() => loadHistory(item.sessionId)} title={item.preview}>{new Date(item.updatedAt).toLocaleDateString()} · {item.preview?.slice(0, 24) || "Conversation"}</button>)}</div><Panel className="chat-panel"><div className="messages">{historyLoading && <p className="typing">Loading previous conversation...</p>}{messages.map((m, i) => <p className={`message ${m.role}`} key={i}>{m.content}</p>)}{typing && <p className="typing">Writing a thoughtful response...</p>}</div><div className="chat-compose"><textarea value={input} onChange={e => setInput(e.target.value)} placeholder="Ask about Bible or prayer" /><button className="button primary" onClick={() => send()}>Send</button></div></Panel></>;
}

function ProfileScreen({ user, language, signOut, openAdmin }: { user: User; language: Lang; signOut: () => void; openAdmin?: () => void }) {
  const [emails, setEmails] = useState(true); return <><PageIntro title="My Profile" subtitle="Personal settings and testimony." /><div className="profile-grid"><Panel><div className="profile-hero"><UserAvatar user={user} className="profile-avatar" /><div><h2>{user.fullName}</h2><p>{user.plan.toUpperCase()} PLAN</p></div></div><div className="profile-line"><span>Email</span><b>{user.email}</b></div><div className="profile-line"><span>Language</span><b>{LANG_LABELS[language]}</b></div><div className="profile-line"><span>Sign-in method</span><b>{(user.authProvider || "email").toUpperCase()}</b></div></Panel><Panel><h3>Preferences</h3><label className="switch-row"><div><b>Daily prayer emails</b><p>Receive a personalized prayer every day.</p></div><input type="checkbox" checked={emails} onChange={() => setEmails(!emails)} /></label><div className="profile-actions">{openAdmin && <button className="button secondary" onClick={openAdmin}>Open admin dashboard</button>}<button className="button danger" onClick={signOut}>Sign out</button></div></Panel></div></>;
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
      ]);
      const [statsResult, userResult, libraryResult, mentalResult, salvationResult, settingsResult, convoResult, knowledgeResult] = results;

      if (statsResult.status === "fulfilled") setStats(statsResult.value);
      if (userResult.status === "fulfilled") setUsers(userResult.value.users || []);
      if (libraryResult.status === "fulfilled") setLibrary(libraryResult.value || []);
      if (mentalResult.status === "fulfilled") setMental(mentalResult.value || []);
      if (salvationResult.status === "fulfilled") setSalvation(salvationResult.value || []);
      if (settingsResult.status === "fulfilled") setSettings(settingsResult.value || []);
      if (convoResult.status === "fulfilled") setConversations(convoResult.value.conversations || []);
      if (knowledgeResult.status === "fulfilled") setKnowledge(knowledgeResult.value || []);

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

  const settingsMap = Object.fromEntries(settings.map((item) => [item.key, item.value]));
  const salvationUsers = users.filter((user) => user.salvationPrayedAt);
  const activePlanUsers = users.filter((user) => user.subscriptionStatus === "premium");

  return <div className="admin-control">
    <PageIntro title="Admin Management" subtitle="Full ReviveSpring backend control without touching code." action={<button className="button secondary" onClick={loadAdmin}>{loading ? "Refreshing..." : "Refresh"}</button>} />
    <div className="metric-grid admin admin-metrics">
      <Stat value={`${stats.totalUsers ?? "--"}`} label="Users" />
      <Stat value={`${stats.dailyActiveUsers ?? "--"}`} label="Daily active" />
      <Stat value={`${stats.premiumUsers ?? "--"}`} label="Premium" />
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
      <AdminModule title="Revenue status" body="Subscriptions are manageable from user plans. Stripe and RevenueCat reporting can be stored in settings until payment webhooks are added." items={[`Premium users: ${stats.premiumUsers ?? 0}`, `Free users: ${stats.freeUsers ?? 0}`, `Conversion: ${stats.conversionRate ?? 0}%`]} />
    </div>}

    {section === "users" && <div className="main-column">
      <Panel><SectionTitle title="User management" subtitle="Verify, disable, delete, or change subscriptions." /><div className="admin-search"><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name or email" /><button className="button secondary" onClick={loadAdmin}>Search</button></div><AdminUserList users={users} actions={(user) => <><button onClick={() => updateUser(user.id, "/verify", {}, "User verified.")}>Verify</button><button onClick={() => updateUser(user.id, "/disable", { disabled: !user.isDisabled }, user.isDisabled ? "User enabled." : "User disabled.")}>{user.isDisabled ? "Enable" : "Disable"}</button><button onClick={() => updateUser(user.id, "/plan", { plan: user.subscriptionStatus === "premium" ? "free" : "premium" }, "Plan updated.")}>{user.subscriptionStatus === "premium" ? "Downgrade" : "Upgrade"}</button><button onClick={() => updateUser(user.id, "/role", { role: user.role === "admin" ? "user" : "admin" }, user.role === "admin" ? "Admin access removed." : "Admin access granted.")}>{user.role === "admin" ? "Remove admin" : "Make admin"}</button><button className="danger" onClick={() => deleteUser(user.id)}>Delete</button></>} /></Panel>
      <Panel><SectionTitle title="Prayer of Salvation records" subtitle="Users who prayed and saved the date." /><AdminUserList users={salvationUsers} empty="No salvation prayer records yet." /></Panel>
    </div>}

    {section === "content" && <div className="admin-section-grid">
      <Panel><SectionTitle title="Add prayer" subtitle="English and French library content." /><AdminInput label="Category" value={prayerForm.category} onChange={value => setPrayerForm({ ...prayerForm, category: value })} /><AdminInput label="Title EN" value={prayerForm.titleEn} onChange={value => setPrayerForm({ ...prayerForm, titleEn: value })} /><AdminInput label="Title FR" value={prayerForm.titleFr} onChange={value => setPrayerForm({ ...prayerForm, titleFr: value })} /><AdminText label="Prayer EN" value={prayerForm.prayerEn} onChange={value => setPrayerForm({ ...prayerForm, prayerEn: value })} /><AdminText label="Prayer FR" value={prayerForm.prayerFr} onChange={value => setPrayerForm({ ...prayerForm, prayerFr: value })} /><AdminInput label="Verse reference" value={prayerForm.verseRef} onChange={value => setPrayerForm({ ...prayerForm, verseRef: value })} /><AdminInput label="Action step EN" value={prayerForm.actionEn} onChange={value => setPrayerForm({ ...prayerForm, actionEn: value })} /><Toggle label="Premium content" checked={prayerForm.isPremium} onChange={value => setPrayerForm({ ...prayerForm, isPremium: value })} /><button className="button primary full" disabled={!prayerForm.titleEn || !prayerForm.prayerEn} onClick={() => run("Prayer added.", () => api("/admin/library", { method: "POST", body: JSON.stringify(prayerForm) }, token))}>Add prayer</button></Panel>
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
      <Panel><SectionTitle title="Subscription management" subtitle="Upgrade or downgrade users manually." /><AdminUserList users={users} actions={(user) => <button onClick={() => updateUser(user.id, "/plan", { plan: user.subscriptionStatus === "premium" ? "free" : "premium" }, "Plan updated.")}>{user.subscriptionStatus === "premium" ? "Downgrade" : "Upgrade"}</button>} /></Panel>
      <AdminModule title="Revenue reports" body="Use settings to store Stripe and RevenueCat links or report notes until payment webhooks are connected." items={[`Stripe: ${settingsMap.stripe_dashboard_url || "Not set"}`, `RevenueCat: ${settingsMap.revenuecat_dashboard_url || "Not set"}`, `Monthly note: ${settingsMap.monthly_revenue_note || "Not set"}`]} />
      <Panel><SectionTitle title="Payment links and notes" subtitle="Keep non-technical references in the dashboard." /><QuickSettings keys={["stripe_dashboard_url", "revenuecat_dashboard_url", "monthly_revenue_note", "yearly_revenue_note"]} settings={settingsMap} onSave={saveSetting} /></Panel>
    </div>}

    {section === "communication" && <div className="admin-section-grid">
      <Panel><SectionTitle title="Broadcast message" subtitle="Send a prayer email to verified opted-in users." /><AdminText label="Prayer message" value={broadcastForm.prayer} onChange={value => setBroadcastForm({ ...broadcastForm, prayer: value })} /><AdminInput label="Verse" value={broadcastForm.verse} onChange={value => setBroadcastForm({ ...broadcastForm, verse: value })} /><AdminInput label="Reference" value={broadcastForm.ref} onChange={value => setBroadcastForm({ ...broadcastForm, ref: value })} /><AdminInput label="Action step" value={broadcastForm.action} onChange={value => setBroadcastForm({ ...broadcastForm, action: value })} /><button className="button primary full" onClick={() => run("Broadcast sent.", () => api("/admin/email/broadcast", { method: "POST", body: JSON.stringify({ prayer: { mood: "announcement", prayer: broadcastForm.prayer, verse: broadcastForm.verse, ref: broadcastForm.ref, action: broadcastForm.action } }) }, token))}>Send broadcast</button><button className="button secondary full" onClick={() => run("Test email sent.", () => api("/admin/email/test", { method: "POST" }, token))}>Send test email</button></Panel>
      <Panel><SectionTitle title="Reminder messages" subtitle="Edit default prayer reminder copy." /><QuickSettings keys={["daily_reminder_en", "daily_reminder_fr", "weekly_reminder_en", "weekly_reminder_fr", "notification_event_message"]} settings={settingsMap} onSave={saveSetting} /></Panel>
      <AdminModule title="Push notifications" body="Message copy and schedules can be managed here. Actual phone push delivery requires device-token storage and FCM/APNs credentials on the backend." items={["Daily reminder copy", "Weekly reminder copy", "One-time announcement copy"]} />
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
function Stat({ value, label, onClick }: { value: string; label: string; onClick?: () => void }) { return <button type="button" className={`stat ${onClick ? "clickable" : ""}`} onClick={onClick}><b>{value}</b><span>{label}</span></button>; }
function PrayerTile({ title, body, icon, tone, onOpen }: { title: string; body: string; icon: string; tone: string; onOpen?:()=>void }) { return <article className="prayer-tile"><span className={`tile-icon ${tone}`}>{icon}</span><div><h3>{title}</h3><p>{body}</p></div><button title={`Open ${title}`} onClick={onOpen}>â†’</button></article>; }
function MoodModal({ mood, token, refresh, close }: { mood: string; token:string; refresh:()=>Promise<void>; close: () => void }) { const item={title:`Prayer for ${mood}`,body:"Heavenly Father, quiet my heart and fill me with Your peace. Help me take the next faithful step with courage and grace. Amen.",icon:moodIcon(mood),tone:"lime",mood,verse:"Cast all your anxiety on Him because He cares for you.",reference:"1 Peter 5:7"}; return <TimedPrayerModal item={item} token={token} refresh={refresh} close={close}/>; }
function TimedPrayerModal({item,token,refresh,close}:{item:PrayerItem;token:string;refresh:()=>Promise<void>;close:()=>void}){const required=15;const[seconds,setSeconds]=useState(0);const[recorded,setRecorded]=useState(false);useEffect(()=>{const timer=window.setInterval(()=>setSeconds(value=>value+1),1000);return()=>clearInterval(timer)},[]);useEffect(()=>{if(seconds>=required&&!recorded){setRecorded(true);api("/prayers/complete",{method:"POST",body:JSON.stringify({mood:item.mood||"guided",prayer_text:item.body,bible_verse:item.verse,bible_reference:item.reference,action_step:item.action,elapsed_seconds:seconds})},token).then(refresh)}},[seconds,recorded]);return <div className="modal-backdrop" onClick={close}><section className="mood-modal hovering-prayer" onClick={e=>e.stopPropagation()}><button className="modal-close" onClick={close}>Ã—</button><span className={`tile-icon ${item.tone}`}>{item.icon}</span><p className="eyebrow">{item.title}</p><h2>God is with you in this moment.</h2>{item.verse&&<q>{item.verse}</q>}{item.reference&&<b>{item.reference}</b>}<p>{item.body}</p><div className="timer-bar"><i style={{width:`${Math.min(100,(seconds/required)*100)}%`}} /></div><p className="timer-copy">{recorded?"Prayer recorded.":`Stay in this prayer for ${Math.max(0,required-seconds)} more seconds to record it.`}</p></section></div>}
function GoalModal({goal,token,refresh,close}:{goal:Goal;token:string;refresh:()=>Promise<void>;close:()=>void}){const[seconds,setSeconds]=useState(0);const required=goal.durationSeconds||10;useEffect(()=>{const timer=window.setInterval(()=>setSeconds(value=>value+1),1000);return()=>clearInterval(timer)},[]);return <div className="modal-backdrop" onClick={close}><section className="mood-modal" onClick={e=>e.stopPropagation()}><button className="modal-close" onClick={close}>Ã—</button><p className="eyebrow">{goal.kind||"Daily goal"}</p><h2>{goal.text}</h2><p>{goal.content||"Take a quiet moment to complete this activity faithfully."}</p><p className="timer-copy">{seconds>=required?"Ready to mark complete.":`Stay here for ${required-seconds} more seconds.`}</p><button disabled={seconds<required} className="button primary full" onClick={async()=>{await api(`/goals/${goal.id}/complete`,{method:"POST",body:JSON.stringify({elapsed_seconds:seconds})},token);await refresh();close()}}>Complete goal</button></section></div>}
function Field({ label, value, onChange, placeholder, type = "text" }: { label: string; value: string; onChange: (value: string) => void; placeholder: string; type?: string }) { return <label className="field"><span>{label}</span><input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} type={type} /></label>; }
function initials(name?: string) {
  const parts = (name || "Friend").trim().split(/\s+/).filter(Boolean);
  return (parts.length ? parts.map(part => part[0]).join("") : "F").slice(0, 2).toUpperCase();
}
function moodIcon(mood: string) { return mood === "Grateful" ? "â™¡" : mood === "Healing" ? "+" : mood === "Protection" ? "â—‡" : mood.includes("peace") ? "â˜¼" : mood.includes("job") ? "â–¡" : mood.includes("Financial") ? "$" : mood === "Sad" ? "â‰ˆ" : mood === "Confused" ? "?" : "â˜"; }



