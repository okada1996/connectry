// app/profile/[id]/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

type Role = 'creator' | 'client' | null;

type ProfileRow = {
  id: string;
  display_name: string | null;
  role: Role;
  bio: string | null;
  genre: string | null;
  area: string | null;
  instagram_url: string | null;
};

type WorkRow = {
  id: string;
  title: string;
  image_url: string | null;
  created_at: string;
  is_public: boolean | null;
};

type ViewModel = {
  profile: ProfileRow;
  works: WorkRow[];
  isMe: boolean;
};

export default function ProfileDetailPage() {
  const params = useParams();
  const router = useRouter();
  const profileId = params?.id as string;

  const [view, setView] = useState<ViewModel | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    const init = async () => {
      if (!profileId) return;
      setLoading(true);
      setErrorMsg(null);

      try {
        // 1. ログインユーザー
        const {
          data: { user },
        } = await supabase.auth.getUser();
        const currentUserId = user?.id ?? null;

        // 2. profiles 取得
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('id, display_name, role, bio, genre, area, instagram_url')
          .eq('id', profileId)
          .single();

        if (profileError || !profileData) {
          console.error('ProfileDetail: profiles 取得エラー', profileError?.message);
          setErrorMsg('プロフィール情報を取得できませんでした。削除された可能性があります。');
          setLoading(false);
          return;
        }

        const profile = profileData as ProfileRow;
        const isMe = currentUserId === profile.id;

        let works: WorkRow[] = [];

        // 3. クリエイターの場合のみ作品一覧を取得
        if (profile.role === 'creator') {
          const { data: worksData, error: worksError } = await supabase
            .from('works')
            .select('id, title, image_url, created_at, is_public')
            .eq('creator_id', profile.id)
            .order('created_at', { ascending: false });

          if (worksError) {
            console.error('ProfileDetail: works 取得エラー', worksError.message);
          } else {
            if (isMe) {
              // 自分のプロフィールの場合：公開／非公開問わず全件表示
              works = (worksData || []) as WorkRow[];
            } else {
              // 他人から見た場合：公開作品のみ表示
              works = (worksData || []).filter(
                (w) => w.is_public === true
              ) as WorkRow[];
            }
          }
        }

        setView({
          profile,
          works,
          isMe,
        });
        setLoading(false);
      } catch (e) {
        console.error('ProfileDetail: 予期せぬエラー', e);
        setErrorMsg('プロフィールの取得中にエラーが発生しました。');
        setLoading(false);
      }
    };

    void init();
  }, [profileId]);

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('ja-JP', {
      month: 'numeric',
      day: 'numeric',
    });

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-56px)] flex items-center justify-center">
        <div className="text-xs text-slate-400">プロフィールを読み込み中です…</div>
      </div>
    );
  }

  if (errorMsg || !view) {
    return (
      <div className="min-h-[calc(100vh-56px)] flex items-center justify-center">
        <div className="rounded-2xl border border-red-500/40 bg-red-950/40 px-4 py-3 text-xs text-red-100">
          {errorMsg || 'プロフィールが見つかりませんでした。'}
        </div>
      </div>
    );
  }

  const { profile, works, isMe } = view;
  const isCreator = profile.role === 'creator';
  const isClient = profile.role === 'client';

  const roleLabel = (() => {
    switch (profile.role) {
      case 'creator':
        return 'クリエイター';
      case 'client':
        return '依頼者';
      default:
        return 'ユーザー';
    }
  })();

  // ◇ 依頼者用（client）のシンプル表示レイアウト
  if (isClient) {
    return (
      <div className="min-h-[calc(100vh-56px)]">
        <main className="mx-auto w-full max-w-4xl space-y-6">
          {/* 戻る */}
          <div className="mb-1">
            <button
              type="button"
              onClick={() => router.back()}
              className="inline-flex items-center gap-1 rounded-full border border-slate-700 bg-slate-900/70 px-3 py-1 text-[11px] text-slate-200 hover:bg-slate-800/80 transition"
            >
              <span className="text-xs">←</span>
              <span>戻る</span>
            </button>
          </div>

          {/* ヘッダー */}
          <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-pink-400 via-sky-400 to-emerald-400 text-sm font-semibold text-slate-950">
                {(profile.display_name || '？').charAt(0).toUpperCase()}
              </div>
              <div className="flex flex-col">
                <h1 className="text-lg sm:text-xl font-semibold tracking-tight text-white">
                  {profile.display_name || 'ユーザー'}
                </h1>
                <div className="mt-1 inline-flex items-center gap-2 text-[11px] text-slate-400">
                  <span className="rounded-full border border-slate-600 bg-slate-900/80 px-2 py-0.5">
                    {roleLabel}
                  </span>
                  {isMe && (
                    <span className="text-slate-400">（あなたのプロフィール）</span>
                  )}
                </div>
              </div>
            </div>

            {isMe && (
              <button
                type="button"
                onClick={() => router.push('/profile/edit')}
                className="mt-2 inline-flex items-center justify-center rounded-full border border-slate-600 bg-slate-900/80 px-4 py-1.5 text-[11px] font-semibold text-slate-100 hover:bg-slate-800/80 transition"
              >
                プロフィールを編集する
              </button>
            )}
          </header>

          {/* 自己紹介 */}
          <section className="space-y-4">
            <div className="rounded-3xl border border-white/10 bg-slate-950/80 px-4 py-4 text-xs text-slate-200">
              <h2 className="mb-2 text-[13px] font-semibold text-slate-50">
                自己紹介
              </h2>
              {profile.bio ? (
                <p className="whitespace-pre-wrap leading-relaxed text-[12px]">
                  {profile.bio}
                </p>
              ) : (
                <p className="text-[11px] text-slate-500">
                  まだ自己紹介は登録されていません。
                </p>
              )}
            </div>

            {/* 興味のあるジャンル */}
            <div className="rounded-3xl border border-white/10 bg-slate-950/80 px-4 py-4 text-xs text-slate-200">
              <h2 className="mb-2 text-[13px] font-semibold text-slate-50">
                興味のあるジャンル
              </h2>
              {profile.genre ? (
                <p className="leading-relaxed text-[12px]">{profile.genre}</p>
              ) : (
                <p className="text-[11px] text-slate-500">
                  興味のあるジャンルはまだ登録されていません。
                </p>
              )}
            </div>
          </section>
        </main>
      </div>
    );
  }

  // ◇ クリエイター用（今まで通りリッチ表示＋作品一覧）
  return (
    <div className="min-h-[calc(100vh-56px)]">
      <main className="mx-auto w-full max-w-5xl space-y-6">
        {/* 戻る */}
        <div className="mb-1">
          <button
            type="button"
            onClick={() => router.back()}
            className="inline-flex items-center gap-1 rounded-full border border-slate-700 bg-slate-900/70 px-3 py-1 text-[11px] text-slate-200 hover:bg-slate-800/80 transition"
          >
            <span className="text-xs">←</span>
            <span>戻る</span>
          </button>
        </div>

        {/* 上部ヘッダー */}
        <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-pink-400 via-sky-400 to-emerald-400 text-sm font-semibold text-slate-950">
              {(profile.display_name || '？').charAt(0).toUpperCase()}
            </div>
            <div className="flex flex-col">
              <h1 className="text-lg sm:text-xl font-semibold tracking-tight text-white">
                {profile.display_name || 'クリエイター'}
              </h1>
              <div className="mt-1 inline-flex items-center gap-2 text-[11px] text-slate-400">
                <span className="rounded-full border border-slate-600 bg-slate-900/80 px-2 py-0.5">
                  {roleLabel}
                </span>
                {profile.area && (
                  <span className="rounded-full border border-slate-600 bg-slate-900/80 px-2 py-0.5">
                    活動エリア: {profile.area}
                  </span>
                )}
                {isMe && (
                  <span className="text-slate-400">（あなたのプロフィール）</span>
                )}
              </div>
            </div>
          </div>

          {isMe && (
            <button
              type="button"
              onClick={() => router.push('/profile/edit')}
              className="mt-2 inline-flex items-center justify-center rounded-full border border-slate-600 bg-slate-900/80 px-4 py-1.5 text-[11px] font-semibold text-slate-100 hover:bg-slate-800/80 transition"
            >
              プロフィールを編集する
            </button>
          )}
        </header>

        {/* 上段：自己紹介・リンク */}
        <section className="grid gap-4 lg:grid-cols-[1.6fr_1.1fr]">
          {/* 自己紹介 */}
          <div className="rounded-3xl border border-white/10 bg-slate-950/80 px-4 py-4 text-xs text-slate-200">
            <h2 className="mb-2 text-[13px] font-semibold text-slate-50">
              自己紹介
            </h2>
            {profile.bio ? (
              <p className="whitespace-pre-wrap leading-relaxed text-[12px]">
                {profile.bio}
              </p>
            ) : (
              <p className="text-[11px] text-slate-500">
                まだ自己紹介は登録されていません。
              </p>
            )}
          </div>

          {/* サイド情報 */}
          <aside className="space-y-3 text-xs">
            <div className="rounded-3xl border border-slate-800 bg-slate-950/80 px-4 py-3">
              <h3 className="mb-1 text-[12px] font-semibold text-slate-50">
                得意・メインのジャンル
              </h3>
              {profile.genre ? (
                <p className="text-[12px] text-slate-200">{profile.genre}</p>
              ) : (
                <p className="text-[11px] text-slate-500">未設定</p>
              )}
            </div>

            <div className="rounded-3xl border border-slate-800 bg-slate-950/80 px-4 py-3">
              <h3 className="mb-1 text-[12px] font-semibold text-slate-50">
                外部リンク
              </h3>
              {profile.instagram_url ? (
                <a
                  href={profile.instagram_url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[12px] text-sky-300 hover:text-sky-200 underline underline-offset-2 break-all"
                >
                  ポートフォリオを見る
                </a>
              ) : (
                <p className="text-[11px] text-slate-500">未登録</p>
              )}
            </div>
          </aside>
        </section>

        {/* 作品一覧 */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-50">
              このクリエイターの作品
            </h2>
            {isMe && (
              <button
                type="button"
                onClick={() => router.push('/works/new')}
                className="rounded-full bg-gradient-to-r from-pink-500 to-sky-500 px-4 py-1.5 text-[11px] font-semibold text-white shadow-md shadow-pink-500/40 hover:brightness-110 transition"
              >
                新しい作品を投稿する
              </button>
            )}
          </div>

          {works.length === 0 ? (
            <div className="rounded-3xl border border-slate-800 bg-slate-950/80 px-4 py-6 text-center text-[11px] text-slate-500">
              {isMe
                ? 'まだ作品がありません。右上の「新しい作品を投稿する」から追加できます。'
                : '公開中の作品はまだありません。'}
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {works.map((work) => (
                <button
                  key={work.id}
                  type="button"
                  onClick={() => router.push(`/works/${work.id}`)}
                  className="group flex flex-col overflow-hidden rounded-3xl border border-slate-800/80 bg-slate-900/80 text-left shadow-[0_14px_35px_rgba(15,23,42,0.7)] transition hover:-translate-y-1 hover:border-pink-400/70 hover:shadow-[0_20px_45px_rgba(236,72,153,0.45)]"
                >
                  <div className="relative h-36 w-full overflow-hidden bg-slate-800">
                    {work.image_url ? (
                      <img
                        src={work.image_url}
                        alt={work.title}
                        className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.05]"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-[11px] text-slate-500">
                        画像なし
                      </div>
                    )}
                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-950/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition" />
                  </div>
                  <div className="flex flex-1 flex-col gap-1 px-4 py-3">
                    <h3 className="truncate text-sm font-semibold text-slate-50">
                      {work.title}
                    </h3>
                    <div className="mt-1 flex items-center justify-between">
                      <span className="inline-flex items-center gap-1 text-[10px] text-slate-400">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400/80" />
                        <span>{formatDate(work.created_at)} 作成</span>
                      </span>
                      {isMe && work.is_public === false && (
                        <span className="rounded-full border border-yellow-500/60 bg-yellow-500/10 px-2 py-0.5 text-[9px] text-yellow-200">
                          非公開
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}