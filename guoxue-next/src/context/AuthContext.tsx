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
  const [quota, setQuota] = useState<Quota | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const searchParams = useSearchParams();
  const quotaRef = useRef<Quota | null>(null);
  const hasHandledSubscriptionSuccess = useRef(false);

  useEffect(() => {
    quotaRef.current = quota;
  }, [quota]);

  // 从本地存储恢复会话
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const savedToken = localStorage.getItem(AUTH_TOKEN_KEY);
    const savedUser = localStorage.getItem(AUTH_USER_KEY);
    const savedQuota = localStorage.getItem(AUTH_QUOTA_KEY);

    if (savedToken && savedUser) {
      try {
        setToken(savedToken);
        setUser(JSON.parse(savedUser));
        if (savedQuota) {
          setQuota(JSON.parse(savedQuota));
        }

        // 验证 Token 是否有效
        validateToken(savedToken).then(valid => {
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
  async function fetchSubscriptionStatus(authToken: string): Promise<Quota | null> {
    try {
      const resp = await fetch('/api/user/subscription', {
        headers: {
          'Authorization': `Bearer ${authToken}`,
        }
      });

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
  async function validateToken(authToken: string): Promise<boolean> {
    if (!hasSupabaseConfig()) { return false; }
    try {
      const resp = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'apikey': SUPABASE_ANON_KEY
        }
      });

      if (resp.ok) {
        const userData = await resp.json();
        setUser(userData);
        localStorage.setItem(AUTH_USER_KEY, JSON.stringify(userData));

        // 获取订阅状态
        await fetchSubscriptionStatus(authToken);
        return true;
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

      // 保存认证信息
      setToken(data.access_token);
      setUser(data.user);

      localStorage.setItem(AUTH_TOKEN_KEY, data.access_token);
      localStorage.setItem(AUTH_USER_KEY, JSON.stringify(data.user));

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
        setToken(data.access_token);
        setUser(userWithUsername);

        localStorage.setItem(AUTH_TOKEN_KEY, data.access_token);
        localStorage.setItem(AUTH_USER_KEY, JSON.stringify(userWithUsername));
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
    setUser(null);
    setQuota(null);

    if (typeof window !== 'undefined') {
      localStorage.removeItem(AUTH_TOKEN_KEY);
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
  async function getAccessToken(): Promise<string | null> {
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
