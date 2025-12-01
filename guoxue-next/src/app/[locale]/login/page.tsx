'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';

export default function LoginPage() {
  const t = useTranslations();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isLoggedIn, login, register } = useAuth();

  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 根据 URL 参数设置初始模式
  useEffect(() => {
    if (searchParams.get('mode') === 'register') {
      setMode('register');
    }
  }, [searchParams]);

  // 如果已登录，跳转回首页
  useEffect(() => {
    if (isLoggedIn) {
      router.push('/');
    }
  }, [isLoggedIn, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!email || !password) {
      setError(t('login.errorEmpty'));
      return;
    }

    if (password.length < 6) {
      setError(t('login.errorPasswordShort'));
      return;
    }

    setIsSubmitting(true);

    try {
      let result;
      if (mode === 'login') {
        result = await login(email, password);
      } else {
        result = await register(email, password);
      }

      if (result.success) {
        if ('needsConfirmation' in result && result.needsConfirmation) {
          const msg = 'message' in result ? (result as any).message : t('login.confirmEmail');
          setSuccess(msg);
        } else {
          setSuccess(mode === 'login' ? t('login.successLogin') : t('login.successRegister'));
          setTimeout(() => {
            router.push('/');
          }, 1000);
        }
      } else {
        setError(result.error || t('login.errorGeneric'));
      }
    } catch (e: any) {
      setError(e.message || t('login.errorNetwork'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <div className="paper-texture" aria-hidden="true" />

      <div className="container">
        <Link href="/" className="back-link">
          ← {t('login.backToDict')}
        </Link>

        <div className="login-container">
          <div className="login-header">
            <div className="login-logo">{t('site.title')}</div>
            <p className="login-subtitle">{t('site.subtitle')}</p>
          </div>

          <div className="login-tabs">
            <button
              type="button"
              className={`login-tab ${mode === 'login' ? 'active' : ''}`}
              onClick={() => { setMode('login'); setError(''); setSuccess(''); }}
            >
              {t('login.tabLogin')}
            </button>
            <button
              type="button"
              className={`login-tab ${mode === 'register' ? 'active' : ''}`}
              onClick={() => { setMode('register'); setError(''); setSuccess(''); }}
            >
              {t('login.tabRegister')}
            </button>
          </div>

          {error && <div className="login-error visible">{error}</div>}
          {success && <div className="login-success visible">{success}</div>}

          <form className="login-form" onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label" htmlFor="email">
                {t('login.emailLabel')}
              </label>
              <input
                type="email"
                id="email"
                className="form-input"
                placeholder={t('login.emailPlaceholder')}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="password">
                {t('login.passwordLabel')}
              </label>
              <input
                type="password"
                id="password"
                className="form-input"
                placeholder={t('login.passwordPlaceholder')}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>

            <button
              type="submit"
              className="login-btn"
              disabled={isSubmitting}
            >
              {isSubmitting
                ? (mode === 'login' ? t('login.loggingIn') : t('login.registering'))
                : (mode === 'login' ? t('login.btnLogin') : t('login.btnRegister'))
              }
            </button>
          </form>

          <div className="login-footer">
            <p>
              {t('login.agreeTerms')}{' '}
              <a href="#">{t('login.termsOfService')}</a>{' '}
              {t('login.and')}{' '}
              <a href="#">{t('login.privacyPolicy')}</a>
            </p>
          </div>
        </div>
      </div>

      <style jsx>{`
        .back-link {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          color: var(--muted);
          text-decoration: none;
          font-size: 14px;
          margin-bottom: 20px;
        }

        .back-link:hover {
          color: var(--accent);
        }

        .login-container {
          max-width: 440px;
          margin: 60px auto;
          padding: 40px 32px;
          background: linear-gradient(145deg,
            rgba(255, 255, 255, 0.98) 0%,
            rgba(252, 250, 255, 0.95) 50%,
            rgba(248, 252, 255, 0.92) 100%
          );
          border: 1.5px solid var(--border);
          border-radius: 24px;
          box-shadow:
            0 20px 60px rgba(122, 104, 166, 0.15),
            0 8px 24px rgba(90, 120, 168, 0.08),
            inset 0 1px 0 rgba(255, 255, 255, 0.8);
        }

        .login-header {
          text-align: center;
          margin-bottom: 32px;
        }

        .login-logo {
          font-family: var(--font-calligraphy);
          font-size: 36px;
          letter-spacing: 4px;
          background: linear-gradient(135deg, #6a50a0 0%, #8668c0 50%, #5a80b0 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          margin-bottom: 8px;
        }

        .login-subtitle {
          color: var(--muted);
          font-size: 14px;
        }

        .login-tabs {
          display: flex;
          border-bottom: 2px solid var(--border);
          margin-bottom: 28px;
        }

        .login-tab {
          flex: 1;
          padding: 12px 16px;
          background: transparent;
          border: none;
          font-family: var(--font-serif);
          font-size: 16px;
          color: var(--muted);
          cursor: pointer;
          transition: all 0.3s ease;
          position: relative;
        }

        .login-tab.active {
          color: var(--accent);
          font-weight: 600;
        }

        .login-tab.active::after {
          content: '';
          position: absolute;
          bottom: -2px;
          left: 20%;
          right: 20%;
          height: 3px;
          background: linear-gradient(90deg, var(--accent), var(--secondary));
          border-radius: 2px;
        }

        .login-tab:hover {
          color: var(--ink);
        }

        .login-form {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .form-group {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .form-label {
          font-family: var(--font-serif);
          font-size: 14px;
          color: var(--ink);
          font-weight: 500;
        }

        .form-input {
          padding: 14px 18px;
          border: 1.5px solid var(--border);
          border-radius: 12px;
          font-size: 15px;
          font-family: var(--font-serif);
          background: rgba(255, 255, 255, 0.8);
          transition: all 0.3s ease;
        }

        .form-input:focus {
          outline: none;
          border-color: var(--accent);
          box-shadow: 0 0 0 4px rgba(122, 104, 166, 0.15);
        }

        .form-input::placeholder {
          color: var(--muted);
          opacity: 0.6;
        }

        .login-btn {
          margin-top: 8px;
          padding: 16px 32px;
          background: linear-gradient(135deg,
            #6a58a0 0%,
            #7a68b8 30%,
            #5a78a8 70%,
            #4a88b8 100%
          );
          color: white;
          border: none;
          border-radius: 16px;
          font-family: var(--font-serif);
          font-size: 16px;
          font-weight: 600;
          letter-spacing: 2px;
          cursor: pointer;
          transition: all 0.4s ease;
          box-shadow:
            0 8px 28px rgba(106, 88, 160, 0.3),
            0 4px 14px rgba(90, 120, 168, 0.2);
        }

        .login-btn:hover {
          transform: translateY(-2px);
          box-shadow:
            0 12px 36px rgba(106, 88, 160, 0.4),
            0 6px 18px rgba(90, 120, 168, 0.3);
        }

        .login-btn:disabled {
          background: linear-gradient(135deg, #9090a0, #b0b0c0);
          cursor: not-allowed;
          transform: none;
        }

        .login-error {
          background: linear-gradient(135deg, #fef5f5, #fce8e8);
          border: 1px solid rgba(197, 61, 67, 0.3);
          color: var(--vermilion);
          padding: 12px 16px;
          border-radius: 10px;
          font-size: 14px;
          text-align: center;
          display: none;
        }

        .login-error.visible {
          display: block;
        }

        .login-success {
          background: linear-gradient(135deg, #f0faf0, #e0f5e0);
          border: 1px solid rgba(67, 160, 71, 0.3);
          color: #2e7d32;
          padding: 12px 16px;
          border-radius: 10px;
          font-size: 14px;
          text-align: center;
          display: none;
        }

        .login-success.visible {
          display: block;
        }

        .login-footer {
          margin-top: 28px;
          text-align: center;
          color: var(--muted);
          font-size: 13px;
        }

        .login-footer a {
          color: var(--accent);
          text-decoration: none;
        }

        .login-footer a:hover {
          text-decoration: underline;
        }

        @media (prefers-color-scheme: dark) {
          .login-container {
            background: linear-gradient(135deg,
              rgba(37, 32, 24, 0.98) 0%,
              rgba(26, 21, 16, 0.95) 100%
            );
          }

          .form-input {
            background: rgba(40, 35, 30, 0.8);
            color: var(--text);
          }
        }
      `}</style>
    </>
  );
}
