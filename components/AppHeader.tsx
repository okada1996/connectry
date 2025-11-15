// components/AppHeader.tsx
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import CurrentUserBadge from '@/components/CurrentUserBadge';

type Role = 'creator' | 'client' | null;

export default function AppHeader() {
  const [role, setRole] = useState<Role>(null);
  const [loading, setLoading] = useState(true);

  // ロールだけ軽く取得
  useEffect(() => {
    const fetchRole = async () => {
      setLoading(true);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setRole(null);
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      if (error || !data) {
        console.error('AppHeader: role取得エラー', error?.message);
        setRole(null);
        setLoading(false);
        return;
      }

      setRole((data.role as Role) ?? null);
      setLoading(false);
    };

    void fetchRole();
  }, []);

  return (
    <header className="sticky top-0 z-20 border-b border-white/10 bg-slate-950/75 backdrop-blur">
      <div className="max-w-6xl mx-auto h-14 flex items-center justify-between px-4">
        {/* 左：ロゴ */}
        <div className="flex items-center gap-3">
          <Link href="/works" className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-2xl bg-gradient-to-br from-pink-400 via-violet-400 to-sky-400 flex items-center justify-center text-xs font-bold text-white shadow-lg shadow-pink-500/30">
              Ct
            </div>
            <div className="flex flex-col leading-tight">
              <span className="text-sm font-semibold tracking-tight">
                Connectry
              </span>
              <span className="text-[10px] text-slate-400">
                Creators × Chance Matching
              </span>
            </div>
          </Link>
        </div>

        {/* 右：ナビゲーション */}
        <nav className="hidden sm:flex items-center gap-4 text-xs text-slate-300">
          {/* 共通メニュー */}
          <Link href="/works" className="hover:text-white transition">
            作品を探す
          </Link>

          <Link href="/requests" className="hover:text-white transition">
            依頼一覧
          </Link>

          {/* クリエイター専用メニュー */}
          {!loading && role === 'creator' && (
            <Link
              href="/works/new"
              className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-pink-500 to-sky-500 px-3 py-1.5 text-[11px] font-semibold text-white shadow-md shadow-pink-500/30 hover:brightness-110 transition"
            >
              <span className="text-[13px]">＋</span>
              <span>作品を投稿する</span>
            </Link>
          )}

          {/* ログイン状態バッジ（ログイン / 新規登録もここで切り替え） */}
          <CurrentUserBadge />
        </nav>
      </div>
    </header>
  );
}