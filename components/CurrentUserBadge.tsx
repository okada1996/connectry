// components/CurrentUserBadge.tsx
'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

type ProfileRow = {
  id: string;
  role: 'creator' | 'client' | null;
  display_name: string | null;
};

export default function CurrentUserBadge() {
  const router = useRouter();
  const pathname = usePathname(); // URL が変わるたびに変化

  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  // プロフィールを Supabase から取得
  const fetchProfile = async () => {
    setLoading(true);

    // 1. 認証ユーザー取得
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setProfile(null);
      setLoading(false);
      return;
    }

    // 2. profiles から表示名など取得
    const { data, error } = await supabase
      .from('profiles')
      .select('id, role, display_name')
      .eq('id', user.id)
      .single();

    if (error || !data) {
      console.error('CurrentUserBadge: プロフィール取得エラー', error?.message);
      setProfile(null);
      setLoading(false);
      return;
    }

    setProfile(data as ProfileRow);
    setLoading(false);
  };

  useEffect(() => {
    // 初回＋「URL が変わるたび」にプロフィール再取得
    void fetchProfile();
    setOpen(false); // ルートが変わったらメニュー閉じる
  }, [pathname]);

  const getInitial = (name: string | null) => {
    if (!name || name.trim().length === 0) return '?';
    return name.trim().charAt(0).toUpperCase();
  };

  const roleLabel = (role: ProfileRow['role']) => {
    switch (role) {
      case 'creator':
        return 'クリエイター';
      case 'client':
        return '依頼者';
      default:
        return 'ユーザー';
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/auth/login'); // ログアウトしたらログイン画面へ
    // pathname が変わるので useEffect → fetchProfile → profile=null に更新される
  };

  // ローディング中プレースホルダ
  if (loading) {
    return (
      <div className="flex items-center gap-2 text-[11px] text-slate-400">
        <div className="h-7 w-7 rounded-full bg-slate-700/60 animate-pulse" />
        <div className="h-3 w-20 rounded-full bg-slate-700/60 animate-pulse" />
      </div>
    );
  }

  // 未ログイン表示
  if (!profile) {
    return (
      <div className="flex items-center gap-2 text-[11px]">
        <button
          type="button"
          onClick={() => router.push('/auth/login')}
          className="rounded-full border border-slate-600 bg-slate-900/70 px-3 py-1 text-xs font-medium text-slate-100 hover:bg-slate-800/80 transition"
        >
          ログイン
        </button>
        <button
          type="button"
          onClick={() => router.push('/auth/login?tab=signup')}
          className="rounded-full bg-gradient-to-r from-pink-500 to-sky-500 px-3 py-1 text-xs font-semibold text-white shadow-md shadow-pink-500/30 hover:brightness-110 transition"
        >
          新規登録
        </button>
      </div>
    );
  }

  // ログイン済み表示
  return (
    <div className="relative">
      {/* 本体ボタン */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="group inline-flex items-center gap-2 rounded-full border border-slate-600 bg-slate-900/70 px-3 py-1 text-left text-[11px] text-slate-100 hover:border-pink-400/80 hover:bg-slate-800/80 transition"
      >
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-pink-400 via-sky-400 to-emerald-400 text-[11px] font-semibold text-slate-950 shadow-sm shadow-pink-500/40">
          {getInitial(profile.display_name)}
        </div>
        <div className="flex flex-col leading-tight">
          <span className="max-w-[120px] truncate text-[11px] font-medium">
            {profile.display_name || '名無しのユーザー'}
          </span>
          <span className="text-[10px] text-slate-400 group-hover:text-pink-200 transition">
            {roleLabel(profile.role)}としてログイン中
          </span>
        </div>
      </button>

      {/* ドロップダウンメニュー */}
      {open && (
        <div className="absolute right-0 mt-2 w-40 rounded-xl border border-slate-700 bg-slate-900/95 backdrop-blur shadow-lg shadow-black/40 p-1 text-xs">
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              router.push(`/profile/${profile.id}`);
            }}
            className="w-full text-left px-3 py-2 rounded-md text-slate-100 hover:bg-slate-800/90 hover:text-white transition"
          >
            プロフィールを見る
          </button>
          <button
            type="button"
            onClick={handleLogout}
            className="w-full text-left px-3 py-2 rounded-md text-red-300 hover:bg-red-500/20 transition"
          >
            ログアウト
          </button>
        </div>
      )}
    </div>
  );
}