// app/profile/[id]/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

type ProfileRow = {
  id: string;
  role: 'creator' | 'client' | null;
  display_name: string | null;
  bio: string | null;
  genre: string | null;
  area: string | null;
  instagram_url: string | null;
};

type WorkCard = {
  id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  created_at: string;
};

export default function ProfileDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const profileId = params?.id;

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [works, setWorks] = useState<WorkCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // ログインユーザー（自分かどうか判定用）
  useEffect(() => {
    const init = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        setCurrentUserId(user.id);
      }
    };
    void init();
  }, []);

  // プロフィール & 作品取得
  useEffect(() => {
    const fetchData = async () => {
      if (!profileId) return;
      setLoading(true);
      setErrorMsg(null);

      try {
        // プロフィール取得
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', profileId)
          .single();

        if (profileError || !profileData) {
          console.error('プロフィール取得エラー:', profileError?.message);
          setErrorMsg('プロフィールが見つかりませんでした。');
          setLoading(false);
          return;
        }

        const p = profileData as ProfileRow;
        setProfile(p);

        // 作品取得（creator の場合中心だが、roleに関わらず取得してOK）
        const { data: worksData, error: worksError } = await supabase
          .from('works')
          .select('id, title, description, image_url, created_at')
          .eq('creator_id', profileId)
          .order('created_at', { ascending: false });

        if (worksError) {
          console.error('作品取得エラー:', worksError.message);
          setErrorMsg('作品一覧の取得に失敗しました。');
          setLoading(false);
          return;
        }

        setWorks((worksData || []) as WorkCard[]);
        setLoading(false);
      } catch (e) {
        console.error('プロフィール詳細取得中の予期せぬエラー:', e);
        setErrorMsg('プロフィール情報の取得に失敗しました。');
        setLoading(false);
      }
    };

    void fetchData();
  }, [profileId]);

  const isMe = currentUserId && profile && currentUserId === profile.id;

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });

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

  const instagramUrl = profile?.instagram_url?.trim() || '';

  return (
    <div className="min-h-[calc(100vh-56px)] bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-slate-50">
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 py-6 sm:px-6 lg:px-8">
        {/* 戻る（ひとまず作品一覧へ） */}
        <button
          type="button"
          onClick={() => router.push('/works')}
          className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-slate-100 transition"
        >
          <span className="text-sm">←</span>
          <span>作品一覧に戻る</span>
        </button>

        {/* エラー */}
        {errorMsg && (
          <div className="rounded-2xl border border-red-500/40 bg-red-950/40 px-4 py-3 text-xs text-red-100">
            {errorMsg}
          </div>
        )}

        {/* ローディング */}
        {loading || !profile ? (
          <div className="flex h-40 items-center justify-center text-xs text-slate-400">
            プロフィールを読み込み中です…
          </div>
        ) : (
          <>
            {/* プロフィールヘッダー */}
            <section className="rounded-3xl border border-white/15 bg-slate-900/80 px-4 py-5 sm:px-6 sm:py-6 shadow-[0_18px_45px_rgba(15,23,42,0.7)]">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-4">
                  {/* アイコン（イニシャル） */}
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-pink-400 via-sky-400 to-emerald-400 text-lg font-semibold text-slate-950 shadow-lg shadow-pink-500/40">
                    {getInitial(profile.display_name)}
                  </div>

                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h1 className="text-xl font-semibold tracking-tight">
                        {profile.display_name || '名無しのユーザー'}
                      </h1>
                      <span className="inline-flex items-center rounded-full border border-slate-600 bg-slate-900/80 px-3 py-1 text-[11px] text-slate-100">
                        {roleLabel(profile.role)}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400">
                      Connectry のプロフィールページ
                    </p>
                  </div>
                </div>

                {isMe && (
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => router.push('/profile/edit')}
                      className="rounded-full bg-gradient-to-r from-pink-500 to-sky-500 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-pink-500/30 transition hover:brightness-110"
                    >
                      プロフィールを編集する
                    </button>
                  </div>
                )}
              </div>

              {/* プロフィール詳細 */}
              <div className="mt-4 grid gap-4 sm:grid-cols-[1.3fr_1fr] text-xs">
                {/* 左：自己紹介など */}
                <div className="space-y-3">
                  <div>
                    <div className="mb-1 text-[11px] font-medium text-slate-300">
                      自己紹介
                    </div>
                    <p className="rounded-2xl border border-slate-700/70 bg-slate-950/70 px-3 py-3 text-[12px] leading-relaxed text-slate-100 whitespace-pre-wrap">
                      {profile.bio && profile.bio.trim().length > 0
                        ? profile.bio
                        : '自己紹介はまだ登録されていません。'}
                    </p>
                  </div>
                </div>

                {/* 右：ジャンル・エリア・SNS */}
                <div className="space-y-3">
                  <div>
                    <div className="mb-1 text-[11px] font-medium text-slate-300">
                      得意ジャンル
                    </div>
                    <p className="rounded-2xl border border-slate-700/70 bg-slate-950/70 px-3 py-2 text-[12px] text-slate-100">
                      {profile.genre && profile.genre.trim().length > 0
                        ? profile.genre
                        : '未設定'}
                    </p>
                  </div>

                  <div>
                    <div className="mb-1 text-[11px] font-medium text-slate-300">
                      活動エリア
                    </div>
                    <p className="rounded-2xl border border-slate-700/70 bg-slate-950/70 px-3 py-2 text-[12px] text-slate-100">
                      {profile.area && profile.area.trim().length > 0
                        ? profile.area
                        : '未設定'}
                    </p>
                  </div>

                  <div>
                    <div className="mb-1 text-[11px] font-medium text-slate-300">
                      Instagram
                    </div>
                    {instagramUrl ? (
                      <a
                        href={instagramUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-2 rounded-full border border-slate-600 bg-slate-950/70 px-3 py-2 text-[12px] text-slate-100 hover:border-pink-400 hover:text-pink-300 transition"
                      >
                        <span className="h-5 w-5 rounded-full bg-gradient-to-br from-pink-400 via-purple-400 to-yellow-300" />
                        <span className="truncate max-w-[180px]">
                          {instagramUrl}
                        </span>
                      </a>
                    ) : (
                      <p className="rounded-2xl border border-slate-700/70 bg-slate-950/70 px-3 py-2 text-[12px] text-slate-100">
                        未登録
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </section>

            {/* 作品一覧 */}
            <section className="rounded-3xl border border-white/15 bg-slate-900/80 px-4 py-5 sm:px-6 sm:py-6 shadow-[0_18px_45px_rgba(15,23,42,0.7)]">
              <div className="mb-3 flex items-center justify-between gap-2">
                <div>
                  <h2 className="text-sm font-semibold">
                    作品一覧
                  </h2>
                  <p className="mt-1 text-[11px] text-slate-400">
                    {works.length > 0
                      ? `${works.length}件の作品が登録されています。`
                      : 'まだ作品は登録されていません。'}
                  </p>
                </div>
              </div>

              {works.length === 0 ? (
                <div className="flex h-24 items-center justify-center rounded-2xl border border-dashed border-slate-700/70 bg-slate-950/60 text-[11px] text-slate-400">
                  作品が投稿されると、ここに一覧表示されます。
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {works.map((work) => (
                    <button
                      key={work.id}
                      type="button"
                      onClick={() => router.push(`/works/${work.id}`)}
                      className="group flex flex-col overflow-hidden rounded-2xl border border-slate-700/70 bg-slate-950/70 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-pink-400/70 hover:shadow-pink-500/20"
                    >
                      <div className="relative h-40 w-full overflow-hidden bg-slate-800">
                        {work.image_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={work.image_url}
                            alt={work.title}
                            className="h-full w-full object-cover transition duration-300 group-hover:scale-105 group-hover:brightness-110"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-xs text-slate-500">
                            No Image
                          </div>
                        )}
                        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-950/70 via-transparent to-transparent" />
                      </div>
                      <div className="flex flex-1 flex-col gap-1 px-3 py-2">
                        <h3 className="line-clamp-2 text-sm font-medium text-slate-50">
                          {work.title}
                        </h3>
                        <p className="line-clamp-2 text-[11px] text-slate-400">
                          {work.description || '説明文は登録されていません。'}
                        </p>
                        <p className="mt-1 text-[10px] text-slate-500">
                          投稿日：{formatDate(work.created_at)}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
}