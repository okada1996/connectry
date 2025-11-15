// app/works/new/page.tsx
'use client';

import { useEffect, useState, ChangeEvent, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

type Role = 'creator' | 'client' | null;

export default function NewWorkPage() {
  const router = useRouter();

  const [role, setRole] = useState<Role>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState('');
  const [file, setFile] = useState<File | null>(null);

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // 認証 & ロールチェック
  useEffect(() => {
    const checkAuth = async () => {
      setCheckingAuth(true);

      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();

      if (error || !user) {
        // 未ログイン → ログイン画面へ
        router.push('/auth/login?next=/works/new');
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle();

      if (profileError) {
        console.error('プロフィール取得エラー:', profileError.message);
        setErrorMsg('プロフィール情報の取得に失敗しました。時間をおいて再度お試しください。');
      } else {
        setRole((profile?.role as Role) ?? null);
      }

      setCheckingAuth(false);
    };

    checkAuth();
  }, [router]);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] || null;
    setFile(f);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!title.trim()) {
      setErrorMsg('作品タイトルを入力してください。');
      return;
    }
    if (!file) {
      setErrorMsg('作品画像を 1 枚選択してください。');
      return;
    }

    setLoading(true);

    try {
      // 認証ユーザー再確認
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        setErrorMsg('ログイン情報を確認できませんでした。もう一度ログインし直してください。');
        setLoading(false);
        return;
      }

      // ① 画像アップロード
      const fileExt = file.name.split('.').pop();
      const filePath = `images/${user.id}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('works')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) {
        console.error('アップロードエラー:', uploadError.message);
        setErrorMsg('画像のアップロードに失敗しました。別の画像でお試しください。');
        setLoading(false);
        return;
      }

      // ② 公開URL取得
      const {
        data: { publicUrl },
      } = supabase.storage.from('works').getPublicUrl(filePath);

      // ③ works テーブルに insert
      const { data: inserted, error: insertError } = await supabase
        .from('works')
        .insert({
          creator_id: user.id,
          title: title.trim(),
          description: description.trim() || null,
          image_url: publicUrl,
          tags: tags.trim() || null,
        })
        .select('id')
        .single();

      if (insertError) {
        console.error('作品登録エラー:', insertError.message);
        setErrorMsg('作品の登録に失敗しました。時間をおいて再度お試しください。');
        setLoading(false);
        return;
      }

      // ④ 作品詳細 / または一覧へ遷移
      router.push(`/works/${inserted.id}`);
    } catch (err) {
      console.error(err);
      setErrorMsg('予期せぬエラーが発生しました。時間をおいて再度お試しください。');
      setLoading(false);
    }
  };

  // 認証チェック中ローディング
  if (checkingAuth) {
    return (
      <div className="min-h-[calc(100vh-56px)] flex items-center justify-center bg-slate-950 text-slate-200">
        チェック中…
      </div>
    );
  }

  // creator 以外は利用不可
  if (role !== 'creator') {
    return (
      <div className="min-h-[calc(100vh-56px)] flex items-center justify-center bg-slate-950 px-4">
        <div className="max-w-md rounded-2xl border border-slate-700 bg-slate-900/80 px-6 py-6 text-center text-sm text-slate-200">
          <p className="font-semibold mb-2">作品投稿はクリエイター専用機能です。</p>
          <p className="text-slate-400 text-xs">
            プロフィール編集画面で「利用区分」をクリエイターに変更することで、
            作品投稿機能をご利用いただけます。（※ 現在はクライアントとして登録されています）
          </p>
        </div>
      </div>
    );
  }

  // フォーム本体
  return (
    <div className="min-h-[calc(100vh-56px)] bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-slate-50">
      <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-8 sm:px-6 lg:px-8">
        {/* 見出し */}
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            作品を投稿する
          </h1>
          <p className="max-w-xl text-sm text-slate-400">
            カットモデル写真、作品撮り、イラスト、デザインなど。
            あなたの「らしさ」が伝わる作品を投稿して、依頼者に見つけてもらいましょう。
          </p>
        </div>

        <div className="rounded-3xl border border-white/10 bg-slate-900/70 px-6 py-6 shadow-[0_18px_45px_rgba(15,23,42,0.7)]">
          {errorMsg && (
            <div className="mb-4 rounded-xl border border-red-500/40 bg-red-950/50 px-3 py-2 text-xs text-red-200">
              {errorMsg}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4 text-xs sm:text-sm">
            {/* 画像 */}
            <div>
              <label className="mb-1.5 block font-medium text-slate-100">
                作品画像 <span className="text-pink-400 text-[10px] align-middle">必須</span>
              </label>
              <p className="mb-2 text-[11px] text-slate-400">
                JPG / PNG / WEBP、1枚。10MB 以下推奨。
              </p>
              <input
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="w-full text-xs text-slate-200 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-800 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-slate-100 hover:file:bg-slate-700"
              />
            </div>

            {/* タイトル */}
            <div>
              <label className="mb-1.5 block font-medium text-slate-100">
                タイトル <span className="text-pink-400 text-[10px] align-middle">必須</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="例：ミディアムレイヤー × オレンジブラウン / カットモデル"
                className="w-full rounded-xl border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-slate-50 outline-none ring-0 transition focus:border-pink-400 focus:ring-2 focus:ring-pink-500/50"
              />
            </div>

            {/* 説明 */}
            <div>
              <label className="mb-1.5 block font-medium text-slate-100">説明文</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                placeholder="例：顔まわりにレイヤーを入れて軽さを出しつつ、オレンジブラウンで柔らかい印象に仕上げました。撮影用のスタイリングも含めて担当しています。"
                className="w-full rounded-xl border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-slate-50 outline-none ring-0 transition focus:border-pink-400 focus:ring-2 focus:ring-pink-500/50"
              />
            </div>

            {/* タグ */}
            <div>
              <label className="mb-1.5 block font-medium text-slate-100">タグ（カンマ区切り）</label>
              <input
                type="text"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="例：ヘア,ミディアム,オレンジブラウン,作品撮り"
                className="w-full rounded-xl border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-slate-50 outline-none ring-0 transition focus:border-pink-400 focus:ring-2 focus:ring-pink-500/50"
              />
            </div>

            {/* ボタン */}
            <div className="pt-2 flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => router.push('/works')}
                className="rounded-full border border-slate-600 bg-slate-900/60 px-4 py-2 text-xs font-medium text-slate-100 hover:bg-slate-800/80 transition"
              >
                キャンセル
              </button>
              <button
                type="submit"
                disabled={loading}
                className="rounded-full bg-gradient-to-r from-pink-500 to-sky-500 px-5 py-2 text-xs font-semibold text-white shadow-lg shadow-pink-500/30 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? '投稿中…' : '作品を投稿する'}
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}