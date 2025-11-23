// app/auth/login/AuthPageClient.tsx
'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

type Tab = 'login' | 'signup';
type Role = 'creator' | 'client';

export default function AuthPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get('next') || '/works';
  const tabFromQuery = searchParams.get('tab') === 'signup' ? 'signup' : 'login';

  const [tab, setTab] = useState<Tab>(tabFromQuery);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [role, setRole] = useState<Role>('client');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleLogin = async () => {
    setErrorMsg(null);
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setErrorMsg(error.message);
      setLoading(false);
      return;
    }

    router.push(next);
  };

  const handleSignup = async () => {
    setErrorMsg(null);
    setLoading(true);

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error || !data.user) {
      setErrorMsg(error?.message || '登録に失敗しました');
      setLoading(false);
      return;
    }

    const user = data.user;

    const { error: profileError } = await supabase.from('profiles').insert({
      id: user.id,
      display_name: displayName || email,
      role,
    });

    if (profileError) {
      setErrorMsg(`プロフィール作成に失敗しました: ${profileError.message}`);
      setLoading(false);
      return;
    }

    router.push(role === 'creator' ? '/profile/edit' : '/works');
  };

  return (
    <div className="min-h-[calc(100vh-56px)] flex items-center">
      <div className="grid gap-10 lg:grid-cols-[1.3fr_1fr] w-full">
        {/* 左：ヒーローエリア */}
        <section className="hidden md:flex flex-col justify-center gap-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-slate-200">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            個人クリエイター × 依頼者 のための新しいマッチング
          </div>

          <div className="space-y-4">
            <h1 className="text-3xl lg:text-4xl font-semibold tracking-tight">
            <span className="bg-slate-950/70 px-1.5 py-0.5 rounded-md text-white">
                フォロワー数じゃなくて、
              </span>
              <br />
              <span className="bg-gradient-to-r from-pink-300 via-sky-300 to-emerald-300 bg-clip-text text-transparent">
                「共感」から仕事が生まれる場所。
              </span>
            </h1>
            <p className="text-sm text-slate-300 leading-relaxed max-w-xl">
              スタイリスト、ヘアメイク、イラストレーター、デザイナー…。
              Connectry は、作品に「いいな」と思った人から直接依頼が届く、
              クリエイターのためのポートフォリオ＆マッチングプラットフォームです。
            </p>
          </div>

          <div className="grid grid-cols-3 gap-4 text-xs text-slate-300 max-w-md">
            <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3">
              <div className="text-[11px] text-slate-400 mb-1">クリエイター</div>
              <div className="text-sm font-semibold">作品を投稿</div>
              <p className="mt-1 text-[11px] text-slate-400">
                カットモデル、作品撮り、イラスト、デザインなど。
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3">
              <div className="text-[11px] text-slate-400 mb-1">依頼者</div>
              <div className="text-sm font-semibold">「この人」に依頼</div>
              <p className="mt-1 text-[11px] text-slate-400">
                好きな作風・スタイルからクリエイターを選べます。
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3">
              <div className="text-[11px] text-slate-400 mb-1">メッセージ</div>
              <div className="text-sm font-semibold">依頼ごとにチャット</div>
              <p className="mt-1 text-[11px] text-slate-400">
                条件のすり合わせも 1 件ごとのスレッドで安全に。
              </p>
            </div>
          </div>
        </section>

        {/* 右：認証カード */}
        <section className="flex justify-center">
          <div className="w-full max-w-md rounded-3xl border border-white/15 bg-slate-900/70 px-7 py-7 shadow-[0_18px_45px_rgba(15,23,42,0.7)] backdrop-blur">
            {/* タイトル */}
            <div className="mb-5 text-center">
              <div className="inline-flex items-center gap-2 text-xs font-medium text-slate-300 mb-2">
                <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-br from-pink-400 to-sky-400 text-[11px]">
                  ✦
                </span>
                <span>Connectry アカウント</span>
              </div>
              <h2 className="text-lg font-semibold">
                {tab === 'login' ? 'ログイン' : '新規登録'}
              </h2>
              <p className="mt-1 text-[11px] text-slate-400">
                {tab === 'login'
                  ? '登録済みのメールアドレスとパスワードを入力してください。'
                  : 'クリエイター / 依頼者として、無料でアカウントを作成します。'}
              </p>
            </div>

            {/* タブ */}
            <div className="mb-5 flex rounded-full bg-slate-800/80 p-1 text-xs">
              <button
                type="button"
                onClick={() => setTab('login')}
                className={`flex-1 rounded-full px-3 py-1.5 transition ${
                  tab === 'login'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                ログイン
              </button>
              <button
                type="button"
                onClick={() => setTab('signup')}
                className={`flex-1 rounded-full px-3 py-1.5 transition ${
                  tab === 'signup'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                新規登録
              </button>
            </div>

            {/* エラー */}
            {errorMsg && (
              <div className="mb-4 text-[11px] text-red-400 border border-red-500/40 bg-red-950/40 rounded-xl px-3 py-2">
                {errorMsg}
              </div>
            )}

            {/* フォーム */}
            <div className="space-y-3 text-xs">
              {tab === 'signup' && (
                <div>
                  <label className="mb-1.5 block font-medium text-slate-200">
                    表示名（ニックネーム）
                  </label>
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="例：岡田スタイリスト / イラストレーター"
                    className="w-full rounded-xl border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-slate-50 outline-none ring-0 transition focus:border-pink-400 focus:ring-2 focus:ring-pink-500/50"
                  />
                </div>
              )}

              <div>
                <label className="mb-1.5 block font-medium text-slate-200">
                  メールアドレス
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full rounded-xl border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-slate-50 outline-none ring-0 transition focus:border-pink-400 focus:ring-2 focus:ring-pink-500/50"
                />
              </div>

              <div>
                <label className="mb-1.5 block font-medium text-slate-200">
                  パスワード
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="8文字以上"
                  className="w-full rounded-xl border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-slate-50 outline-none ring-0 transition focus:border-pink-400 focus:ring-2 focus:ring-pink-500/50"
                />
              </div>

              {tab === 'signup' && (
                <div>
                  <label className="mb-1.5 block font-medium text-slate-200">
                    利用区分（ロール）
                  </label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value as Role)}
                    className="w-full rounded-xl border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-slate-50 outline-none ring-0 transition focus:border-pink-400 focus:ring-2 focus:ring-pink-500/50"
                  >
                    <option value="client">
                      依頼者として使う（カットモデルを探す / 依頼したい）
                    </option>
                    <option value="creator">
                      クリエイターとして使う（作品を投稿して依頼を受ける）
                    </option>
                  </select>
                </div>
              )}

              {/* ボタン */}
              <div className="pt-3 flex flex-col gap-2">
                {tab === 'login' ? (
                  <>
                    <button
                      type="button"
                      onClick={handleLogin}
                      disabled={loading}
                      className="w-full rounded-full bg-gradient-to-r from-pink-500 to-sky-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-pink-500/30 transition hover:brightness-110 disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {loading ? 'ログイン中…' : 'ログイン'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setTab('signup')}
                      className="w-full rounded-full border border-slate-600 bg-slate-900/60 px-4 py-2 text-sm font-semibold text-slate-100 hover:bg-slate-800/80 transition"
                    >
                      はじめての方はこちら
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={handleSignup}
                      disabled={loading}
                      className="w-full rounded-full bg-gradient-to-r from-sky-500 to-emerald-400 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-emerald-400/30 transition hover:brightness-110 disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {loading ? '登録中…' : '無料でアカウントを作成'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setTab('login')}
                      className="w-full rounded-full border border-slate-600 bg-slate-900/60 px-4 py-2 text-sm font-semibold text-slate-100 hover:bg-slate-800/80 transition"
                    >
                      すでにアカウントをお持ちの方
                    </button>
                  </>
                )}
              </div>
            </div>

            <p className="mt-4 text-[10px] text-slate-500 text-center">
              ログイン / 登録することで、Connectry の利用規約とプライバシーポリシーに同意したものとみなされます。
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}