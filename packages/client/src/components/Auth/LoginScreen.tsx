import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../../api/client';
import { AppLogo } from '../AppLogo';
import { useAuthStore } from '../../store/authStore';

export function LoginScreen() {
  const { t } = useTranslation();
  const setSession = useAuthStore((s) => s.setSession);
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const submit = async () => {
    setError(null);
    setPending(true);
    try {
      if (mode === 'register') {
        const data = await api.register({
          email,
          password,
          displayName: displayName.trim() || email.split('@')[0]!,
        });
        setSession(data.token, {
          typ: 'member',
          id: data.user.id,
          email: data.user.email,
          displayName: data.user.displayName,
        });
      } else {
        const data = await api.login({ email, password });
        setSession(data.token, {
          typ: 'member',
          id: data.user.id,
          email: data.user.email,
          displayName: data.user.displayName,
        });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : t('auth.error'));
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-surface-base px-4 py-8">
      <div className="mb-6">
        <AppLogo className="mx-auto h-14 w-14" />
      </div>
      <div className="w-full max-w-sm rounded-2xl border border-edge-subtle bg-surface-panel p-6 shadow-elevated">
        <h1 className="text-xl font-semibold text-fg">
          {mode === 'login' ? t('auth.title') : t('auth.registerTitle')}
        </h1>
        <div className="mt-4 flex flex-col gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-fg-subtle">{t('auth.email')}</span>
            <input
              type="email"
              autoComplete="email"
              className="rounded-xl border border-edge bg-surface-base px-3 py-2 text-sm text-fg placeholder:text-fg-subtle focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-fg-subtle">{t('auth.password')}</span>
            <input
              type="password"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              className="rounded-xl border border-edge bg-surface-base px-3 py-2 text-sm text-fg placeholder:text-fg-subtle focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          {mode === 'register' && (
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-fg-subtle">
                {t('auth.displayName')}
              </span>
              <input
                type="text"
                autoComplete="name"
                className="rounded-xl border border-edge bg-surface-base px-3 py-2 text-sm text-fg placeholder:text-fg-subtle focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
              />
            </label>
          )}
          {error && (
            <p className="text-sm text-danger whitespace-pre-wrap">{error}</p>
          )}
          <button
            type="button"
            disabled={pending || !email || !password}
            onClick={() => void submit()}
            className="mt-1 rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-accent-hover disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            {pending
              ? t('auth.loading')
              : mode === 'login'
                ? t('auth.signIn')
                : t('auth.signUp')}
          </button>
          <button
            type="button"
            className="text-sm text-fg-secondary underline-offset-2 hover:underline"
            onClick={() => {
              setMode(mode === 'login' ? 'register' : 'login');
              setError(null);
            }}
          >
            {mode === 'login' ? t('auth.toggleRegister') : t('auth.toggleLogin')}
          </button>
        </div>
      </div>
    </div>
  );
}
