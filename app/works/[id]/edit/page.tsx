// app/works/[id]/edit/page.tsx
'use client';

import { useEffect, useState, ChangeEvent, FormEvent } from 'react';
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
};

export default function WorkEditPage() {
  const router = useRouter();
  const params = useParams();
  const workId = params?.id as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);

  const [work, setWork] = useState<WorkRow | null>(null);

  // フォーム用 state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // 初期ロード：作品取得＋オーナー判定
  useEffect(() => {
    const init = async () => {
      if (!workId) return;

      setLoading(true);
      setErrorMsg(null);
      setForbidden(false);

      // 1. 認証ユーザ取得
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setForbidden(true);
        setLoading(false);
        return;
      }

      // 2. 作品取得
      const { data, error } = await supabase
        .from('works')
        .select('*')
        .eq('id', workId)
        .single();

      if (error || !data) {
        console.error('WorkEdit: 作品取得エラー', error?.message);
        setErrorMsg('作品情報を取得できませんでした。削除された可能性があります。');
        setLoading(false);
        return;
      }

      const w = data as WorkRow;

      // 3. オーナー判定
      if (w.creator_id !== user.id) {
        setForbidden(true);
        setLoading(false);
        return;
      }

      // 4. フォームに反映
      setWork(w);
      setTitle(w.title);
      setDescription(w.description || '');
      setIsPublic(w.is_public ?? true);
      setPreviewUrl(w.image_url || null);

      setLoading(false);
    };

    void init();
  }, [workId]);

  // 画像選択時の preview
  const handleImageChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      setImageFile(null);
      return;
    }

    setImageFile(file);

    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!work) return;

    setSaving(true);
    setErrorMsg(null);
    setInfoMsg(null);

    try {
      let imageUrl = work.image_url;

      // 1. 画像を新しく選択している場合はアップロード
      if (imageFile) {
        const fileExt = imageFile.name.split('.').pop();
        const fileName = `${work.id}-${Date.now()}.${fileExt}`;
        const filePath = `${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('works')
          .upload(filePath, imageFile, {
            cacheControl: '3600',
            upsert: true,
          });

        if (uploadError) {
          console.error('WorkEdit: 画像アップロードエラー', uploadError.message);
          setErrorMsg('画像のアップロードに失敗しました。別の画像でお試しください。');
          setSaving(false);
          return;
        }

        const { data: publicUrlData } = supabase.storage
          .from('works')
          .getPublicUrl(filePath);

        imageUrl = publicUrlData?.publicUrl ?? imageUrl;
      }

      // 2. works テーブルを更新
      const { error: updateError } = await supabase
        .from('works')
        .update({
          title: title.trim(),
          description: description.trim(),
          image_url: imageUrl,
          is_public: isPublic,
        })
        .eq('id', work.id);

      if (updateError) {
        console.error('WorkEdit: 更新エラー', updateError.message);
        setErrorMsg('作品の更新に失敗しました。時間をおいて再度お試しください。');
        setSaving(false);
        return;
      }

      setInfoMsg('作品を更新しました。');
      // 少し待ってから詳細画面へ戻す
      setTimeout(() => {
        router.push(`/works/${work.id}`);
      }, 600);
    } catch (err) {
      console.error('WorkEdit: 予期せぬエラー', err);
      setErrorMsg('作品の更新中にエラーが発生しました。');
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-56px)] flex items-center justify-center">
        <div className="text-xs text-slate-400">作品情報を読み込み中です…</div>
      </div>
    );
  }

  if (forbidden) {
    return (
      <div className="min-h-[calc(100vh-56px)] flex items-center justify-center">
        <div className="rounded-2xl border border-yellow-500/40 bg-yellow-950/40 px-4 py-3 text-xs text-yellow-100">
          この作品を編集する権限がありません。
        </div>
      </div>
    );
  }

  if (!work) {
    return (
      <div className="min-h-[calc(100vh-56px)] flex items-center justify-center">
        <div className="rounded-2xl border border-red-500/40 bg-red-950/40 px-4 py-3 text-xs text-red-100">
          作品が見つかりませんでした。
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-56px)]">
      <main className="mx-auto w-full max-w-4xl space-y-6">
        {/* ヘッダー */}
        <header className="flex items-center justify-between gap-3">
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={() => router.push(`/works/${work.id}`)}
              className="inline-flex items-center gap-1 self-start rounded-full border border-slate-700 bg-slate-900/70 px-3 py-1 text-[11px] text-slate-200 hover:bg-slate-800/80 transition"
            >
              <span className="text-xs">←</span>
              <span>作品詳細に戻る</span>
            </button>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-slate-200">
              <span className="h-1.5 w-1.5 rounded-full bg-pink-400" />
              <span>作品を編集</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">
              {work.title}
            </h1>
          </div>
        </header>

        {/* メッセージ */}
        {errorMsg && (
          <div className="rounded-2xl border border-red-500/40 bg-red-950/40 px-4 py-3 text-xs text-red-100">
            {errorMsg}
          </div>
        )}
        {infoMsg && (
          <div className="rounded-2xl border border-emerald-500/40 bg-emerald-950/40 px-4 py-3 text-xs text-emerald-100">
            {infoMsg}
          </div>
        )}

        {/* フォーム */}
        <section className="rounded-3xl border border-white/10 bg-slate-950/80 px-4 py-5 sm:px-6 sm:py-6 shadow-[0_18px_45px_rgba(15,23,42,0.8)]">
          <form onSubmit={handleSubmit} className="space-y-4 text-xs text-slate-100">
            {/* 画像プレビュー＋アップロード */}
            <div className="space-y-2">
              <label className="block text-[11px] font-medium text-slate-200">
                作品画像
              </label>
              <div className="flex flex-col gap-3 sm:flex-row">
                <div className="relative h-36 w-full overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 sm:w-64">
                  {previewUrl ? (
                    <img
                      src={previewUrl}
                      alt="preview"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-[11px] text-slate-500">
                      画像が設定されていません
                    </div>
                  )}
                </div>
                <div className="flex-1 space-y-2">
                  <p className="text-[11px] text-slate-400">
                    新しい画像を選択すると上書きされます。JPEG / PNG / WEBP、10MB まで。
                  </p>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    className="block w-full text-[11px] text-slate-200 file:mr-2 file:rounded-full file:border-0 file:bg-slate-800 file:px-3 file:py-1.5 file:text-[11px] file:font-medium file:text-slate-100 hover:file:bg-slate-700"
                  />
                </div>
              </div>
            </div>

            {/* タイトル */}
            <div>
              <label className="mb-1.5 block text-[11px] font-medium text-slate-200">
                作品タイトル <span className="text-pink-400">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={100}
                required
                className="w-full rounded-xl border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-slate-50 outline-none transition focus:border-pink-400 focus:ring-2 focus:ring-pink-500/40"
              />
              <p className="mt-1 text-[10px] text-slate-500">
                例）撮影用ロングヘアスタイル / カラー作品 など（100文字まで）
              </p>
            </div>

            {/* 説明 */}
            <div>
              <label className="mb-1.5 block text-[11px] font-medium text-slate-200">
                作品の説明
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={5}
                maxLength={1000}
                className="w-full rounded-xl border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-slate-50 outline-none transition focus:border-pink-400 focus:ring-2 focus:ring-pink-500/40"
                placeholder="撮影意図や使用した技術、こだわったポイントなどがあれば記載してください。"
              />
              <p className="mt-1 text-[10px] text-slate-500">最大 1,000 文字</p>
            </div>

            {/* 公開設定 */}
            <div className="flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-900/70 px-3 py-2.5">
              <div className="flex flex-col text-[11px]">
                <span className="font-medium text-slate-100">公開設定</span>
                <span className="text-[10px] text-slate-500">
                  非公開にすると、作品一覧には表示されず、URLを知っている人だけがアクセスできます。
                </span>
              </div>
              <label className="inline-flex items-center gap-2 text-[11px]">
                <input
                  type="checkbox"
                  checked={isPublic}
                  onChange={(e) => setIsPublic(e.target.checked)}
                  className="h-3.5 w-3.5 rounded border-slate-600 bg-slate-900 text-pink-500 focus:ring-pink-500"
                />
                <span className="text-slate-100">公開する</span>
              </label>
            </div>

            {/* ボタン */}
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => router.push(`/works/${work.id}`)}
                className="rounded-full border border-slate-600 bg-slate-900/70 px-4 py-2 text-[11px] font-medium text-slate-100 hover:bg-slate-800/80 transition"
              >
                キャンセル
              </button>
              <button
                type="submit"
                disabled={saving}
                className="rounded-full bg-gradient-to-r from-pink-500 to-sky-500 px-5 py-2 text-[11px] font-semibold text-white shadow-lg shadow-pink-500/40 hover:brightness-110 transition disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {saving ? '保存中…' : '変更を保存する'}
              </button>
            </div>
          </form>
        </section>
      </main>
    </div>
  );
}