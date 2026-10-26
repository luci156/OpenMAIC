'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, GraduationCap, LockKeyhole } from 'lucide-react';
import { useI18n } from '@/lib/hooks/use-i18n';
import { ieltsAppCopy } from '@/lib/i18n/ielts-app-copy';
import { modelSettingsClient } from '@/lib/model-settings/client';
import { cn } from '@/lib/utils';

export default function LoginPage() {
  const { locale } = useI18n();
  const router = useRouter();
  const [email, setEmail] = useState('giaovien@gmail.com');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch('/api/auth/session', { cache: 'no-store' })
      .then((response) => response.json())
      .then((data) => {
        if (data.enabled === false) setError(ieltsAppCopy(locale, 'loginUnavailable'));
        else if (data.authenticated) router.replace('/bands');
      })
      .catch(() => setError(ieltsAppCopy(locale, 'loginUnavailable')));
  }, [locale, router]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await response.json();
      if (!response.ok || data.success !== true) {
        setError(data.error || ieltsAppCopy(locale, 'loginError'));
        return;
      }
      // The root providers first mounted while the login screen's anonymous
      // requests were denied. Reload the owner-scoped settings after login.
      await modelSettingsClient.load({ fresh: true });
      void import('@/components/model-settings-init').then(({ importLegacyModelSettings }) =>
        importLegacyModelSettings(),
      );
      void import('@/lib/orchestration/registry/store').then(({ reloadAgentRegistry }) =>
        reloadAgentRegistry(),
      );
      void import('@/lib/legacy-browser-import').then(({ resumeLegacyBrowserImportAfterAccess }) =>
        resumeLegacyBrowserImportAfterAccess(),
      );

      const requested = new URLSearchParams(window.location.search).get('next');
      const destination = requested?.startsWith('/') && !requested.startsWith('//') ? requested : '/bands';
      router.replace(destination);
      router.refresh();
    } catch {
      setError(ieltsAppCopy(locale, 'loginError'));
    } finally {
      setBusy(false);
    }
  };

  const c = (key: Parameters<typeof ieltsAppCopy>[1]) => ieltsAppCopy(locale, key);

  return (
    <main className="relative flex min-h-[100dvh] items-center justify-center overflow-hidden bg-slate-50 px-4 py-24 text-slate-950 dark:bg-slate-950 dark:text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(79,70,229,0.12),_transparent_55%),radial-gradient(ellipse_at_bottom_right,_rgba(14,165,233,0.08),_transparent_45%)] dark:bg-[radial-gradient(ellipse_at_top,_rgba(79,70,229,0.2),_transparent_55%),radial-gradient(ellipse_at_bottom_right,_rgba(14,165,233,0.12),_transparent_45%)]" />
      <div className="relative z-10 w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-5 flex size-14 items-center justify-center rounded-2xl border border-violet-300/20 bg-violet-400/10 text-violet-200 shadow-lg shadow-violet-950/30">
            <GraduationCap className="size-7" />
          </div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-violet-600 dark:text-violet-300">{c('loginEyebrow')}</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">{c('loginTitle')}</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-400">{c('loginDescription')}</p>
        </div>

        <form onSubmit={submit} className="space-y-5 rounded-3xl border border-slate-200 bg-white/80 p-6 shadow-2xl shadow-slate-300/30 backdrop-blur-xl dark:border-white/10 dark:bg-white/[0.045] dark:shadow-black/30 sm:p-8">
          <label className="block space-y-2 text-sm font-medium text-slate-700 dark:text-slate-200">
            {c('email')}
            <input
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm text-slate-900 outline-none transition focus:border-violet-400/70 focus:ring-2 focus:ring-violet-400/15 dark:border-white/10 dark:bg-slate-950/70 dark:text-white"
            />
          </label>
          <label className="block space-y-2 text-sm font-medium text-slate-700 dark:text-slate-200">
            {c('password')}
            <div className="relative">
              <LockKeyhole className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
              <input
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3.5 text-sm text-slate-900 outline-none transition focus:border-violet-400/70 focus:ring-2 focus:ring-violet-400/15 dark:border-white/10 dark:bg-slate-950/70 dark:text-white"
              />
            </div>
          </label>
          {error && (
            <p role="alert" className="rounded-xl border border-rose-400/20 bg-rose-400/10 px-3.5 py-2.5 text-sm text-rose-200">{error}</p>
          )}
          <button
            type="submit"
            disabled={busy}
            className={cn('flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-violet-500 px-4 text-sm font-semibold text-white shadow-lg shadow-violet-950/30 transition hover:bg-violet-400 disabled:cursor-wait disabled:opacity-60')}
          >
            {busy ? c('loggingIn') : c('login')}
            {!busy && <ArrowRight className="size-4" />}
          </button>
        </form>
        <p className="mt-6 text-center text-xs text-slate-500">OpenMAIC · IELTS Learning Studio</p>
      </div>
    </main>
  );
}
