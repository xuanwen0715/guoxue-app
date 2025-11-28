/**
 * 国学智能词典 - Supabase 认证模块
 * 处理用户登录、注册、Token 管理
 */

(() => {
  'use strict';

  // Supabase 配置
  const SUPABASE_URL = 'https://dckeajeazaxbxlqlkicl.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRja2VhamVhemF4YnhscWxraWNsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQyOTI3NjUsImV4cCI6MjA3OTg2ODc2NX0.kv1oVXsO9gnB3XLCFGlJuX2I9PAbn80XD1irzCDNRfI';

  // 本地存储键名
  const AUTH_TOKEN_KEY = 'gx_auth_token';
  const AUTH_USER_KEY = 'gx_auth_user';
  const AUTH_QUOTA_KEY = 'gx_auth_quota';

  // 认证状态
  let currentUser = null;
  let currentToken = null;
  let currentQuota = null;

  /**
   * 初始化认证模块
   */
  function init() {
    // 从本地存储恢复会话
    const savedToken = localStorage.getItem(AUTH_TOKEN_KEY);
    const savedUser = localStorage.getItem(AUTH_USER_KEY);
    const savedQuota = localStorage.getItem(AUTH_QUOTA_KEY);

    if (savedToken && savedUser) {
      try {
        currentToken = savedToken;
        currentUser = JSON.parse(savedUser);
        currentQuota = savedQuota ? JSON.parse(savedQuota) : null;

        // 验证 Token 是否有效（异步）
        validateToken().then(valid => {
          if (!valid) {
            logout();
          } else {
            updateUI();
          }
        });
      } catch (e) {
        console.error('[Auth] Failed to restore session:', e);
        logout();
      }
    }

    updateUI();
  }

  /**
   * 验证当前 Token 是否有效
   */
  async function validateToken() {
    if (!currentToken) return false;

    try {
      const resp = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
        headers: {
          'Authorization': `Bearer ${currentToken}`,
          'apikey': SUPABASE_ANON_KEY
        }
      });

      if (resp.ok) {
        const userData = await resp.json();
        currentUser = userData;
        localStorage.setItem(AUTH_USER_KEY, JSON.stringify(userData));
        return true;
      }
      return false;
    } catch (e) {
      console.error('[Auth] Token validation failed:', e);
      return false;
    }
  }

  /**
   * 用户登录
   */
  async function login(email, password) {
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
      currentToken = data.access_token;
      currentUser = data.user;

      localStorage.setItem(AUTH_TOKEN_KEY, currentToken);
      localStorage.setItem(AUTH_USER_KEY, JSON.stringify(currentUser));

      updateUI();
      return { success: true, user: currentUser };
    } catch (e) {
      console.error('[Auth] Login failed:', e);
      return { success: false, error: e.message };
    }
  }

  /**
   * 用户注册
   */
  async function register(email, password) {
    try {
      const resp = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_ANON_KEY
        },
        body: JSON.stringify({ email, password })
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
        currentToken = data.access_token;
        currentUser = data.user;

        localStorage.setItem(AUTH_TOKEN_KEY, currentToken);
        localStorage.setItem(AUTH_USER_KEY, JSON.stringify(currentUser));

        updateUI();
        return { success: true, user: currentUser };
      }

      return { success: true, user: data.user };
    } catch (e) {
      console.error('[Auth] Register failed:', e);
      return { success: false, error: e.message };
    }
  }

  /**
   * 退出登录
   */
  function logout() {
    currentToken = null;
    currentUser = null;
    currentQuota = null;

    localStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem(AUTH_USER_KEY);
    localStorage.removeItem(AUTH_QUOTA_KEY);

    updateUI();
  }

  /**
   * 获取当前认证头
   */
  function getAuthHeader() {
    if (!currentToken) return {};
    return { 'Authorization': `Bearer ${currentToken}` };
  }

  /**
   * 检查是否已登录
   */
  function isLoggedIn() {
    return !!currentToken && !!currentUser;
  }

  /**
   * 获取当前用户
   */
  function getUser() {
    return currentUser;
  }

  /**
   * 获取当前配额信息
   */
  function getQuota() {
    return currentQuota;
  }

  /**
   * 更新配额信息（从 API 响应中）
   */
  function updateQuota(quotaInfo) {
    if (quotaInfo) {
      currentQuota = quotaInfo;
      localStorage.setItem(AUTH_QUOTA_KEY, JSON.stringify(quotaInfo));
      updateQuotaUI();
    }
  }

  /**
   * 更新界面显示
   */
  function updateUI() {
    const authSection = document.getElementById('auth-section');
    const userSection = document.getElementById('user-section');
    const userEmail = document.getElementById('user-email');
    const loginRequired = document.getElementById('login-required');

    if (isLoggedIn()) {
      // 已登录
      if (authSection) authSection.style.display = 'none';
      if (userSection) userSection.style.display = 'flex';
      if (userEmail) userEmail.textContent = currentUser.email || '用户';
      if (loginRequired) loginRequired.style.display = 'none';

      updateQuotaUI();
    } else {
      // 未登录
      if (authSection) authSection.style.display = 'flex';
      if (userSection) userSection.style.display = 'none';
      if (loginRequired) loginRequired.style.display = 'block';
    }
  }

  /**
   * 更新配额显示
   */
  function updateQuotaUI() {
    const quotaDisplay = document.getElementById('quota-display');
    if (!quotaDisplay) return;

    if (currentQuota) {
      if (currentQuota.is_premium) {
        quotaDisplay.innerHTML = '<span class="badge-premium">付费会员</span>';
      } else {
        quotaDisplay.innerHTML = `<span class="badge-credits">剩余 ${currentQuota.credits_remaining} 次</span>`;
      }
    } else {
      quotaDisplay.innerHTML = '';
    }
  }

  /**
   * 处理 API 错误响应
   */
  function handleApiError(response) {
    if (response.code === 'AUTH_ERROR') {
      // Token 无效，需要重新登录
      logout();
      showLoginPrompt('登录已过期，请重新登录');
      return true;
    }
    if (response.code === 'QUOTA_EXCEEDED') {
      // 额度用完
      showQuotaExceededPrompt();
      return true;
    }
    return false;
  }

  /**
   * 显示登录提示
   */
  function showLoginPrompt(message) {
    const msg = message || '请先登录后使用';
    if (confirm(`${msg}\n\n是否现在登录？`)) {
      window.location.href = 'login.html';
    }
  }

  /**
   * 显示额度用完提示
   */
  function showQuotaExceededPrompt() {
    const modal = document.createElement('div');
    modal.className = 'quota-modal-overlay';
    modal.innerHTML = `
      <div class="quota-modal">
        <div class="quota-modal-header">
          <span class="quota-modal-icon">💎</span>
          <h3>免费额度已用完</h3>
        </div>
        <div class="quota-modal-body">
          <p>您的免费查询次数已用完。</p>
          <p>升级为付费会员，享受无限次查询！</p>
        </div>
        <div class="quota-modal-actions">
          <button class="btn btn-primary" id="upgrade-btn">立即升级</button>
          <button class="btn btn-secondary" id="close-quota-modal">稍后再说</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    requestAnimationFrame(() => modal.classList.add('visible'));

    modal.querySelector('#close-quota-modal').addEventListener('click', () => {
      modal.classList.remove('visible');
      setTimeout(() => modal.remove(), 200);
    });

    modal.querySelector('#upgrade-btn').addEventListener('click', () => {
      // TODO: 跳转到支付页面
      alert('支付功能即将上线，敬请期待！');
    });
  }

  // 导出到全局
  window.GxAuth = {
    init,
    login,
    register,
    logout,
    isLoggedIn,
    getUser,
    getQuota,
    getAuthHeader,
    updateQuota,
    handleApiError,
    showLoginPrompt
  };

  // 页面加载时初始化
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
