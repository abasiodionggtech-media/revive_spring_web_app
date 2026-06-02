import { FormEvent, useEffect, useState } from "react";
import { Navigate, Route, Routes, useNavigate } from "react-router-dom";

type Lang = "en" | "fr";
type AppTab = "home" | "prayers" | "journal" | "goals" | "wellness" | "ai" | "profile" | "admin";
type User = { fullName: string; email: string; language: Lang; plan: string; isAdmin?: boolean };
type Goal = { id: string; text: string; done: boolean };
type JournalEntry = { id: string; body: string; date: string };
type ChatMessage = { role: "assistant" | "user"; content: string };
type SlideKind = "info" | "choice" | "multi" | "statement" | "chart" | "reminder" | "builder" | "commit";
type Slide = { id: string; kind: SlideKind; title: string; body?: string; statement?: string; options?: string[] };

const id = () => Math.random().toString(36).slice(2, 10);
const LANG_LABELS: Record<Lang, string> = { en: "English", fr: "Francais" };
const NAV_ITEMS: { id: AppTab; label: string; icon: string }[] = [
  { id: "home", label: "Home", icon: "⌂" },
  { id: "prayers", label: "Pray", icon: "♡" },
  { id: "journal", label: "Journal", icon: "✎" },
  { id: "goals", label: "Goals", icon: "⚑" },
  { id: "wellness", label: "Wellness", icon: "✿" },
  { id: "ai", label: "AI Companion", icon: "✦" },
  { id: "profile", label: "Profile", icon: "○" },
];
const PRAYER_LIBRARY = [
  { title: "Morning Renewal", body: "Lord, align my heart with peace, wisdom, and courage today.", icon: "☀", tone: "emerald" },
  { title: "Anxiety Support", body: "A quiet prayer for calm breathing and steady faith.", icon: "≈", tone: "lime" },
  { title: "Healing", body: "A hopeful prayer for body, mind, and relationships.", icon: "+", tone: "green" },
  { title: "Family", body: "Cover the people I love with unity and grace.", icon: "♡", tone: "coral" },
];
const MOODS = ["Anxious", "Financial stress", "Sad", "Confused", "Grateful", "Healing", "Need a job", "Protection", "Need peace"];
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
  const [onboarded, setOnboarded] = useStore("rs_onboarded", false);
  const setupPath = !language ? "/language" : !user ? "/auth" : !onboarded ? "/onboarding" : "/app";
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/splash" replace />} />
      <Route path="/splash" element={<SplashPage nextPath={setupPath} />} />
      <Route path="/language" element={<LanguagePage current={language} onSelect={setLanguage} />} />
      <Route path="/auth" element={<AuthPage language={language ?? "en"} onLogin={(nextUser) => { setUser(nextUser); setOnboarded(true); }} />} />
      <Route path="/verify" element={<VerifyPage onVerified={setUser} />} />
      <Route path="/onboarding" element={user ? <OnboardingPage onComplete={() => setOnboarded(true)} /> : <Navigate to="/auth" replace />} />
      <Route path="/app" element={user && onboarded ? <MainApp user={user} setUser={setUser} language={language ?? "en"} /> : <Navigate to={setupPath} replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function SplashPage({ nextPath }: { nextPath: string }) {
  const navigate = useNavigate();
  useEffect(() => {
    const timer = window.setTimeout(() => navigate(nextPath, { replace: true }), 1800);
    return () => window.clearTimeout(timer);
  }, [navigate, nextPath]);
  return <main className="splash-screen">
    <div className="splash-logo"><span>RS</span></div>
    <h1>ReviveSpring</h1>
    <p>Revive Your Spirit. Renew Your Day.</p>
    <div className="splash-loader"><i /></div>
    <button className="link-button" onClick={() => navigate(nextPath, { replace: true })}>Continue</button>
  </main>;
}

function Brand({ compact = false }: { compact?: boolean }) {
  return <div className={`brand ${compact ? "compact" : ""}`}><span className="brand-mark">✦</span><span><b>ReviveSpring</b>{!compact && <small>Faith for every day</small>}</span></div>;
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
      <button className="button primary full" disabled={!current} onClick={() => navigate("/auth")}>Continue <span>→</span></button>
    </div>
  </PublicShell>;
}

function AuthPage({ language, onLogin }: { language: Lang; onLogin: (user: User) => void }) {
  const [signup, setSignup] = useState(false);
  const [name, setName] = useState(""); const [email, setEmail] = useState(""); const [password, setPassword] = useState("");
  const navigate = useNavigate();
  const submit = (e: FormEvent) => {
    e.preventDefault(); const next = { fullName: name.trim() || "Friend", email, language, plan: "Free", isAdmin: email.toLowerCase().includes("admin") };
    if (signup) { sessionStorage.setItem("rs_pending_user", JSON.stringify(next)); navigate("/verify"); }
    else { onLogin(next); navigate("/app"); }
  };
  return <PublicShell><div className="auth-card">
    <Brand /><p className="kicker">Welcome to your quiet space</p><h1>{signup ? "Create your account" : "Welcome back"}</h1>
    <p className="lead">{signup ? "Start a daily rhythm shaped around your faith." : "Continue your prayer and reflection journey."}</p>
    <div className="segmented"><button className={!signup ? "active" : ""} onClick={() => setSignup(false)}>Sign in</button><button className={signup ? "active" : ""} onClick={() => setSignup(true)}>Sign up</button></div>
    <form onSubmit={submit} className="form-stack">
      {signup && <Field label="Full name" value={name} onChange={setName} placeholder="Your full name" />}
      <Field label="Email address" value={email} onChange={setEmail} placeholder="you@example.com" type="email" />
      <Field label="Password" value={password} onChange={setPassword} placeholder="At least 6 characters" type="password" />
      <button className="button primary full" disabled={email.length < 5 || password.length < 6 || (signup && !name.trim())}>{signup ? "Create account" : "Sign in"} <span>→</span></button>
    </form>
    <button className="link-button" onClick={() => setSignup(!signup)}>{signup ? "Already have an account? Sign in" : "New here? Create an account"}</button>
  </div></PublicShell>;
}

function VerifyPage({ onVerified }: { onVerified: (user: User) => void }) {
  const [code, setCode] = useState(""); const navigate = useNavigate();
  const pending = sessionStorage.getItem("rs_pending_user");
  if (!pending) return <Navigate to="/auth" replace />;
  return <PublicShell><div className="auth-card"><Brand /><div className="large-icon">✉</div><p className="kicker">One last step</p><h1>Verify your email</h1>
    <p className="lead">Enter the 6-digit code sent to your inbox. For this preview, any six digits will work.</p>
    <Field label="Verification code" value={code} onChange={setCode} placeholder="000000" />
    <button className="button primary full" disabled={code.length !== 6} onClick={() => { onVerified(JSON.parse(pending) as User); sessionStorage.removeItem("rs_pending_user"); navigate("/onboarding"); }}>Verify and continue <span>→</span></button>
  </div></PublicShell>;
}

function PublicShell({ children }: { children: React.ReactNode }) {
  return <main className="public-shell"><div className="public-aside"><Brand /><div><p className="eyebrow">Revive your spirit. Renew your day.</p><h2>A calmer place to pray, reflect, and grow with purpose.</h2><p>Daily guidance meets real life, one faithful step at a time.</p></div><div className="aside-verse"><span>Daily reflection</span><q>Trust in the Lord with all your heart.</q><b>Proverbs 3:5</b></div></div><div className="public-main">{children}</div></main>;
}

function OnboardingPage({ onComplete }: { onComplete: () => void }) {
  const [index, setIndex] = useState(0); const [answers, setAnswers] = useState<Record<string, string[]>>({}); const [committed, setCommitted] = useState(false); const navigate = useNavigate();
  const slide = ONBOARDING[index], selected = answers[slide.id] || [];
  const needsAnswer = ["choice", "multi", "statement", "builder"].includes(slide.kind);
  const canContinue = slide.kind === "commit" ? committed : !needsAnswer || selected.length > 0;
  const select = (option: string) => setAnswers(prev => ({ ...prev, [slide.id]: slide.kind === "multi" ? (selected.includes(option) ? selected.filter(x => x !== option) : [...selected, option]) : [option] }));
  return <main className="onboarding-shell">
    <header className="onboarding-header"><Brand compact /><div className="onboarding-progress"><div><span>About you</span><b>{index + 1} / {ONBOARDING.length}</b></div><div className="progress"><i style={{ width: `${((index + 1) / ONBOARDING.length) * 100}%` }} /></div></div><button className="icon-button" onClick={() => setIndex(Math.max(0, index - 1))} disabled={index === 0} title="Previous step">←</button></header>
    <section className="onboarding-content"><p className="kicker">Your personal path</p><h1>{slide.title}</h1>{slide.body && <p className="onboarding-lead">{slide.body}</p>}<SlideContent slide={slide} selected={selected} select={select} committed={committed} setCommitted={setCommitted} /></section>
    <footer className="onboarding-footer"><button className="button ghost" onClick={() => setIndex(Math.max(0, index - 1))} disabled={index === 0}>Back</button><button className="button primary" disabled={!canContinue} onClick={() => { if (index === ONBOARDING.length - 1) { onComplete(); navigate("/app"); } else setIndex(index + 1); }}>{index === ONBOARDING.length - 1 ? "Enter ReviveSpring" : "Continue"} <span>→</span></button></footer>
  </main>;
}

function SlideContent({ slide, selected, select, committed, setCommitted }: { slide: Slide; selected: string[]; select: (value: string) => void; committed: boolean; setCommitted: (value: boolean) => void }) {
  if (slide.kind === "chart") return <div className="chart"><div style={{ height: "92%" }}><i /><span>Spiritual<br />growth</span></div><div style={{ height: "46%" }}><i /><span>Healing</span></div><div style={{ height: "60%" }}><i /><span>Decisions</span></div><div style={{ height: "74%" }}><i /><span>Relationships</span></div></div>;
  if (slide.kind === "reminder") return <div className="reminder-card"><span className="large-icon">◷</span><h3>09 : 00</h3><p>Daily reminders help you stay connected to what matters most.</p></div>;
  if (slide.kind === "commit") return <div className="commit-card"><p>A few moments each day with God's Word.<br />A safe space to reflect and recharge.</p><button className={`commit-button ${committed ? "done" : ""}`} onClick={() => setCommitted(true)}>{committed ? "✓" : "☝"}</button><b>{committed ? "Committed" : "Tap to commit"}</b></div>;
  if (slide.kind === "builder") return <div className="builder-card"><span>Personalizing your path</span><div className="progress"><i style={{ width: "72%" }} /></div><h3>{slide.statement}</h3><OptionGrid options={slide.options || []} selected={selected} select={select} /></div>;
  if (slide.kind === "statement") return <div><blockquote>{slide.statement}</blockquote><OptionGrid options={slide.options || []} selected={selected} select={select} /></div>;
  if (slide.options) return <OptionGrid options={slide.options} selected={selected} select={select} multi={slide.kind === "multi"} />;
  return <div className="story-grid"><article><b>Carol</b><span>★★★★★</span><p>"I wake up filled with joy and purpose."</p></article><article><b>Alex</b><span>★★★★★</span><p>"This has helped me build a real relationship with God."</p></article><article><b>Mike</b><span>★★★★★</span><p>"Spiritual growth now feels possible each day."</p></article></div>;
}
function OptionGrid({ options, selected, select, multi }: { options: string[]; selected: string[]; select: (value: string) => void; multi?: boolean }) {
  return <div className="option-grid">{options.map(option => <button key={option} className={selected.includes(option) ? "selected" : ""} onClick={() => select(option)}><span>{option}</span><i>{selected.includes(option) ? "✓" : multi ? "□" : "○"}</i></button>)}</div>;
}

function MainApp({ user, setUser, language }: { user: User; setUser: (user: User | null) => void; language: Lang }) {
  const [tab, setTab] = useState<AppTab>("home");
  const [goals, setGoals] = useStore<Goal[]>("rs_goals", [{ id: id(), text: "Pray for family", done: true }, { id: id(), text: "Read Psalm 23", done: false }, { id: id(), text: "Write one gratitude note", done: false }]);
  const [journal, setJournal] = useStore<JournalEntry[]>("rs_journal", [{ id: id(), body: "Thankful for peace this morning.", date: "Today" }, { id: id(), body: "Praying for wisdom and courage.", date: "Yesterday" }]);
  const title = NAV_ITEMS.find(item => item.id === tab)?.label || "Admin";
  return <div className="app-shell"><aside className="sidebar"><Brand /><nav>{NAV_ITEMS.map(item => <NavButton item={item} active={tab === item.id} onClick={() => setTab(item.id)} key={item.id} />)}</nav><button className="sidebar-profile" onClick={() => setTab("profile")}><span>{initials(user.fullName)}</span><div><b>{user.fullName}</b><small>{user.plan} plan</small></div></button></aside>
    <div className="workspace"><header className="app-header"><div><p className="eyebrow">{new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}</p><h1>{title}</h1></div><button className="avatar-button" onClick={() => setTab("profile")} title="Open profile">{initials(user.fullName)}</button></header>
      <div className="screen-wrap">
        {tab === "home" && <HomeScreen user={user} goals={goals} openAi={() => setTab("ai")} />}
        {tab === "prayers" && <PrayerScreen openAi={() => setTab("ai")} />}
        {tab === "journal" && <JournalScreen entries={journal} setEntries={setJournal} />}
        {tab === "goals" && <GoalsScreen goals={goals} setGoals={setGoals} />}
        {tab === "wellness" && <WellnessScreen />}
        {tab === "ai" && <AiScreen />}
        {tab === "profile" && <ProfileScreen user={user} language={language} signOut={() => setUser(null)} openAdmin={user.isAdmin ? () => setTab("admin") : undefined} />}
        {tab === "admin" && <AdminScreen goals={goals} entries={journal} />}
      </div>
    </div><nav className="mobile-nav">{NAV_ITEMS.map(item => <NavButton item={item} active={tab === item.id} onClick={() => setTab(item.id)} key={item.id} />)}</nav></div>;
}

function NavButton({ item, active, onClick }: { item: { label: string; icon: string }; active: boolean; onClick: () => void }) { return <button className={active ? "nav-item active" : "nav-item"} onClick={onClick}><span>{item.icon}</span><b>{item.label}</b></button>; }
function HomeScreen({ user, goals, openAi }: { user: User; goals: Goal[]; openAi: () => void }) {
  const [mood, setMood] = useState<string | null>(null), done = goals.filter(g => g.done).length;
  return <><section className="welcome-row"><div><p className="eyebrow">A fresh spring for your spirit today</p><h2>Good morning, {user.fullName.split(" ")[0]}</h2></div><button className="button primary" onClick={openAi}>✦ Ask AI Companion</button></section>
    <div className="dashboard-grid"><div className="main-column"><article className="verse-card"><p>Verse of the day</p><q>I can do all things through Christ who strengthens me.</q><b>Philippians 4:13</b></article><section><SectionTitle title="How are you feeling?" subtitle="Choose a feeling for a personal prayer." /><div className="mood-grid">{MOODS.map(x => <button onClick={() => setMood(x)} key={x}><span>{moodIcon(x)}</span>{x}</button>)}</div></section></div>
      <div className="side-column"><div className="stat-grid"><Stat value="18" label="Prayers" /><Stat value="7" label="Day streak" /><Stat value={`${done}`} label="Goals done" /></div><Panel><SectionTitle title="Today's goals" subtitle={`${done} of ${goals.length} complete`} />{goals.map(goal => <div className="mini-goal" key={goal.id}><span className={goal.done ? "done" : ""}>{goal.done ? "✓" : ""}</span><p>{goal.text}</p></div>)}</Panel></div></div>{mood && <MoodModal mood={mood} close={() => setMood(null)} />}</>;
}
function PrayerScreen({ openAi }: { openAi: () => void }) { return <><PageIntro title="Prayer Library" subtitle="Saved prayers and guided moments for every season." action={<button className="button primary" onClick={openAi}>✦ Ask AI Companion</button>} /><div className="library-grid">{PRAYER_LIBRARY.map(p => <PrayerTile {...p} key={p.title} />)}</div></>; }
function JournalScreen({ entries, setEntries }: { entries: JournalEntry[]; setEntries: (entries: JournalEntry[]) => void }) {
  const [text, setText] = useState(""); return <><PageIntro title="Prayer Journal" subtitle="Record requests, make room for reflection, and celebrate answers." /><Panel className="journal-compose"><textarea value={text} onChange={e => setText(e.target.value)} placeholder="What are you carrying today?" /><button className="button primary" onClick={() => { if (text.trim()) { setEntries([{ id: id(), body: text.trim(), date: "Today" }, ...entries]); setText(""); } }}>+ Add entry</button></Panel><div className="entry-list">{entries.map(entry => <Panel key={entry.id}><small>{entry.date}</small><p>{entry.body}</p></Panel>)}</div></>;
}
function GoalsScreen({ goals, setGoals }: { goals: Goal[]; setGoals: (goals: Goal[]) => void }) {
  const [text, setText] = useState(""); const toggle = (goalId: string) => setGoals(goals.map(goal => goal.id === goalId ? { ...goal, done: !goal.done } : goal));
  return <><PageIntro title="Daily Goals" subtitle="Small faithful steps, beautifully tracked." /><Panel className="goal-compose"><input value={text} onChange={e => setText(e.target.value)} placeholder="Add a new daily goal" /><button className="button primary" onClick={() => { if (text.trim()) { setGoals([...goals, { id: id(), text: text.trim(), done: false }]); setText(""); } }}>+ Add goal</button></Panel><div className="goal-list">{goals.map(goal => <label className={goal.done ? "goal-row complete" : "goal-row"} key={goal.id}><input type="checkbox" checked={goal.done} onChange={() => toggle(goal.id)} /><span>{goal.text}</span></label>)}</div></>;
}
function WellnessScreen() { return <><PageIntro title="Spiritual Wellness" subtitle="A gentle overview of your faith rhythm." /><div className="wellness-grid"><Panel className="score-panel"><div className="score-ring"><span>82%</span></div><div><p className="eyebrow">Your wellness score</p><h2>Growing steadily</h2><p>Prayer, goals, gratitude, and rest are moving in a strong direction.</p></div></Panel><div className="metric-grid"><Stat value="82%" label="Peace" /><Stat value="64%" label="Rest" /><Stat value="7 days" label="Consistency" /></div></div><PrayerTile title="Guided Affirmation" body="I am loved, held, restored, and strengthened for today." icon="♡" tone="green" /></>; }
function AiScreen() {
  const [messages, setMessages] = useState<ChatMessage[]>([{ role: "assistant", content: "Hello. I am your Bible and prayer AI. Ask me for a prayer, verse, or encouragement." }]); const [input, setInput] = useState(""); const [typing, setTyping] = useState(false);
  const send = (suggestion?: string) => { const value = (suggestion || input).trim(); if (!value || typing) return; setMessages(prev => [...prev, { role: "user", content: value }]); setInput(""); setTyping(true); setTimeout(() => { setMessages(prev => [...prev, { role: "assistant", content: `Lord, meet me in this moment. Bring peace, wisdom, and steady hope as I pray about ${value.toLowerCase()}. Remind me that I am held by Your grace. Amen.` }]); setTyping(false); }, 650); };
  return <><PageIntro title="AI Prayer Companion" subtitle="A signed-in space for prayer, Scripture, and reflection." /><div className="suggestions">{["Give me a prayer for anxiety", "Bible verse for strength", "Prayer for healing", "How can I strengthen my faith?"].map(x => <button onClick={() => send(x)} key={x}>{x}</button>)}</div><Panel className="chat-panel"><div className="messages">{messages.map((m, i) => <p className={`message ${m.role}`} key={i}>{m.content}</p>)}{typing && <p className="typing">Writing a thoughtful response...</p>}</div><div className="chat-compose"><textarea value={input} onChange={e => setInput(e.target.value)} placeholder="Ask about Bible or prayer" /><button className="button primary" onClick={() => send()}>Send →</button></div></Panel></>;
}
function ProfileScreen({ user, language, signOut, openAdmin }: { user: User; language: Lang; signOut: () => void; openAdmin?: () => void }) {
  const [emails, setEmails] = useState(true); return <><PageIntro title="My Profile" subtitle="Personal settings and testimony." /><div className="profile-grid"><Panel><div className="profile-hero"><span>{initials(user.fullName)}</span><div><h2>{user.fullName}</h2><p>{user.plan.toUpperCase()} PLAN</p></div></div><div className="profile-line"><span>Email</span><b>{user.email}</b></div><div className="profile-line"><span>Language</span><b>{LANG_LABELS[language]}</b></div></Panel><Panel><h3>Preferences</h3><label className="switch-row"><div><b>Daily prayer emails</b><p>Receive a personalized prayer every day.</p></div><input type="checkbox" checked={emails} onChange={() => setEmails(!emails)} /></label><div className="profile-actions">{openAdmin && <button className="button secondary" onClick={openAdmin}>Open admin dashboard</button>}<button className="button danger" onClick={signOut}>Sign out</button></div></Panel></div></>;
}
function AdminScreen({ goals, entries }: { goals: Goal[]; entries: JournalEntry[] }) { return <><PageIntro title="Admin Dashboard" subtitle="Platform overview for the ReviveSpring team." /><div className="metric-grid admin"><Stat value="1,248" label="Users" /><Stat value="4,806" label="Prayers" /><Stat value={`${entries.length}`} label="Journal entries" /><Stat value={`${goals.length}`} label="Goals" /></div><Panel><SectionTitle title="System overview" subtitle="Connected services and content status." /><div className="admin-table"><p><b>User accounts</b><span>Healthy</span></p><p><b>Prayer library</b><span>4 active collections</span></p><p><b>AI conversations</b><span>Available</span></p></div></Panel></>; }

function PageIntro({ title, subtitle, action }: { title: string; subtitle: string; action?: React.ReactNode }) { return <header className="page-intro"><div><p className="eyebrow">ReviveSpring</p><h2>{title}</h2><p>{subtitle}</p></div>{action}</header>; }
function SectionTitle({ title, subtitle }: { title: string; subtitle?: string }) { return <div className="section-title"><h3>{title}</h3>{subtitle && <p>{subtitle}</p>}</div>; }
function Panel({ children, className = "" }: { children: React.ReactNode; className?: string }) { return <section className={`panel ${className}`}>{children}</section>; }
function Stat({ value, label }: { value: string; label: string }) { return <div className="stat"><b>{value}</b><span>{label}</span></div>; }
function PrayerTile({ title, body, icon, tone }: { title: string; body: string; icon: string; tone: string }) { return <article className="prayer-tile"><span className={`tile-icon ${tone}`}>{icon}</span><div><h3>{title}</h3><p>{body}</p></div><button title={`Open ${title}`}>→</button></article>; }
function MoodModal({ mood, close }: { mood: string; close: () => void }) { return <div className="modal-backdrop" onClick={close}><section className="mood-modal" onClick={e => e.stopPropagation()}><button className="modal-close" onClick={close}>×</button><span className="tile-icon lime">{moodIcon(mood)}</span><p className="eyebrow">A prayer for {mood.toLowerCase()}</p><h2>God is with you in this moment.</h2><q>Cast all your anxiety on Him because He cares for you.</q><b>1 Peter 5:7</b><p>Heavenly Father, quiet my heart and fill me with Your peace. Help me take the next faithful step with courage and grace. Amen.</p><button className="button primary full" onClick={close}>Save this prayer</button></section></div>; }
function Field({ label, value, onChange, placeholder, type = "text" }: { label: string; value: string; onChange: (value: string) => void; placeholder: string; type?: string }) { return <label className="field"><span>{label}</span><input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} type={type} /></label>; }
function initials(name: string) { return name.split(" ").map(part => part[0]).join("").slice(0, 2).toUpperCase(); }
function moodIcon(mood: string) { return mood === "Grateful" ? "♡" : mood === "Healing" ? "+" : mood === "Protection" ? "◇" : mood.includes("peace") ? "☼" : mood.includes("job") ? "□" : mood.includes("Financial") ? "$" : mood === "Sad" ? "≈" : mood === "Confused" ? "?" : "☁"; }
