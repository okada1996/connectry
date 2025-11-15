// app/works/[id]/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

type WorkRow = {
  id: string;
  creator_id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  created_at: string;
  is_public: boolean | null;
  work_id?: string | null;
};

type ProfileRow = {
  id: string;
  display_name: string | null;
  bio: string | null;
  genre: string | null;
  area: string | null;
  instagram_url: string | null;
};

type RequestFormState = {
  loading: boolean;
  errorMsg: string | null;
};

export default function WorkDetailPage() {
  const router = useRouter();
  const params = useParams(); // /works/[id]
  const workId = params?.id as string;

  const [work, setWork] = useState<WorkRow | null>(null);
  const [creatorProfile, setCreatorProfile] = useState<ProfileRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [isOwner, setIsOwner] = useState(false);
  const [updatingVisibility, setUpdatingVisibility] = useState(false);

  const [requestState, setRequestState] = useState<RequestFormState>({
    loading: false,
    errorMsg: null,
  });

  // 初期ロード：作品＋クリエイタープロフィール＋オーナー判定
  useEffect(() => {
    const init = async () => {
      if (!workId) return;

      setLoading(true);
      setErrorMsg(null);

      // 1. 作品取得
      const { data: workData, error: workError } = await supabase
        .from('works')
        .select('*')
        .eq('id', workId)
        .single();

      if (workError || !workData) {
        console.error('WorkDetail: 作品取得エラー', workError?.message);
        setErrorMsg('作品の情報を取得できませんでした。削除された可能性があります。');
        setLoading(false);
        return;
      }

      const w = workData as WorkRow;
      setWork(w);

      // 2. クリエイタープロフィール取得
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('id, display_name, bio, genre, area, instagram_url')
        .eq('id', w.creator_id)
        .single();

      if (profileError) {
        console.error('WorkDetail: プロフィール取得エラー', profileError.message);
      } else {
        setCreatorProfile(profileData as ProfileRow);
      }

      // 3. ログインユーザーとオーナー判定
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user && user.id === w.creator_id) {
        setIsOwner(true);
      } else {
        setIsOwner(false);
      }

      setLoading(false);
    };

    void init();
  }, [workId]);

  const formatDateTime = (iso: string) =>
    new Date(iso).toLocaleString('ja-JP', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });

  // 作品の公開 / 非公開切り替え
  const handleToggleVisibility = async () => {
    if (!work) return;
    setUpdatingVisibility(true);
    setErrorMsg(null);

    const nextVisible = !work.is_public;

    const { error } = await supabase
      .from('works')
      .update({ is_public: nextVisible })
      .eq('id', work.id);

    if (error) {
      console.error('WorkDetail: 公開状態更新エラー', error.message);
      setErrorMsg('公開状態の更新に失敗しました。時間をおいて再度お試しください。');
      setUpdatingVisibility(false);
      return;
    }

    setWork({ ...work, is_public: nextVisible });
    setUpdatingVisibility(false);
  };

  // 「このクリエイターに依頼する」ボタン
  const handleCreateRequest = async () => {
    if (!work) return;

    setRequestState({ loading: true, errorMsg: null });

    // 1) ログイン確認
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      // 未ログインならログイン画面へ（戻り先付き）
      router.push(`/auth/login?next=/requests/new?creatorId=${work.creator_id}&workId=${work.id}`);
      setRequestState({ loading: false, errorMsg: null });
      return;
    }

    // ログイン済みなら依頼フォームへ遷移（クエリパラメータに渡す）
    router.push(`/requests/new?creatorId=${work.creator_id}&workId=${work.id}`);
  };

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-56px)] flex items-center justify-center">
        <div className="text-xs text-slate-400">作品を読み込み中です…</div>
      </div>
    );
  }

  if (errorMsg || !work) {
    return (
      <div className="min-h-[calc(100vh-56px)] flex items-center justify-center">
        <div className="rounded-2xl border border-red-500/40 bg-red-950/40 px-4 py-3 text-xs text-red-100">
          {errorMsg || '作品が見つかりませんでした。'}
        </div>
      </div>
    );
  }

  const isPublic = work.is_public ?? true;

  return (
    <div className="min-h-[calc(100vh-56px)]">
      <main className="mx-auto w-full max-w-5xl space-y-6">
        {/* 上部ヘッダー */}
        <header className="flex items-center justify-between gap-3">
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={() => router.push('/works')}
              className="inline-flex items-center gap-1 self-start rounded-full border border-slate-700 bg-slate-900/70 px-3 py-1 text-[11px] text-slate-200 hover:bg-slate-800/80 transition"
            >
              <span className="text-xs">←</span>
              <span>作品一覧に戻る</span>
            </button>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-slate-200">
              <span className="h-1.5 w-1.5 rounded-full bg-pink-400" />
              <span>作品詳細</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">
              {work.title}
            </h1>
            <p className="text-[11px] text-slate-400">
              公開日: {formatDateTime(work.created_at)}
            </p>
          </div>

          {/* オーナー向けアクション */}
          {isOwner && (
            <div className="flex flex-col items-end gap-2 text-xs">
              <span
                className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 ${
                  isPublic
                    ? 'border-emerald-500/50 bg-emerald-950/40 text-emerald-100'
                    : 'border-slate-600 bg-slate-900/70 text-slate-200'
                }`}
              >
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                <span>{isPublic ? '公開中' : '非公開'}</span>
              </span>

              <div className="flex gap-2">
                {/* 作品編集ページへのリンク（後で実装する想定） */}
                <button
                  type="button"
                  onClick={() => router.push(`/works/${work.id}/edit`)}
                  className="rounded-full border border-slate-600 bg-slate-900/70 px-3 py-1.5 text-[11px] font-medium text-slate-100 hover:bg-slate-800/80 transition"
                >
                  作品を編集する
                </button>

                {/* 公開/非公開トグル */}
                <button
                  type="button"
                  onClick={handleToggleVisibility}
                  disabled={updatingVisibility}
                  className={`rounded-full px-3 py-1.5 text-[11px] font-medium transition ${
                    isPublic
                      ? 'border border-yellow-500/60 bg-yellow-500/10 text-yellow-100 hover:bg-yellow-500/20'
                      : 'border border-emerald-500/60 bg-emerald-500/10 text-emerald-100 hover:bg-emerald-500/20'
                  } disabled:opacity-60 disabled:cursor-not-allowed`}
                >
                  {updatingVisibility
                    ? '更新中…'
                    : isPublic
                    ? 'この作品を非公開にする'
                    : '作品を公開に戻す'}
                </button>
              </div>
            </div>
          )}
        </header>

        {/* エラー（公開状態更新など） */}
        {errorMsg && (
          <div className="rounded-2xl border border-red-500/40 bg-red-950/40 px-4 py-3 text-xs text-red-100">
            {errorMsg}
          </div>
        )}

        {/* メインコンテンツ */}
        <section className="grid gap-6 lg:grid-cols-[1.6fr_1.1fr]">
          {/* 左：作品画像＋説明 */}
          <div className="space-y-4">
            <div className="overflow-hidden rounded-3xl border border-white/10 bg-slate-900/80 shadow-[0_18px_45px_rgba(15,23,42,0.8)]">
              <div className="relative w-full pt-[75%] bg-slate-900">
                {work.image_url ? (
                  <img
                    src={work.image_url}
                    alt={work.title}
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-xs text-slate-500">
                    画像が登録されていません
                  </div>
                )}
              </div>
            </div>

            {work.description && (
              <div className="rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-xs text-slate-200">
                <h2 className="mb-2 text-[13px] font-semibold text-slate-100">
                  作品の説明
                </h2>
                <p className="whitespace-pre-wrap leading-relaxed text-[12px]">
                  {work.description}
                </p>
              </div>
            )}
          </div>

          {/* 右：クリエイター情報＋依頼導線 */}
          <aside className="space-y-4">
            {/* クリエイターカード */}
            <div className="rounded-3xl border border-white/10 bg-slate-950/80 px-4 py-4 shadow-[0_18px_45px_rgba(15,23,42,0.8)]">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-pink-400 via-sky-400 to-emerald-400 text-xs font-semibold text-slate-950">
                    {(creatorProfile?.display_name || '？').charAt(0).toUpperCase()}
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-semibold text-slate-50">
                      {creatorProfile?.display_name || 'クリエイター'}
                    </span>
                    <span className="text-[11px] text-slate-400">
                      {creatorProfile?.genre || 'ジャンル未設定'}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => router.push(`/profile/${work.creator_id}`)}
                  className="rounded-full border border-slate-600 bg-slate-900/70 px-3 py-1.5 text-[11px] text-slate-100 hover:bg-slate-800/80 transition"
                >
                  プロフィールを見る
                </button>
              </div>

              {creatorProfile?.bio && (
                <p className="mt-3 text-[11px] text-slate-300 leading-relaxed">
                  {creatorProfile.bio}
                </p>
              )}

              <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-slate-400">
                <div className="rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2">
                  <div className="mb-1 text-[10px] text-slate-500">活動エリア</div>
                  <div>{creatorProfile?.area || '未設定'}</div>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2">
                  <div className="mb-1 text-[10px] text-slate-500">外部リンク</div>
                  {creatorProfile?.instagram_url ? (
                    <a
                      href={creatorProfile.instagram_url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sky-300 hover:text-sky-200 underline underline-offset-2"
                    >
                      ポートフォリオを見る
                    </a>
                  ) : (
                    <span>未登録</span>
                  )}
                </div>
              </div>
            </div>

            {/* 依頼導線 */}
            {!isOwner && (
              <div className="rounded-3xl border border-pink-500/30 bg-pink-500/5 px-4 py-4 shadow-[0_18px_45px_rgba(236,72,153,0.45)]">
                <h2 className="text-sm font-semibold text-slate-50">
                  このクリエイターに依頼する
                </h2>
                <p className="mt-1 text-[11px] text-slate-200">
                  具体的な内容は、次の画面で「依頼タイトル」「内容」「希望時期」などを入力できます。
                </p>
                {requestState.errorMsg && (
                  <p className="mt-2 text-[11px] text-red-300">
                    {requestState.errorMsg}
                  </p>
                )}
                <button
                  type="button"
                  onClick={handleCreateRequest}
                  disabled={requestState.loading}
                  className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-pink-500 to-sky-500 px-4 py-2 text-xs font-semibold text-white shadow-md shadow-pink-500/40 hover:brightness-110 transition disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {requestState.loading ? '画面を開いています…' : '依頼フォームを開く'}
                </button>
              </div>
            )}
          </aside>
        </section>
      </main>
    </div>
  );
}