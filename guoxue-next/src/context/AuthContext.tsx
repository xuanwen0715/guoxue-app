'use client';

import { createContext, useContext, useState, useEffect, ReactNode, useRef } from 'react';
import { useSearchParams } from 'next/navigation';

// Supabase 配置
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

function hasSupabaseConfig() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error('[Auth] Missing Supabase config: NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY');
    return false;
  }
  return true;
}


// 本地存储键名
const AUTH_TOKEN_KEY = 'gx_auth_token';
const AUTH_REFRESH_TOKEN_KEY = 'gx_auth_refresh_token';
const AUTH_TOKEN_EXPIRES_AT_KEY = 'gx_auth_expires_at';
const AUTH_USER_KEY = 'gx_auth_user';
const AUTH_QUOTA_KEY = 'gx_auth_quota';

interface User {
  id: string;
  email: string;
  [key: string]: any;
}

interface Quota {
  is_premium: boolean;
  credits_remaining: number;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  quota: Quota | null;
  isLoggedIn: boolean;
  isLoading: boolean;
  isPremium: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (email: string, password: string, username?: string) => Promise<{ success: boolean; error?: string; needsConfirmation?: boolean; message?: string }>;
  logout: () => void;
  getAuthHeader: () => Record<string, string>;
  getAccessToken: () => Promise<string | null>;
  updateQuota: (quotaInfo: Quota) => void;
  getDisplayName: () => string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);
  const [tokenExpiresAt, setTokenExpiresAt] = useState<number | null>(null);
  const [quota, setQuota] = useState<Quota | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const searchParams = useSearchParams();
  const quotaRef = useRef<Quota | null>(null);
  const hasHandledSubscriptionSuccess = useRef(false);
  const refreshPromiseRef = useRef<Promise<string | null> | null>(null);

  function getStoredNumber(value: string | null): number | null {
    if (!value) return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  function resolveExpiresAt(data: any): number | null {
    if (typeof data?.expires_at === 'number') return data.expires_at;
    if (typeof data?.expires_in === 'number') {
      return Math.floor(Date.now() / 1000) + data.expires_in;
    }
    return null;
  }

  function persistSession(session: {
    access_token: string;
    refresh_token?: string | null;
    expires_at?: number | null;
    user?: User | null;
  }) {
    setToken(session.access_token);
    if (session.user) {
      setUser(session.user);
      if (typeof window !== 'undefined') {
        localStorage.setItem(AUTH_USER_KEY, JSON.stringify(session.user));
      }
    }

    if (session.refresh_token) {
      setRefreshToken(session.refresh_token);
      if (typeof window !== 'undefined') {
        localStorage.setItem(AUTH_REFRESH_TOKEN_KEY, session.refresh_token);
      }
    }

    if (typeof session.expires_at === 'number') {
      setTokenExpiresAt(session.expires_at);
      if (typeof window !== 'undefined') {
        localStorage.setItem(AUTH_TOKEN_EXPIRES_AT_KEY, String(session.expires_at));
      }
    }

    if (typeof window !== 'undefined') {
      localStorage.setItem(AUTH_TOKEN_KEY, session.access_token);
    }
  }

  function shouldRefreshToken(expiresAt: number | null) {
    if (!expiresAt) return false;
    const now = Math.floor(Date.now() / 1000);
    return now >= expiresAt - 30;
  }

  useEffect(() => {
    quotaRef.current = quota;
  }, [quota]);

  // 从本地存储恢复会话
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const savedToken = localStorage.getItem(AUTH_TOKEN_KEY);
    const savedRefreshToken = localStorage.getItem(AUTH_REFRESH_TOKEN_KEY);
    const savedExpiresAt = getStoredNumber(localStorage.getItem(AUTH_TOKEN_EXPIRES_AT_KEY));
    const savedUser = localStorage.getItem(AUTH_USER_KEY);
    const savedQuota = localStorage.getItem(AUTH_QUOTA_KEY);

    if (savedToken && savedUser) {
      try {
        setToken(savedToken);
        setRefreshToken(savedRefreshToken);
        setTokenExpiresAt(savedExpiresAt);
        setUser(JSON.parse(savedUser));
        if (savedQuota) {
          setQuota(JSON.parse(savedQuota));
        }

        // 验证 Token 是否有效
        validateToken(savedToken, savedRefreshToken, savedExpiresAt).then(valid => {
          if (!valid) {
            logout();
          }
          setIsLoading(false);
        });
      } catch (e) {
        console.error('[Auth] Failed to restore session:', e);
        logout();
        setIsLoading(false);
      }
    } else {
      setIsLoading(false);
    }
  }, []);

  // 获取用户订阅状态
  async function fetchSubscriptionStatus(authToken?: string): Promise<Quota | null> {
    try {
      const activeToken = authToken ?? await getAccessToken();
      if (!activeToken) return null;

      let resp = await fetch('/api/user/subscription', {
        method: 'POST',
        cache: 'no-store',
        headers: {
          'Authorization': `Bearer ${activeToken}`,
        }
      });

      if (resp.status === 401 && refreshToken) {
        const refreshed = await refreshAccessToken(refreshToken);
        if (refreshed) {
          resp = await fetch('/api/user/subscription', {
            method: 'POST',
            cache: 'no-store',
            headers: {
              'Authorization': `Bearer ${refreshed}`,
            }
          });
        }
      }

      if (resp.ok) {
        const data = await resp.json();
        const quotaInfo: Quota = {
          is_premium: data.is_premium,
          credits_remaining: data.credits_remaining,
        };
        setQuota(quotaInfo);
        localStorage.setItem(AUTH_QUOTA_KEY, JSON.stringify(quotaInfo));
        return quotaInfo;
      }
    } catch (e) {
      console.error('[Auth] Failed to fetch subscription status:', e);
    }
    return null;
  }

  useEffect(() => {
    const subscriptionResult = searchParams?.get('subscription');
    if (subscriptionResult !== 'success') return;
    if (!token) return;
    if (hasHandledSubscriptionSuccess.current) return;

    hasHandledSubscriptionSuccess.current = true;
    let canceled = false;
    let attempt = 0;
    const maxAttempts = 5;

    const refresh = async () => {
      if (canceled) return;
      attempt += 1;
      const latestQuota = await fetchSubscriptionStatus(token);
      const isPremiumActive = latestQuota?.is_premium ?? quotaRef.current?.is_premium ?? false;

      if (!isPremiumActive && attempt < maxAttempts) {
        setTimeout(refresh, 3000);
      }
    };

    refresh();
    return () => {
      canceled = true;
    };
  }, [searchParams, token]);

  // 验证 Token
  async function validateToken(
    authToken: string,
    storedRefreshToken?: string | null,
    storedExpiresAt?: number | null
  ): Promise<boolean> {
    if (!hasSupabaseConfig()) { return false; }
    try {
      let activeToken = authToken;
      const effectiveRefreshToken = storedRefreshToken ?? refreshToken;
      const effectiveExpiresAt = storedExpiresAt ?? tokenExpiresAt;

      if (shouldRefreshToken(effectiveExpiresAt) && effectiveRefreshToken) {
        const refreshed = await refreshAccessToken(effectiveRefreshToken);
        if (refreshed) {
          activeToken = refreshed;
        }
      }

      const resp = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
        headers: {
          'Authorization': `Bearer ${activeToken}`,
          'apikey': SUPABASE_ANON_KEY
        }
      });

      if (resp.ok) {
        const userData = await resp.json();
        setUser(userData);
        localStorage.setItem(AUTH_USER_KEY, JSON.stringify(userData));

        // 获取订阅状态
        await fetchSubscriptionStatus(activeToken);
        return true;
      }

      if (resp.status === 401 && effectiveRefreshToken) {
        const refreshed = await refreshAccessToken(effectiveRefreshToken);
        if (refreshed) {
          const retryResp = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
            headers: {
              'Authorization': `Bearer ${refreshed}`,
              'apikey': SUPABASE_ANON_KEY
            }
          });

          if (retryResp.ok) {
            const userData = await retryResp.json();
            setUser(userData);
            localStorage.setItem(AUTH_USER_KEY, JSON.stringify(userData));
            await fetchSubscriptionStatus(refreshed);
            return true;
          }
        }
      }

      return false;
    } catch (e) {
      console.error('[Auth] Token validation failed:', e);
      return false;
    }
  }

  // 登录
  async function login(email: string, password: string) {
    if (!hasSupabaseConfig()) { return { success: false, error: 'Supabase 配置缺失' }; }
    try {
      const resp = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_ANON_KEY
        },
        body: JSON.stringify({ email, password })
      });

      const data = await resp.json();

      if (!resp.ok) {
        throw new Error(data.error_description || data.msg || '登录失败');
      }

      const expiresAt = resolveExpiresAt(data);
      persistSession({
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        expires_at: expiresAt,
        user: data.user,
      });

      // 获取订阅状态
      await fetchSubscriptionStatus(data.access_token);

      return { success: true };
    } catch (e: any) {
      console.error('[Auth] Login failed:', e);
      return { success: false, error: e.message };
    }
  }

  // 注册
  async function register(email: string, password: string, username?: string) {
    if (!hasSupabaseConfig()) { return { success: false, error: 'Supabase 配置缺失' }; }
    try {
      const resp = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_ANON_KEY
        },
        body: JSON.stringify({
          email,
          password,
          data: {
            username: username || email.split('@')[0]
          }
        })
      });

      const data = await resp.json();

      if (!resp.ok) {
        throw new Error(data.error_description || data.msg || '注册失败');
      }

      // 如果需要邮箱验证
      if (data.confirmation_sent_at) {
        return {
          success: true,
          needsConfirmation: true,
          message: '注册成功！请检查您的邮箱完成验证。'
        };
      }

      // 直接登录成功
      if (data.access_token) {
        const userWithUsername = {
          ...data.user,
          user_metadata: {
            ...data.user?.user_metadata,
            username: username || email.split('@')[0]
          }
        };
        const expiresAt = resolveExpiresAt(data);
        persistSession({
          access_token: data.access_token,
          refresh_token: data.refresh_token,
          expires_at: expiresAt,
          user: userWithUsername,
        });
        await fetchSubscriptionStatus(data.access_token);
      }

      return { success: true };
    } catch (e: any) {
      console.error('[Auth] Register failed:', e);
      return { success: false, error: e.message };
    }
  }

  // 退出登录
  function logout() {
    setToken(null);
    setRefreshToken(null);
    setTokenExpiresAt(null);
    setUser(null);
    setQuota(null);

    if (typeof window !== 'undefined') {
      localStorage.removeItem(AUTH_TOKEN_KEY);
      localStorage.removeItem(AUTH_REFRESH_TOKEN_KEY);
      localStorage.removeItem(AUTH_TOKEN_EXPIRES_AT_KEY);
      localStorage.removeItem(AUTH_USER_KEY);
      localStorage.removeItem(AUTH_QUOTA_KEY);
    }
  }

  // 获取认证头
  function getAuthHeader(): Record<string, string> {
    if (!token) return {};
    return { 'Authorization': `Bearer ${token}` };
  }

  // 获取访问令牌
  async function refreshAccessToken(existingRefreshToken: string): Promise<string | null> {
    if (!hasSupabaseConfig()) { return null; }
    if (refreshPromiseRef.current) return refreshPromiseRef.current;

    refreshPromiseRef.current = (async () => {
      try {
        const resp = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({ refresh_token: existingRefreshToken }),
        });

        const data = await resp.json();
        if (!resp.ok) {
          console.error('[Auth] Refresh token failed:', data);
          return null;
        }

        const expiresAt = resolveExpiresAt(data);
        persistSession({
          access_token: data.access_token,
          refresh_token: data.refresh_token ?? existingRefreshToken,
          expires_at: expiresAt,
          user: data.user ?? user ?? undefined,
        });

        return data.access_token;
      } catch (e) {
        console.error('[Auth] Refresh token error:', e);
        return null;
      } finally {
        refreshPromiseRef.current = null;
      }
    })();

    return refreshPromiseRef.current;
  }

  async function getAccessToken(): Promise<string | null> {
    if (!token) return null;
    if (!hasSupabaseConfig()) { return token; }

    if (shouldRefreshToken(tokenExpiresAt) && refreshToken) {
      const refreshed = await refreshAccessToken(refreshToken);
      return refreshed ?? token;
    }
    return token;
  }

  // 更新配额信息
  function updateQuota(quotaInfo: Quota) {
    setQuota(quotaInfo);
    if (typeof window !== 'undefined') {
      localStorage.setItem(AUTH_QUOTA_KEY, JSON.stringify(quotaInfo));
    }
  }

  // 获取显示名称（优先用户名，其次邮箱前缀）
  function getDisplayName(): string {
    if (!user) return '';
    // 尝试从 user_metadata 获取用户名
    const username = user.user_metadata?.username;
    if (username) return username;
    // 回退到邮箱前缀
    if (user.email) return user.email.split('@')[0];
    return '';
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        quota,
        isLoggedIn: !!token && !!user,
        isLoading,
        isPremium: quota?.is_premium ?? false,
        login,
        register,
        logout,
        getAuthHeader,
        getAccessToken,
        updateQuota,
        getDisplayName,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
