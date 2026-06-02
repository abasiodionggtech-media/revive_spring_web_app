import { useEffect, useMemo, useState } from 'react';
import { Navigate, Route, Routes, useNavigate } from 'react-router-dom';

export type Lang = 'en' | 'fr';

type User = {
  fullName: string;
  email: string;
  language: Lang;
  subscriptionStatus: string;
  onboardingData?: Record<string, string>;
};

type Goal = {
  id: string;
  title: string;
  completed: boolean;
};

type JournalEntry = {
  id: string;
  title: string;
  body: string;
  date: string;
};

type PrayerRequest = {
  id: string;
  title: string;
  content: string;
  mood: string;
  submittedAt: string;
};

type Analytics = {
  visitCount: number;
  prayerCount: number;
  completedGoals: number;
  moodFrequency: Record<string, number>;
};

const LANG_LABELS: Record<Lang, string> = {
  en: 'English',
  fr: 'Français',
};

const ONBOARDING_SLIDES = [
  {
    id: 'journey',
    title: 'Start your renewal journey',
    prompt: 'How did you hear about Revive Spring?',
    type: 'text',
    placeholder: 'A friend, social media, church…',
  },
  {
    id: 'focus',
    title: 'Your wellness focus',
    prompt: 'What area do you want to strengthen most?',
    type: 'radio',
    options: ['Prayer life', 'Daily rhythms', 'Spiritual habits', 'Mindset'],
  },
  {
    id: 'stories',
    title: 'Your story matters',
    prompt: 'What would you like to say in your testimony?',
    type: 'text',
    placeholder: 'Your transformation story…',
  },
  {
    id: 'commitment',
    title: 'Commit to growth',
    prompt: 'Choose the pace that fits your season',
    type: 'radio',
    options: ['Daily check-ins', 'Weekly progress', 'One step at a time'],
  },
];

const MOODS = ['Grateful', 'Peaceful', 'Anxious', 'Hopeful', 'Blessed', 'Rested'];
const DAILY_VERSE = '“I can do all things through Christ who strengthens me.” — Philippians 4:13';

const createId = () => Math.random().toString(36).slice(2, 10);

function useLocalStorageState<T>(key: string, initialValue: T) {
  const [state, setState] = useState<T>(() => {
    const saved = localStorage.getItem(key);
    return saved ? (JSON.parse(saved) as T) : initialValue;
  });

  useEffect(() => {
    localStorage.setItem(key, JSON.stringify(state));
  }, [key, state]);

  return [state, setState] as const;
}

