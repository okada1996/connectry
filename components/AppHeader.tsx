// components/AppHeader.tsx
'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import CurrentUserBadge from '@/components/CurrentUserBadge';
import { supabase } from '@/lib/supabaseClient';

// ロール型
type Role = 'creator' | 'client' | null;

type ProfileMini = {
  id: string;
  role: Role;
};

export default function AppHeader() {
  const pathname = usePathname();
  const isAuthPage = pathname?.startsWith('/auth/login');

  // 🔔 未読カウント
  const [unreadCount, setUnreadCount] = useState(0);

  // 👤 ログイン中ユーザーの簡易プロフィール（id / role）
  const [profile, setProfile] = useState<ProfileMini | null>(null);

  useEffect(() => {
    const fetchHeaderInfo = async () => {
      try {
        // 1. ログインユーザー取得
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError) {
          console.error('AppHeader: auth.getUser エラー', userError.message);
        }

        if (!user) {
          // 未ログインなら全部リセット
          setProfile(null);
          setUnreadCount(0);
          return;
        }

        const userId = user.id;

        // 2. profiles から role を取得
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('id, role')
          .eq('id', userId)
          .single();

        if (profileError) {
          console.error('AppHeader: profiles 取得エラー', profileError.message);
          setProfile(null);
        } else if (profileData) {
          setProfile(profileData as ProfileMini);
        }

        // 3. 自分が関係者の requests を取得（creator / client 両方）
        const { data: asCreator, error: creatorReqError } = await supabase
          .from('requests')
          .select('id')
          .eq('creator_id', userId);

        if (creatorReqError) {
          console.error('AppHeader: requests(creator) 取得エラー', creatorReqError.message);
        }

        const { data: asClient, error: clientReqError } = await supabase
          .from('requests')
          .select('id')
          .eq('client_id', userId);

        if (clientReqError) {
          console.error('AppHeader: requests(client) 取得エラー', clientReqError.message);
        }

        const requestIds = Array.from(
          new Set([
            ...(asCreator ?? []).map((r) => r.id as string),
            ...(asClient ?? []).map((r) => r.id as string),
          ])
        );

        if (requestIds.length === 0) {
          setUnreadCount(0);
          return;
        }

        // 4. 未読メッセージ数を取得（自分以外が送った is_read = false）
        const { data: unreadMsgs, error: unreadError } = await supabase
          .from('messages')
          .select('id')
          .in('request_id', requestIds)
          .eq('is_read', false)
          .neq('sender_id', userId);

        if (unreadError) {
          console.error('AppHeader: 未読メッセージ取得エラー', unreadError.message);
          return;
        }

        setUnreadCount(unreadMsgs?.length ?? 0);
      } catch (e) {
        console.error('AppHeader: 予期せぬエラー', e);
      }
    };

    // パスが変わるたびに再取得（ページ遷移ごとに未読/ロールを更新）
    void fetchHeaderInfo();
  }, [pathname]);

  // 🔒 ログイン画面だけヘッダー非表示
  if (isAuthPage) return null;

  // 🔔 未読バッジのレンダリング
  const renderUnreadBadge = () => {
    if (unreadCount <= 0) return null;
    return (
      <span className="ml-1 inline-flex min-w-[1.2rem] items-center justify-center rounded-full bg-pink-500 px-1.5 text-[10px] font-semibold text-white">
        {unreadCount > 9 ? '9+' : unreadCount}
      </span>
    );
  };

  return (
    <header className="sticky top-0 z-20 border-b border-white/10 bg-slate-950/75 backdrop-blur">
      <div className="max-w-6xl mx-auto h-14 flex items-center justify-between px-4">
        {/* 左：ロゴ */}
        <a href="/works" className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-2xl bg-gradient-to-br from-pink-400 via-violet-400 to-sky-400 flex items-center justify-center text-xs font-bold text-white shadow-lg shadow-pink-500/30">
            Ct
          </div>
          <div className="flex flex-col leading-tight">
            <span className="text-sm font-semibold tracking-tight">Connectry</span>
            <span className="text-[10px] text-slate-400">
              Creators × Chance Matching
            </span>
          </div>
        </a>

        {/* 右：ナビ＋ログイン状況 */}
        <div className="flex items-center gap-4">
          <nav className="hidden sm:flex items-center gap-6 text-xs text-slate-300">
            {/* 全員共通：作品一覧 */}
            <a href="/works" className="hover:text-white transition">
              作品を探す
            </a>

            {/* ログインしている場合のみ、依頼・投稿・マイページを出す */}
            {profile && (
              <>
                {/* creator だけ：作品投稿 */}
                {profile.role === 'creator' && (
                  <a
                    href="/works/new"
                    className="hover:text-white transition"
                  >
                    作品を投稿
                  </a>
                )}

                {/* 両方：依頼一覧（未読バッジ付き） */}
                <a
                  href="/requests"
                  className="hover:text-white transition inline-flex items-center"
                >
                  <span>依頼一覧</span>
                  {renderUnreadBadge()}
                </a>

                {/* 両方：マイページ */}
                <a
                  href={`/profile/${profile.id}`}
                  className="hover:text-white transition"
                >
                  マイページ
                </a>
              </>
            )}
          </nav>

          {/* ログイン状況（未ログインならログイン/新規登録ボタン、ログイン中ならバッジ） */}
          <CurrentUserBadge />
        </div>
      </div>
    </header>
  );
}