// app/profile/edit/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

type ProfileForm = {
  id: string;
  display_name: string;
  bio: string;
  genre: string;
  area: string;
  instagram_url: string;
  role: 'creator' | 'client' | null; // ← 読み取り専用として保持
};

export default function ProfileEditPage() {
  const router = useRouter();

  const [form, setForm] = useState<ProfileForm | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // 初期ロード：ログインユーザーのプロフィール取得
  useEffect(() => {
    const init = async () => {
      setLoading(true);
      setErrorMsg(null);

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        console.error('ProfileEdit: user取得エラー', userError?.message);
        setErrorMsg('ログイン情報を取得できませんでした。再度ログインしてください。');
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('id, display_name, bio, genre, area, instagram_url, role')
        .eq('id', user.id)
        .single();

      if (error || !data) {
        console.error('ProfileEdit: profiles取得エラー', error?.message);
        setErrorMsg('プロフィール情報の取得に失敗しました。');
        setLoading(false);
        return;
      }

      setForm({
        id: data.id,
        display_name: data.display_name || '',
        bio: data.bio || '',
        genre: data.genre || '',
        area: data.area || '',
        instagram_url: data.instagram_url || '',
        role: (data.role as 'creator' | 'client' | null) ?? null,
      });

      setLoading(false);
    };

    void init();
  }, []);

  const handleChange = (field: keyof Omit<ProfileForm, 'id' | 'role'>, value: string) => {
    if (!form) return;
    setForm({ ...form, [field]: value });
  };

  const handleSave = async () => {
    if (!form) return;
    setSaving(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!form.display_name.trim()) {
      setErrorMsg('表示名は必須です。');
      setSaving(false);
      return;
    }

    const { error } = await supabase
      .from('profiles')
      .update({
        // ★ role は更新しない（display_name / bio / genre / area / instagram_url のみ）
        display_name: form.display_name.trim(),
        bio: form.bio.trim(),
        genre: form.genre.trim(),
        area: form.area.trim(),
        instagram_url: form.instagram_url.trim(),
      })
      .eq('id', form.id);

    if (error) {
      console.error('ProfileEdit: 更新エラー', error.message);
      setErrorMsg('プロフィールの保存に失敗しました。時間をおいて再度お試しください。');
      setSaving(false);
      return;
    }

    setSuccessMsg('プロフィールを保存しました。');
    setSaving(false);

    // プロフィール詳細へ戻る
    router.push(`/profile/${form.id}`);
  };

  const handleCancel = () => {
    if (!form) {
      router.push('/works');
      return;
    }
    router.push(`/profile/${form.id}`);
  };

  const roleLabel = (role: ProfileForm['role']) => {
    switch (role) {
      case 'creator':
        return 'クリエイターとして利用中';
      case 'client':
        return '依頼者として利用中';
      default:
        return 'ロール未設定';
    }
  };

  if (loading || !form) {
    return (
      <div className="min-h-[calc(100vh-56px)] flex items-center justify-center">
        <div className="text-xs text-slate-400">プロフィールを読み込み中です…</div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-56px)]">
      <main className="mx-auto w-full max-w-3xl space-y-5">
        {/* 上部ヘッダー：タイトル＋戻る導線 */}
        <header className="flex items-center justify-between gap-3">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-slate-200">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              <span>プロフィール設定</span>
            </div>
            <h1 className="mt-2 text-xl font-semibold tracking-tight">
              あなたの「らしさ」を伝えるプロフィール
            </h1>
            <p className="mt-1 text-xs text-slate-400">
              依頼者が最初に見るのはプロフィールです。活動内容や得意なスタイルをわかりやすく書いておきましょう。
            </p>
          </div>

          {/* 右上：現在のロール表示＋戻る */}
          <div className="flex flex-col items-end gap-2">
            <span className="rounded-full border border-slate-600 bg-slate-900/60 px-3 py-1 text-[10px] text-slate-300">
              {roleLabel(form.role)}
            </span>
            <button
              type="button"
              onClick={() => handleCancel()}
              className="hidden sm:inline-flex items-center gap-1 rounded-full border border-slate-600 bg-slate-900/70 px-3 py-1.5 text-[11px] font-medium text-slate-100 hover:bg-slate-800/80 transition"
            >
              <span className="text-xs">←</span>
              <span>プロフィールを見る</span>
            </button>
          </div>
        </header>

        {/* エラー / 成功メッセージ */}
        {errorMsg && (
          <div className="rounded-2xl border border-red-500/40 bg-red-950/40 px-4 py-3 text-xs text-red-100">
            {errorMsg}
          </div>
        )}
        {successMsg && (
          <div className="rounded-2xl border border-emerald-500/40 bg-emerald-950/40 px-4 py-3 text-xs text-emerald-100">
            {successMsg}
          </div>
        )}

        {/* フォーム本体（role フィールドは削除） */}
        <section className="rounded-3xl border border-white/10 bg-slate-950/70 px-5 py-5 shadow-[0_18px_45px_rgba(15,23,42,0.8)] backdrop-blur space-y-4 text-xs">
          {/* 表示名 */}
          <div>
            <label className="mb-1.5 block font-medium text-slate-100">
              表示名（ニックネーム）<span className="ml-1 text-pink-400">*</span>
            </label>
            <input
              type="text"
              value={form.display_name}
              onChange={(e) => handleChange('display_name', e.target.value)}
              placeholder="例：岡田スタイリスト / イラストレーター"
              className="w-full rounded-xl border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-50 outline-none ring-0 transition focus:border-pink-400 focus:ring-2 focus:ring-pink-500/40"
            />
          </div>

          {/* 自己紹介 */}
          <div>
            <label className="mb-1.5 block font-medium text-slate-100">
              自己紹介
            </label>
            <textarea
              value={form.bio}
              onChange={(e) => handleChange('bio', e.target.value)}
              rows={4}
              placeholder="活動内容や得意分野、経歴などを書いてください。例：都内を中心にフリーのスタイリストとして活動しています。カットモデル、作品撮りなどお気軽にご相談ください。"
              className="w-full rounded-xl border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-50 outline-none ring-0 transition focus:border-pink-400 focus:ring-2 focus:ring-pink-500/40"
            />
          </div>

          {/* 得意ジャンル */}
          <div>
            <label className="mb-1.5 block font-medium text-slate-100">
              得意ジャンル
            </label>
            <input
              type="text"
              value={form.genre}
              onChange={(e) => handleChange('genre', e.target.value)}
              placeholder="例：ヘア / ポートレート / ロゴデザイン など"
              className="w-full rounded-xl border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-50 outline-none ring-0 transition focus:border-pink-400 focus:ring-2 focus:ring-pink-500/40"
            />
          </div>

          {/* 活動エリア */}
          <div>
            <label className="mb-1.5 block font-medium text-slate-100">
              活動エリア
            </label>
            <input
              type="text"
              value={form.area}
              onChange={(e) => handleChange('area', e.target.value)}
              placeholder="例：東京 / オンラインのみ など"
              className="w-full rounded-xl border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-50 outline-none ring-0 transition focus:border-pink-400 focus:ring-2 focus:ring-pink-500/40"
            />
          </div>

          {/* SNS */}
          <div>
            <label className="mb-1.5 block font-medium text-slate-100">
              Instagram / ポートフォリオ URL
            </label>
            <input
              type="url"
              value={form.instagram_url}
              onChange={(e) => handleChange('instagram_url', e.target.value)}
              placeholder="https://www.instagram.com/your_account"
              className="w-full rounded-xl border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-50 outline-none ring-0 transition focus:border-pink-400 focus:ring-2 focus:ring-pink-500/40"
            />
            <p className="mt-1 text-[11px] text-slate-500">
              依頼者があなたの他の作品も見られるように、SNSやポートフォリオサイトがあれば貼っておきましょう。
            </p>
          </div>

          {/* ボタンエリア */}
          <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={handleCancel}
              className="rounded-full border border-slate-600 bg-slate-900/70 px-4 py-2 text-xs font-medium text-slate-100 hover:bg-slate-800/80 transition"
            >
              キャンセル（プロフィールを見る）
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="rounded-full bg-gradient-to-r from-pink-500 to-sky-500 px-5 py-2 text-xs font-semibold text-white shadow-md shadow-pink-500/30 hover:brightness-110 transition disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {saving ? '保存中…' : 'プロフィールを保存する'}
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}