function App() {
  const [language, setLanguage] = useLocalStorageState<Lang>('rs_lang', 'en');
  const [onboarded, setOnboarded] = useLocalStorageState<boolean>('rs_onboarded', false);
  const [user, setUser] = useLocalStorageState<User | null>('rs_user', null);
  const [pendingUser, setPendingUser] = useLocalStorageState<User | null>('rs_pending_user', null);

  const authReady = useMemo(() => !!user, [user]);
  const partialSetup = !language ? '/language' : !onboarded ? '/onboarding' : '/auth';

  return (
    <Routes>
      <Route
        path="/"
        element={
          <Navigate to={authReady ? '/app' : partialSetup} replace />
        }
      />
      <Route
        path="/language"
        element={
          <LanguagePage
            language={language}
            onSelect={(lang) => setLanguage(lang)}
            navigateTo={onboarded ? '/auth' : '/onboarding'}
          />
        }
      />
      <Route
        path="/onboarding"
        element={
          <OnboardingPage
            language={language}
            onComplete={(answers) => {
              setOnboarded(true);
              if (user) {
                setUser({ ...user, onboardingData: answers });
              }
            }}
          />
        }
      />
      <Route
        path="/auth"
        element={
          <AuthPage
            language={language}
            onLogin={(currentUser) => setUser(currentUser)}
            onRegister={(pending) => setPendingUser(pending)}
          />
        }
      />
      <Route
        path="/verify"
        element={
          <VerifyPage
            pendingUser={pendingUser}
            onVerified={(verifiedUser) => {
              setUser(verifiedUser);
              setPendingUser(null);
            }}
          />
        }
      />
      <Route
        path="/app/*"
        element={
          authReady ? (
            <MainApp
              user={user!}
              onSignOut={() => setUser(null)}
              language={language}
            />
          ) : (
            <Navigate to={partialSetup} replace />
          )
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function LanguagePage({ language, onSelect, navigateTo }: { language: Lang; onSelect: (lang: Lang) => void; navigateTo: string }) {
  const navigate = useNavigate();

  return (
    <div className="page glass-panel centered-shell">
      <div className="hero-card">
        <h1>Revive Spring</h1>
        <p>Choose your language to begin a restful, goal-driven wellness path.</p>
      </div>
      <div className="button-group">
        {(['en', 'fr'] as Lang[]).map((lang) => (
          <button
            key={lang}
            onClick={() => onSelect(lang)}
            className={language === lang ? 'primary-button' : 'secondary-button'}
          >
            {LANG_LABELS[lang]}
          </button>
        ))}
      </div>
      <button className="primary-button" onClick={() => navigate(navigateTo)}>
        Continue
      </button>
    </div>
  );
}

function OnboardingPage({ language, onComplete }: { language: Lang; onComplete: (answers: Record<string, string>) => void }) {
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const navigate = useNavigate();
  const slide = ONBOARDING_SLIDES[index];

  const answer = answers[slide.id] ?? '';
  const canContinue = answer.length > 0;

  return (
    <div className="page centered-shell glass-panel">
      <div className="section-header">
        <h2>{slide.title}</h2>
        <p>{slide.prompt}</p>
      </div>
      <div className="input-block">
        {slide.type === 'text' ? (
          <textarea
            value={answer}
            onChange={(event) => setAnswers({ ...answers, [slide.id]: event.target.value })}
            placeholder={slide.placeholder}
          />
        ) : (
          <div className="choice-grid">
            {slide.options?.map((option) => (
              <button
                key={option}
                type="button"
                className={answer === option ? 'choice-button active' : 'choice-button'}
                onClick={() => setAnswers({ ...answers, [slide.id]: option })}
              >
                {option}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="nav-row">
        {index > 0 && (
          <button className="secondary-button" onClick={() => setIndex(index - 1)}>
            Back
          </button>
        )}
        <button
          className="primary-button"
          onClick={() => {
            if (index + 1 < ONBOARDING_SLIDES.length) {
              setIndex(index + 1);
            } else {
              onComplete(answers);
              navigate('/auth');
            }
          }}
          disabled={!canContinue}
        >
          {index + 1 < ONBOARDING_SLIDES.length ? 'Next' : 'Finish'}
        </button>
      </div>
      <div className="progress-dots">
        {ONBOARDING_SLIDES.map((_, idx) => (
          <span key={idx} className={idx === index ? 'dot active' : 'dot'} />
        ))}
      </div>
    </div>
  );
}

function AuthPage({ language, onLogin, onRegister }: { language: Lang; onLogin: (user: User) => void; onRegister: (pending: User) => void }) {
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const navigate = useNavigate();

  return (
    <div className="page centered-shell glass-panel">
      <div className="section-header">
        <h2>{mode === 'login' ? 'Welcome back' : 'Create your account'}</h2>
        <p>{mode === 'login' ? 'Sign in to continue your journey.' : 'Register to save your prayers, journal, and goals.'}</p>
      </div>
      <div className="input-block">
        {mode === 'register' && (
          <input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Full name" />
        )}
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email address" />
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" />
      </div>
      <button
        className="primary-button"
        onClick={() => {
          if (mode === 'login') {
            onLogin({
              fullName: fullName || 'Friend',
              email,
              language,
              subscriptionStatus: 'Free',
            });
            navigate('/app');
          } else {
            onRegister({
              fullName: fullName || 'Friend',
              email,
              language,
              subscriptionStatus: 'Free',
            });
            navigate('/verify');
          }
        }}
        disabled={!email || !password || (mode === 'register' && !fullName)}
      >
        {mode === 'login' ? 'Sign In' : 'Verify Email'}
      </button>
      <div className="toggle-row">
        <p>{mode === 'login' ? "Don't have an account?" : 'Already registered?'}</p>
        <button className="text-button" onClick={() => setMode(mode === 'login' ? 'register' : 'login')}>
          {mode === 'login' ? 'Register' : 'Sign in'}
        </button>
      </div>
    </div>
  );
}

function VerifyPage({ pendingUser, onVerified }: { pendingUser: User | null; onVerified: (user: User) => void }) {
  const [code, setCode] = useState('');
  const navigate = useNavigate();

  return (
    <div className="page centered-shell glass-panel">
      <div className="section-header">
        <h2>Email verification</h2>
        <p>Enter the 6-digit code sent to your email.</p>
      </div>
      <div className="input-block">
        <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="123456" />
      </div>
      <button
        className="primary-button"
        onClick={() => {
          if (pendingUser) {
            onVerified(pendingUser);
            navigate('/app');
          }
        }}
        disabled={code.length < 6 || !pendingUser}
      >
        Confirm
      </button>
      <button className="secondary-button" onClick={() => navigate('/auth')}>
        Back to sign in
      </button>
    </div>
  );
}

function MainApp({ user, onSignOut, language }: { user: User; onSignOut: () => void; language: Lang }) {
  const [index, setIndex] = useState(0);
  const [goals, setGoals] = useLocalStorageState<Goal[]>('rs_goals', [
    { id: createId(), title: 'Read a verse', completed: false },
    { id: createId(), title: 'Write a gratitude note', completed: true },
  ]);
  const [journalEntries, setJournalEntries] = useLocalStorageState<JournalEntry[]>('rs_journal', [
    { id: createId(), title: 'Morning prayer', body: 'I am grateful for another day of hope.', date: 'Today' },
  ]);
  const [prayers, setPrayers] = useLocalStorageState<PrayerRequest[]>('rs_prayers', [
    {
      id: createId(),
      title: 'Prayer for peace',
      content: 'Please pray for calm in my busy season.',
      mood: 'Anxious',
      submittedAt: 'Today',
    },
  ]);

  const analytics = useMemo<Analytics>(() => {
    const moodFrequency = prayers.reduce<Record<string, number>>((acc, request) => {
      acc[request.mood] = (acc[request.mood] || 0) + 1;
      return acc;
    }, {});

    return {
      visitCount: 14,
      prayerCount: prayers.length,
      completedGoals: goals.filter((goal) => goal.completed).length,
      moodFrequency,
    };
  }, [goals, prayers]);

  const tabs = [
    { label: 'Home', icon: '🏠' },
    { label: 'Prayers', icon: '🙏' },
    { label: 'Journal', icon: '📔' },
    { label: 'Goals', icon: '🎯' },
    { label: 'Analytics', icon: '📊' },
    { label: 'Profile', icon: '👤' },
  ] as const;

  return (
    <div className="app-shell">
      <header className="top-bar">
        <div>
          <p className="eyebrow">Good {new Date().getHours() < 12 ? 'morning' : 'evening'}, {user.fullName.split(' ')[0]}</p>
          <h1>Welcome back</h1>
        </div>
        <button className="icon-button" onClick={onSignOut} title="Sign out">
          ✕
        </button>
      </header>

      <main className="content-pane">
        {index === 0 && (
          <section>
            <div className="hero-card">
              <p className="eyebrow">Daily verse</p>
              <h2>{DAILY_VERSE}</h2>
            </div>
            <div className="stats-grid">
              <div className="stat-card">
                <p>Prayers</p>
                <strong>{analytics.prayerCount}</strong>
              </div>
              <div className="stat-card">
                <p>Goals</p>
                <strong>{analytics.completedGoals}</strong>
              </div>
              <div className="stat-card">
                <p>Visits</p>
                <strong>{analytics.visitCount}</strong>
              </div>
            </div>
            <div className="section-header">
              <h2>How are you feeling?</h2>
            </div>
            <div className="mood-grid">
              {MOODS.map((mood) => (
                <button key={mood} className="choice-button">
                  {mood}
                </button>
              ))}
            </div>
          </section>
        )}

        {index === 1 && (
          <section>
            <div className="section-header">
              <h2>Prayer requests</h2>
              <p>Send your next prayer into the spring.</p>
            </div>
            <PrayerForm onSubmit={(title, content, mood) => setPrayers([{ id: createId(), title, content, mood, submittedAt: 'Now' }, ...prayers])} />
            <div className="stacked-list">
              {prayers.map((request) => (
                <article key={request.id} className="card">
                  <h3>{request.title}</h3>
                  <p>{request.content}</p>
                  <div className="card-footer">
                    <span>{request.mood}</span>
                    <span>{request.submittedAt}</span>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}

        {index === 2 && (
          <section>
            <div className="section-header">
              <h2>Journal</h2>
              <p>Capture gratitude, prayers, and daily wins.</p>
            </div>
            <JournalForm onSubmit={(title, body) => setJournalEntries([{ id: createId(), title, body, date: 'Today' }, ...journalEntries])} />
            <div className="stacked-list">
              {journalEntries.map((entry) => (
                <article key={entry.id} className="card">
                  <h3>{entry.title}</h3>
                  <p>{entry.body}</p>
                  <div className="card-footer">
                    <span>{entry.date}</span>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}

        {index === 3 && (
          <section>
            <div className="section-header">
              <h2>Goals</h2>
              <p>Track your next steps and celebrate every completion.</p>
            </div>
            <GoalForm onSubmit={(title) => setGoals([{ id: createId(), title, completed: false }, ...goals])} />
            <div className="stacked-list">
              {goals.map((goal) => (
                <label key={goal.id} className={`goal-row ${goal.completed ? 'completed' : ''}`}>
                  <input
                    type="checkbox"
                    checked={goal.completed}
                    onChange={() => setGoals(goals.map((item) => (item.id === goal.id ? { ...item, completed: !item.completed } : item)))}
                  />
                  <span>{goal.title}</span>
                </label>
              ))}
            </div>
          </section>
        )}

        {index === 4 && (
          <section>
            <div className="section-header">
              <h2>Analytics</h2>
              <p>Review prayer momentum, mood trends, and goal progress.</p>
            </div>
            <div className="stats-grid">
              <div className="stat-card">
                <p>Visitor count</p>
                <strong>{analytics.visitCount}</strong>
              </div>
              <div className="stat-card">
                <p>Prayers submitted</p>
                <strong>{analytics.prayerCount}</strong>
              </div>
              <div className="stat-card">
                <p>Goals completed</p>
                <strong>{analytics.completedGoals}</strong>
              </div>
            </div>
            <div className="section-header">
              <h3>Mood trend</h3>
            </div>
            <div className="mood-grid">
              {Object.entries(analytics.moodFrequency).map(([mood, count]) => (
                <div key={mood} className="stat-card">
                  <p>{mood}</p>
                  <strong>{count}</strong>
                </div>
              ))}
            </div>
          </section>
        )}

        {index === 5 && (
          <section>
            <div className="section-header">
              <h2>Profile</h2>
              <p>Manage your account and continue your spiritual rhythm.</p>
            </div>
            <div className="card">
              <p className="eyebrow">Name</p>
              <strong>{user.fullName}</strong>
              <p className="eyebrow">Email</p>
              <strong>{user.email}</strong>
              <p className="eyebrow">Language</p>
              <strong>{LANG_LABELS[language]}</strong>
            </div>
          </section>
        )}
      </main>

      <footer className="bottom-nav">
        {tabs.map((item, idx) => (
          <button key={item.label} className={index === idx ? 'nav-button active' : 'nav-button'} onClick={() => setIndex(idx)}>
            <span>{item.icon}</span>
            <span>{item.label}</span>
          </button>
        ))}
      </footer>
    </div>
  );
}

function PrayerForm({ onSubmit }: { onSubmit: (title: string, content: string, mood: string) => void }) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [mood, setMood] = useState('Grateful');

  return (
    <div className="card input-block">
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Prayer title" />
      <textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="Write your prayer request" />
      <div className="choice-grid">
        {MOODS.map((option) => (
          <button key={option} type="button" className={mood === option ? 'choice-button active' : 'choice-button'} onClick={() => setMood(option)}>
            {option}
          </button>
        ))}
      </div>
      <button className="primary-button" onClick={() => { onSubmit(title, content, mood); setTitle(''); setContent(''); }} disabled={!title || !content}>
        Send prayer
      </button>
    </div>
  );
}

function JournalForm({ onSubmit }: { onSubmit: (title: string, body: string) => void }) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');

  return (
    <div className="card input-block">
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Entry title" />
      <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Write your reflection" />
      <button className="primary-button" onClick={() => { onSubmit(title, body); setTitle(''); setBody(''); }} disabled={!title || !body}>
        Save entry
      </button>
    </div>
  );
}

function GoalForm({ onSubmit }: { onSubmit: (title: string) => void }) {
  const [title, setTitle] = useState('');

  return (
    <div className="card input-block">
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="New goal" />
      <button className="primary-button" onClick={() => { onSubmit(title); setTitle(''); }} disabled={!title}>
        Add goal
      </button>
    </div>
  );
}

export default App;
