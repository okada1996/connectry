// app/requests/new/RequestNewPageClient.tsx
'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

type ProfileRow = {
  id: string;
  role: 'creator' | 'client' | null;
  display_name: string | null;
};

type CreatorProfile = {
  id: string;
  display_name: string | null;
};

type WorkRow = {
  id: string;
  title: string;
};

type Status = 'pending' | 'accepted' | 'rejected' | 'closed';

export default function RequestNewPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const creatorIdFromQuery = searchParams.get('creatorId');
  const workIdFromQuery = searchParams.get('workId');

  const [currentProfile, setCurrentProfile] = useState<ProfileRow | null>(null);
  const [creatorProfile, setCreatorProfile] = useState<CreatorProfile | null>(null);
  const [work, setWork] = useState<WorkRow | null>(null);

  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [preferredDate, setPreferredDate] = useState('');
  const [budget, setBudget] = useState('');

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // 初期ロード：ログインユーザー・クリエイター情報・作品情報
  useEffect(() => {
    const init = async () => {
      setLoading(true);
      setErrorMsg(null);

      // 1. ログインユーザー確認
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        // 未ログインならログイン画面に飛ばす
        router.push(
          `/auth/login?next=/requests/new?creatorId=${creatorIdFromQuery || ''}&workId=${
            workIdFromQuery || ''
          }`,
        );
        return;
      }

      // 2. 自分のプロフィール（ロール）取得
      const { data: myProfile, error: myProfileError } = await supabase
        .from('profiles')
        .select('id, role, display_name')
        .eq('id', user.id)
        .single();

      if (myProfileError || !myProfile) {
        console.error('依頼作成: 自分のプロフィール取得エラー', myProfileError?.message);
        setErrorMsg('プロフィール情報の取得に失敗しました。時間をおいて再度お試しください。');
        setLoading(false);
        return;
      }

      // 依頼者ロールでなければ NG（MVPでは client 限定）
      if (myProfile.role !== 'client') {
        setErrorMsg('依頼者としてのアカウントでのみ依頼を作成できます。');
        setCurrentProfile(myProfile as ProfileRow);
        setLoading(false);
        return;
      }

      setCurrentProfile(myProfile as ProfileRow);

      // 3. クリエイター情報
      if (!creatorIdFromQuery) {
        setErrorMsg('クリエイター情報が見つかりません。作品詳細画面から遷移してください。');
        setLoading(false);
        return;
      }

      const { data: cr, error: crError } = await supabase
        .from('profiles')
        .select('id, display_name')
        .eq('id', creatorIdFromQuery)
        .single();

      if (crError || !cr) {
        console.error('依頼作成: クリエイタープロフィール取得エラー', crError?.message);
        setErrorMsg('クリエイター情報の取得に失敗しました。時間をおいて再度お試しください。');
        setLoading(false);
        return;
      }

      setCreatorProfile(cr as CreatorProfile);

      // 4. 対象作品（あれば）
      if (workIdFromQuery) {
        const { data: w, error: wError } = await supabase
          .from('works')
          .select('id, title')
          .eq('id', workIdFromQuery)
          .single();

        if (wError) {
          console.error('依頼作成: 作品取得エラー', wError.message);
        } else if (w) {
          setWork(w as WorkRow);
          // 作品タイトルをデフォルトタイトルに使う
          if (!title) {
            setTitle(`「${w.title}」についてのご相談`);
          }
        }
      }

      setLoading(false);
    };

    void init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [creatorIdFromQuery, workIdFromQuery]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentProfile) return;
    if (!creatorIdFromQuery) {
      setErrorMsg('クリエイター情報が不足しています。');
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);

    try {
      if (!title.trim() || !message.trim()) {
        setErrorMsg('「依頼タイトル」と「依頼内容」は必須です。');
        setSubmitting(false);
        return;
      }

      const status: Status = 'pending';

      // 1. requests に登録
      const { data: inserted, error: reqError } = await supabase
        .from('requests')
        .insert({
          creator_id: creatorIdFromQuery,
          client_id: currentProfile.id,
          work_id: workIdFromQuery || null,
          title: title.trim(),
          message: message.trim(),
          status,
          preferred_date: preferredDate || null,
          budget: budget || null,
        })
        .select('id') // 作成された行の id を返してもらう
        .single();

      if (reqError || !inserted) {
        console.error('依頼作成エラー (requests):', reqError?.message);
        setErrorMsg('依頼の作成に失敗しました。時間をおいて再度お試しください。');
        setSubmitting(false);
        return;
      }

      const requestId = inserted.id as string;

      // 2. 初回メッセージを messages に登録
      const { error: msgError } = await supabase.from('messages').insert({
        request_id: requestId,
        sender_id: currentProfile.id,
        body: message.trim(),
        // 既読系カラムを入れているならここで false を入れる（なければ省略）
        // is_read_by_creator: false,
        // is_read_by_client: true, // 送信者が client の場合、自分側は既読として扱いたいなら
      });

      if (msgError) {
        console.error('依頼作成エラー (messages):', msgError.message);
        // ここでロールバックまではしないが、ユーザーにはメッセージ登録失敗を通知
        setErrorMsg(
          '依頼は作成されましたが、メッセージの登録に失敗しました。再度メッセージを送信してください。',
        );
        setSubmitting(false);
        // 依頼詳細画面には飛ばしてしまう
        router.push(`/requests/${requestId}`);
        return;
      }

      // 完了 → 依頼詳細へ遷移
      router.push(`/requests/${requestId}`);
    } catch (e) {
      console.error('依頼作成中の予期せぬエラー:', e);
      setErrorMsg('依頼の作成に失敗しました。時間をおいて再度お試しください。');
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-56px)] flex items-center justify-center">
        <p className="text-xs text-slate-400">依頼フォームを読み込み中です…</p>
      </div>
    );
  }

  if (errorMsg && !currentProfile) {
    // そもそも利用不可レベルのエラー
    return (
      <div className="min-h-[calc(100vh-56px)] flex items-center justify-center">
        <div className="rounded-2xl border border-red-500/40 bg-red-950/40 px-4 py-3 text-xs text-red-100 max-w-sm text-center">
          {errorMsg}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-56px)]">
      <main className="mx-auto w-full max-w-xl space-y-5">
        {/* ヘッダー */}
        <header className="space-y-2">
          <button
            type="button"
            onClick={() => router.back()}
            className="inline-flex items-center gap-1 rounded-full border border-slate-700 bg-slate-900/70 px-3 py-1 text-[11px] text-slate-200 hover:bg-slate-800/80 transition"
          >
            <span className="text-xs">←</span>
            <span>前の画面に戻る</span>
          </button>

          <h1 className="text-xl font-semibold tracking-tight mt-1">
            {creatorProfile
              ? `${creatorProfile.display_name || 'クリエイター'}への依頼`
              : 'クリエイターへの依頼'}
          </h1>

          <p className="text-[11px] text-slate-400">
            具体的な内容はここで自由に書いてもらえれば OK です。あとからメッセージで細かく相談できます。
          </p>

          {work && (
            <div className="mt-2 rounded-2xl border border-white/10 bg-slate-900/70 px-3 py-2 text-[11px] text-slate-200">
              <div className="text-[10px] text-slate-400 mb-1">対象作品</div>
              <div className="font-medium">{work.title}</div>
            </div>
          )}
        </header>

        {/* エラー表示 */}
        {errorMsg && (
          <div className="rounded-2xl border border-red-500/40 bg-red-950/40 px-4 py-3 text-[11px] text-red-100">
            {errorMsg}
          </div>
        )}

        {/* フォーム */}
        <section className="rounded-3xl border border-white/10 bg-slate-950/80 px-4 py-4 shadow-[0_18px_45px_rgba(15,23,42,0.8)]">
          <form onSubmit={handleSubmit} className="space-y-3 text-xs">
            <div>
              <label className="mb-1.5 block font-medium text-slate-200">
                依頼タイトル <span className="text-pink-400">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="例：カットモデルの撮影依頼 / アイコン用イラストの制作相談"
                className="w-full rounded-xl border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-slate-50 outline-none ring-0 transition focus:border-pink-400 focus:ring-2 focus:ring-pink-500/50"
              />
            </div>

            <div>
              <label className="mb-1.5 block font-medium text-slate-200">
                依頼内容 <span className="text-pink-400">*</span>
              </label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={5}
                placeholder="どんなことをお願いしたいか、方向性レベルでも大丈夫です。"
                className="w-full rounded-xl border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-slate-50 outline-none ring-0 transition focus:border-pink-400 focus:ring-2 focus:ring-pink-500/50"
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block font-medium text-slate-200">
                  希望時期（任意）
                </label>
                <input
                  type="text"
                  value={preferredDate}
                  onChange={(e) => setPreferredDate(e.target.value)}
                  placeholder="例：◯月中 / 来月の土日 / いつでも相談可"
                  className="w-full rounded-xl border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-slate-50 outline-none ring-0 transition focus:border-pink-400 focus:ring-2 focus:ring-pink-500/50"
                />
              </div>

              <div>
                <label className="mb-1.5 block font-medium text-slate-200">
                  予算の目安（任意）
                </label>
                <input
                  type="text"
                  value={budget}
                  onChange={(e) => setBudget(e.target.value)}
                  placeholder="例：◯◯円くらいを想定 / 相談したい"
                  className="w-full rounded-xl border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-slate-50 outline-none ring-0 transition focus:border-pink-400 focus:ring-2 focus:ring-pink-500/50"
                />
              </div>
            </div>

            <div className="pt-3 flex flex-col gap-2">
              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-full bg-gradient-to-r from-pink-500 to-sky-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-pink-500/30 transition hover:brightness-110 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {submitting ? '送信中…' : '依頼を送信する'}
              </button>
            </div>
          </form>
        </section>
      </main>
    </div>
  );
}