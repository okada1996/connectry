// app/requests/new/RequestNewPageClient.tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

type CreatorProfile = {
  id: string;
  display_name: string | null;
};

type WorkMini = {
  id: string;
  title: string | null;
};

export default function RequestNewPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const creatorId = searchParams.get('creatorId');
  const workId = searchParams.get('workId');

  const [creator, setCreator] = useState<CreatorProfile | null>(null);
  const [work, setWork] = useState<WorkMini | null>(null);

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [when, setWhen] = useState('');
  const [budget, setBudget] = useState('');

  const [loading, setLoading] = useState(true);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // 初期ロード：対象クリエイター / 作品の情報取得
  useEffect(() => {
    const init = async () => {
      if (!creatorId) {
        setErrorMsg('対象クリエイターが指定されていません。作品詳細からアクセスしてください。');
        setLoading(false);
        return;
      }

      // ログイン確認（未ログインならログイン画面へ）
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push(
          `/auth/login?next=/requests/new?creatorId=${creatorId}${
            workId ? `&workId=${workId}` : ''
          }`
        );
        return;
      }

      // クリエイター情報
      const { data: creatorData, error: creatorError } = await supabase
        .from('profiles')
        .select('id, display_name')
        .eq('id', creatorId)
        .single();

      if (creatorError) {
        console.error('依頼フォーム: クリエイター取得エラー', creatorError.message);
        setErrorMsg('クリエイター情報の取得に失敗しました。');
        setLoading(false);
        return;
      }

      setCreator(creatorData as CreatorProfile);

      // 対象作品（任意）
      if (workId) {
        const { data: workData, error: workError } = await supabase
          .from('works')
          .select('id, title')
          .eq('id', workId)
          .single();

        if (!workError && workData) {
          setWork(workData as WorkMini);
        }
      }

      setLoading(false);
    };

    void init();
  }, [creatorId, workId, router]);

  const handleSubmit = async () => {
    setErrorMsg(null);

    if (!creatorId) {
      setErrorMsg('対象クリエイターが不明です。');
      return;
    }

    if (!title.trim() || !body.trim()) {
      setErrorMsg('「依頼タイトル」と「依頼内容」は必須です。');
      return;
    }

    setSubmitLoading(true);

    // ログインユーザー再確認
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push(
        `/auth/login?next=/requests/new?creatorId=${creatorId}${
          workId ? `&workId=${workId}` : ''
        }`
      );
      setSubmitLoading(false);
      return;
    }

    // 本文に希望時期・予算を追記（シンプルにテキスト連結）
    const fullMessage =
      body +
      (when ? `\n\n【希望時期】\n${when}` : '') +
      (budget ? `\n\n【予算目安】\n${budget}` : '');

    // 既に作ってある RPC: create_request_with_message を呼ぶ想定
    const { data, error } = await supabase.rpc('create_request_with_message', {
      p_creator_id: creatorId,
      p_client_id: user.id,
      p_work_id: workId,
      p_title: title,
      p_message: fullMessage,
    });

    if (error) {
      console.error('依頼作成エラー:', error.message);
      setErrorMsg('依頼の作成に失敗しました。時間をおいて再度お試しください。');
      setSubmitLoading(false);
      return;
    }

    const requestId =
      Array.isArray(data) && data.length > 0
        ? (data[0] as any).request_id
        : (data as any)?.request_id;

    if (!requestId) {
      setErrorMsg('依頼の作成に失敗しました。');
      setSubmitLoading(false);
      return;
    }

    router.push(`/requests/${requestId}`);
  };

  const handleCancel = () => {
    if (workId) {
      router.push(`/works/${workId}`);
    } else if (creatorId) {
      router.push(`/profile/${creatorId}`);
    } else {
      router.push('/works');
    }
  };

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-56px)] flex items-center justify-center">
        <p className="text-xs text-slate-400">依頼フォームを読み込み中です…</p>
      </div>
    );
  }

  if (!creator) {
    return (
      <div className="min-h-[calc(100vh-56px)] flex items-center justify-center">
        <div className="rounded-2xl border border-red-500/40 bg-red-950/40 px-4 py-3 text-xs text-red-100">
          {errorMsg || 'クリエイター情報が見つかりませんでした。'}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-56px)]">
      <main className="mx-auto w-full max-w-3xl space-y-5">
        {/* 上部ヘッダー */}
        <header className="flex items-center justify-between gap-3">
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={handleCancel}
              className="inline-flex items-center gap-1 self-start rounded-full border border-slate-700 bg-slate-900/70 px-3 py-1 text-[11px] text-slate-200 hover:bg-slate-800/80 transition"
            >
              <span className="text-xs">←</span>
              <span>前の画面に戻る</span>
            </button>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-slate-200">
              <span className="h-1.5 w-1.5 rounded-full bg-sky-400" />
              <span>依頼フォーム</span>
            </div>
            <h1 className="text-lg sm:text-xl font-semibold tracking-tight">
              {creator.display_name || 'クリエイター'} さんへの依頼を作成
            </h1>
          </div>
        </header>

        {/* エラー */}
        {errorMsg && (
          <div className="rounded-2xl border border-red-500/40 bg-red-950/40 px-4 py-3 text-xs text-red-100">
            {errorMsg}
          </div>
        )}

        {/* 対象情報 */}
        <section className="rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-xs text-slate-200 space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-slate-400">依頼先</span>
            <span className="rounded-full bg-slate-800/80 px-3 py-1 text-[11px] font-semibold">
              {creator.display_name || 'クリエイター'}
            </span>
          </div>
          {work && (
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-slate-400">対象作品</span>
              <button
                type="button"
                onClick={() => router.push(`/works/${work.id}`)}
                className="rounded-full border border-slate-600 bg-slate-900/70 px-3 py-1 text-[11px] text-sky-200 hover:bg-slate-800/80 transition"
              >
                {work.title || '作品詳細を見る'}
              </button>
            </div>
          )}
        </section>

        {/* フォーム本体 */}
        <section className="rounded-3xl border border-white/10 bg-slate-950/80 px-4 py-5 shadow-[0_18px_45px_rgba(15,23,42,0.8)]">
          <div className="space-y-4 text-xs">
            <div>
              <label className="mb-1.5 block font-medium text-slate-100">
                依頼タイトル<span className="text-pink-400 ml-1">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="例：カットモデルの撮影をお願いしたいです"
                className="w-full rounded-xl border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-50 outline-none ring-0 transition focus:border-pink-400 focus:ring-2 focus:ring-pink-500/40"
              />
            </div>

            <div>
              <label className="mb-1.5 block font-medium text-slate-100">
                依頼内容<span className="text-pink-400 ml-1">*</span>
              </label>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={5}
                placeholder="やってほしいこと・用途・イメージ・参考URL などを書いてください。"
                className="w-full rounded-xl border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-50 outline-none ring-0 transition focus:border-pink-400 focus:ring-2 focus:ring-pink-500/40"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block font-medium text-slate-100">
                  希望時期（任意）
                </label>
                <input
                  type="text"
                  value={when}
                  onChange={(e) => setWhen(e.target.value)}
                  placeholder="例：来月中旬までに／〇月〇日まで"
                  className="w-full rounded-xl border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-50 outline-none ring-0 transition focus:border-pink-400 focus:ring-2 focus:ring-pink-500/40"
                />
              </div>
              <div>
                <label className="mb-1.5 block font-medium text-slate-100">
                  予算目安（任意）
                </label>
                <input
                  type="text"
                  value={budget}
                  onChange={(e) => setBudget(e.target.value)}
                  placeholder="例：1万円〜2万円程度 など"
                  className="w-full rounded-xl border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-50 outline-none ring-0 transition focus:border-pink-400 focus:ring-2 focus:ring-pink-500/40"
                />
              </div>
            </div>

            {/* ボタン */}
            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={handleCancel}
                className="sm:w-auto w-full rounded-full border border-slate-600 bg-slate-900/70 px-4 py-2 text-xs font-semibold text-slate-100 hover:bg-slate-800/80 transition"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitLoading}
                className="sm:w-auto w-full rounded-full bg-gradient-to-r from-pink-500 to-sky-500 px-5 py-2 text-xs font-semibold text-white shadow-md shadow-pink-500/40 hover:brightness-110 transition disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {submitLoading ? '送信中…' : 'この内容で依頼を送信する'}
              </button>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}