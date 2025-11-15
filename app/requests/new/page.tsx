// app/requests/new/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

type CreatorProfile = {
  id: string;
  display_name: string | null;
  bio: string | null;
  genre: string | null;
  area: string | null;
};

type WorkSummary = {
  id: string;
  title: string;
  image_url: string | null;
  description: string | null;
};

export default function NewRequestPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const creatorId = searchParams.get('creatorId');
  const workId = searchParams.get('workId');

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const [creator, setCreator] = useState<CreatorProfile | null>(null);
  const [work, setWork] = useState<WorkSummary | null>(null);

  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [preferredTime, setPreferredTime] = useState('');
  const [budget, setBudget] = useState('');

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // 初期ロード：ユーザー認証＋クリエイター情報＋作品情報
  useEffect(() => {
    const init = async () => {
      if (!creatorId) {
        setErrorMsg('無効なアクセスです。クリエイターが指定されていません。');
        setLoading(false);
        return;
      }

      setLoading(true);
      setErrorMsg(null);

      // 1) ログインユーザー確認
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        // 未ログイン → ログイン画面へ飛ばす（戻り先はこのページ）
        const next = `/requests/new?creatorId=${creatorId}${workId ? `&workId=${workId}` : ''}`;
        router.push(`/auth/login?next=${encodeURIComponent(next)}`);
        return;
      }

      setCurrentUserId(user.id);

      // 2) クリエイター情報
      const { data: creatorData, error: creatorError } = await supabase
        .from('profiles')
        .select('id, display_name, bio, genre, area')
        .eq('id', creatorId)
        .maybeSingle();

      if (creatorError || !creatorData) {
        setErrorMsg('クリエイター情報の取得に失敗しました。');
        setLoading(false);
        return;
      }

      setCreator(creatorData as CreatorProfile);

      // 3) 作品情報（workId があるときだけ）
      if (workId) {
        const { data: workData, error: workError } = await supabase
          .from('works')
          .select('id, title, image_url, description')
          .eq('id', workId)
          .maybeSingle();

        if (!workError && workData) {
          setWork(workData as WorkSummary);
        }
      }

      setLoading(false);
    };

    init();
  }, [creatorId, workId, router]);

  const handleSubmit = async () => {
    if (!creatorId || !currentUserId) {
      setErrorMsg('クリエイターまたはログイン情報を取得できませんでした。');
      return;
    }

    if (!title.trim() || !message.trim()) {
      setErrorMsg('「依頼タイトル」と「依頼内容」は必須です。');
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);

    try {
      // 1) requests にレコード作成
      const { data: reqData, error: reqError } = await supabase
        .from('requests')
        .insert({
          creator_id: creatorId,
          client_id: currentUserId,
          work_id: workId || null,
          title,
          // 初回メッセージのスナップショットとして message を持たせておく
          message,
          status: 'pending',
        })
        .select('id')
        .maybeSingle();

      if (reqError || !reqData) {
        console.error('依頼作成エラー:', reqError?.message);
        setErrorMsg('依頼の作成に失敗しました。時間をおいて再度お試しください。');
        setSubmitting(false);
        return;
      }

      const requestId = reqData.id as string;

      // 2) messages に初回メッセージを登録
      const initialBodyLines = [
        message.trim(),
        preferredTime ? `\n\n【希望時期】\n${preferredTime}` : '',
        budget ? `\n\n【予算目安】\n${budget}` : '',
      ];
      const initialBody = initialBodyLines.join('');

      const { error: msgError } = await supabase.from('messages').insert({
        request_id: requestId,
        sender_id: currentUserId,
        body: initialBody || message,
      });

      if (msgError) {
        console.error('メッセージ作成エラー:', msgError.message);
        // 依頼自体は出来ているので、そのまま詳細に飛ばす
      }

      // 3) 依頼詳細画面へ遷移
      router.push(`/requests/${requestId}`);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-56px)] flex items-center justify-center bg-slate-950">
        <p className="text-xs text-slate-400">依頼フォームを読み込み中です…</p>
      </div>
    );
  }

  if (!creator) {
    return (
      <div className="min-h-[calc(100vh-56px)] flex items-center justify-center bg-slate-950 px-4">
        <div className="max-w-md rounded-2xl border border-slate-700 bg-slate-900/80 px-6 py-6 text-center text-sm text-slate-200">
          <p className="font-semibold mb-2">クリエイターが見つかりません</p>
          <p className="text-xs text-slate-400 mb-4">
            URL が間違っているか、すでにアカウントが削除された可能性があります。
          </p>
          <button
            type="button"
            onClick={() => router.push('/works')}
            className="rounded-full border border-slate-600 bg-slate-900/80 px-4 py-2 text-xs font-medium text-slate-100 hover:bg-slate-800 transition"
          >
            作品一覧に戻る
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-56px)] bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-slate-50">
      <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
        {/* ヘッダー */}
        <div className="flex items-center justify-between gap-3 text-xs text-slate-400">
          <button
            type="button"
            onClick={() => router.back()}
            className="inline-flex items-center gap-1 rounded-full border border-slate-700 bg-slate-900/80 px-3 py-1 hover:bg-slate-800 transition"
          >
            <span className="text-[13px]">←</span>
            <span>戻る</span>
          </button>
          <span className="text-[11px]">依頼フォーム</span>
        </div>

        {/* エラー表示 */}
        {errorMsg && (
          <div className="rounded-xl border border-red-500/40 bg-red-950/60 px-4 py-2 text-xs text-red-200">
            {errorMsg}
          </div>
        )}

        <section className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] items-start">
          {/* 左：依頼フォーム */}
          <div className="rounded-3xl border border-white/15 bg-slate-900/80 px-6 py-6 shadow-[0_18px_45px_rgba(15,23,42,0.7)]">
            <div className="mb-4">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-slate-200">
                <span className="h-1.5 w-1.5 rounded-full bg-pink-400" />
                <span>{creator.display_name || 'クリエイター'} への依頼</span>
              </div>
              <h1 className="mt-3 text-lg sm:text-xl font-semibold tracking-tight">
                依頼内容を入力してください
              </h1>
              <p className="mt-1 text-[11px] text-slate-400">
                具体的に「やってほしいこと」「イメージ」「日程感」などを書いておくと、お互いスムーズです。
              </p>
            </div>

            <div className="space-y-3 text-xs">
              {/* 依頼タイトル */}
              <div>
                <label className="mb-1.5 block font-medium text-slate-200">
                  依頼タイトル <span className="text-pink-400">*</span>
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="例：カットモデルのお願い / アイコン用イラスト作成 など"
                  className="w-full rounded-xl border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-slate-50 outline-none ring-0 transition focus:border-pink-400 focus:ring-2 focus:ring-pink-500/50"
                />
              </div>

              {/* 依頼内容 */}
              <div>
                <label className="mb-1.5 block font-medium text-slate-200">
                  依頼内容 <span className="text-pink-400">*</span>
                </label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={5}
                  placeholder={`例：\n・どんなことをお願いしたいか\n・いつ頃を希望しているか\n・参考になりそうな情報（髪型イメージ / 使用用途 など）`}
                  className="w-full rounded-xl border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-slate-50 outline-none ring-0 transition focus:border-pink-400 focus:ring-2 focus:ring-pink-500/50 resize-none"
                />
              </div>

              {/* 希望時期 */}
              <div>
                <label className="mb-1.5 block font-medium text-slate-200">
                  希望時期（任意）
                </label>
                <input
                  type="text"
                  value={preferredTime}
                  onChange={(e) => setPreferredTime(e.target.value)}
                  placeholder="例：来週末 / 3月中旬まで など"
                  className="w-full rounded-xl border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-slate-50 outline-none ring-0 transition focus:border-pink-400 focus:ring-2 focus:ring-pink-500/50"
                />
              </div>

              {/* 予算 */}
              <div>
                <label className="mb-1.5 block font-medium text-slate-200">
                  予算目安（任意）
                </label>
                <input
                  type="text"
                  value={budget}
                  onChange={(e) => setBudget(e.target.value)}
                  placeholder="例：〜5,000円 / 10,000〜15,000円 など"
                  className="w-full rounded-xl border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-slate-50 outline-none ring-0 transition focus:border-pink-400 focus:ring-2 focus:ring-pink-500/50"
                />
              </div>

              {/* 送信ボタン */}
              <div className="pt-3">
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="w-full rounded-full bg-gradient-to-r from-pink-500 to-sky-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-pink-500/30 transition hover:brightness-110 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {submitting ? '送信中…' : '依頼を送信する'}
                </button>
                <p className="mt-2 text-[10px] text-slate-500 text-center">
                  送信後は、この依頼専用のメッセージ画面に移動します。
                </p>
              </div>
            </div>
          </div>

          {/* 右：クリエイター・作品情報 */}
          <aside className="space-y-4">
            {/* クリエイターカード */}
            <div className="rounded-3xl border border-white/15 bg-slate-900/80 px-5 py-4">
              <div className="text-[11px] text-slate-400 mb-2">依頼先クリエイター</div>
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-800 text-[12px] font-medium">
                  {creator.display_name?.slice(0, 2) || 'CT'}
                </div>
                <div className="text-xs">
                  <div className="text-slate-200 font-medium">
                    {creator.display_name || 'クリエイター'}
                  </div>
                  <div className="text-[11px] text-slate-400">
                    {creator.genre || 'ジャンル未設定'} / {creator.area || 'エリア未設定'}
                  </div>
                  <button
                    type="button"
                    onClick={() => router.push(`/profile/${creator.id}`)}
                    className="mt-1 text-[11px] text-sky-300 hover:text-sky-200 underline-offset-2 hover:underline"
                  >
                    プロフィールを見る
                  </button>
                </div>
              </div>
              {creator.bio && (
                <p className="mt-3 text-[11px] text-slate-300 whitespace-pre-wrap">
                  {creator.bio}
                </p>
              )}
            </div>

            {/* 対象作品カード（あれば） */}
            {work && (
              <div className="rounded-3xl border border-white/15 bg-slate-900/80 overflow-hidden">
                <div className="h-32 w-full bg-slate-800">
                  {work.image_url ? (
                    <img
                      src={work.image_url}
                      alt={work.title}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-[11px] text-slate-500">
                      画像なし
                    </div>
                  )}
                </div>
                <div className="px-5 py-3 text-xs">
                  <div className="text-[11px] text-slate-400 mb-1">対象作品</div>
                  <div className="text-slate-200 font-medium line-clamp-2">{work.title}</div>
                  {work.description && (
                    <p className="mt-1 text-[11px] text-slate-400 line-clamp-3">
                      {work.description}
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={() => router.push(`/works/${work.id}`)}
                    className="mt-2 text-[11px] text-sky-300 hover:text-sky-200 underline-offset-2 hover:underline"
                  >
                    作品詳細を見る
                  </button>
                </div>
              </div>
            )}
          </aside>
        </section>
      </main>
    </div>
  );
}