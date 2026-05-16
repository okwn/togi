'use client';

import { useState } from 'react';

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const botUsername = process.env.NEXT_PUBLIC_BOT_USERNAME || 'TOGI_Bot';

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 max-w-md w-full">
        <div className="text-center mb-8">
          <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center mx-auto mb-4">
            <span className="text-white font-bold text-xl">T</span>
          </div>
          <h1 className="text-2xl font-bold text-white">TOGI Security</h1>
          <p className="text-slate-400 mt-2">Sign in with your Telegram account</p>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 mb-4">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

        <div id="telegram-login-container" className="flex justify-center mb-6">
          <script
            dangerouslySetInnerHTML={{
              __html: `
                function onTelegramAuth(user) {
                  const authDate = Math.floor(Date.now() / 1000);
                  const userStr = JSON.stringify(user);
                  const fields = 'auth_date=' + authDate + '&user=' + encodeURIComponent(userStr);
                  fetch('/api/auth/telegram/callback', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ initData: fields }),
                    credentials: 'include',
                  }).then(res => {
                    if (res.ok) window.location.href = '/dashboard';
                    else res.json().then(data => {
                      document.getElementById('login-error').textContent = data.error?.message || 'Login failed';
                      document.getElementById('login-error').style.display = 'block';
                    });
                  });
                }
              `
            }}
          />
          <script
            async
            src="https://telegram.org/js/telegram-widget.js?21"
            data-telegram-login={botUsername}
            data-size="large"
            data-radius="10"
            data-request-access="write"
            data-onauth="onTelegramAuth(user)"
          />
        </div>

        <div id="login-error" className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 mb-4" style={{ display: 'none' }}>
          <p className="text-red-400 text-sm"></p>
        </div>

        <p className="text-slate-500 text-xs text-center">
          By logging in, you agree to share your Telegram user information with TOGI.
        </p>
      </div>
    </div>
  );
}