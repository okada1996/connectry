// app/profile/edit/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
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

export default function ProfileEditPage() {
  const router = useRouter();

  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // フォーム用 state
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [genre, setGenre] = useState('');
  const [area, setArea] = useState('');
  const [instagramUrl, setInstagramUrl] = useState('');

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      setErrorMsg(null);

      // 1. ログインユーザー
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        // 未ログインならログイン画面へ
        router.push('/auth/login?next=/profile/edit');
        return;
      }

      // 2. プロフィール取得
      const { data, error } = await supabase
        .from('profiles')
        .select('id, display_name, role, bio, genre, area, instagram_url')
        .eq('id', user.id)
        .single();

      if (error || !data) {
        console.error('ProfileEdit: profiles 取得エラー', error?.message);
        setErrorMsg('プロフィール情報を取得できませんでした。時間をおいて再度お試しください。');
        setLoading(false);
        return;
      }

      const p = data as ProfileRow;
      setProfile(p);

      setDisplayName(p.display_name || '');
      setBio(p.bio || '');
      setGenre(p.genre || '');
      setArea(p.area || '');
      setInstagramUrl(p.instagram_url || '');

      setLoading(false);
    };

    void init();
  }, [router]);

  const handleSave = async () => {
    if (!profile) return;
    if (!displayName.trim()) {
      setErrorMsg('表示名は必須です。');
      return;
    }

    setSaving(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    const payload: Partial<ProfileRow> = {
      display_name: displayName.trim(),
      bio: bio.trim() || null,
      genre: genre.trim() || null,
    };

    // クリエイターの場合のみ、活動エリア・リンクも更新
    if (profile.role === 'creator') {
      payload.area = area.trim() || null;
      payload.instagram_url = instagramUrl.trim() || null;
    }

    const { error } = await supabase
      .from('profiles')
      .update(payload)
      .eq('id', profile.id);

    if (error) {
      console.error('ProfileEdit: 更新エラー', error.message);
      setErrorMsg('プロフィールの更新に失敗しました。時間をおいて再度お試しください。');
      setSaving(false);
      return;
    }

    setSuccessMsg('プロフィールを保存しました。');
    setSaving(false);

    // ちょっと待ってから詳細画面へ戻す
    setTimeout(() => {
      router.push(`/profile/${profile.id}`);
    }, 800);
  };

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-56px)] flex items-center justify-center">
        <div className="text-xs text-slate-400">プロフィールを読み込み中です…</div>
      </div>
    );
  }

  if (errorMsg && !profile) {
    return (
      <div className="min-h-[calc(100vh-56px)] flex items-center justify-center">
        <div className="rounded-2xl border border-red-500/40 bg-red-950/40 px-4 py-3 text-xs text-red-100">
          {errorMsg}
        </div>
      </div>
    );
  }

  if (!profile) return null;

  const isCreator = profile.role === 'creator';
  const isClient = profile.role === 'client';

  const titleText = isCreator ? 'クリエイタープロフィールの編集' : 'プロフィールの編集';
  const roleLabel = isCreator ? 'クリエイター' : isClient ? '依頼者' : 'ユーザー';

  return (
    <div className="min-h-[calc(100vh-56px)]">
      <main className="mx-auto w-full max-w-3xl space-y-6">
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
        <header className="space-y-2">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-slate-200">
            <span className="h-1.5 w-1.5 rounded-full bg-pink-400" />
            <span>{roleLabel}プロフィール編集</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">
            {titleText}
          </h1>
          <p className="text-[11px] text-slate-400">
            自己紹介や興味のあるジャンルを編集できます。
            {isCreator && ' クリエイターの方は、活動エリアや外部リンクも登録できます。'}
          </p>
        </header>

        {/* メッセージ */}
        {errorMsg && (
          <div className="rounded-2xl border border-red-500/40 bg-red-950/40 px-4 py-3 text-[11px] text-red-100">
            {errorMsg}
          </div>
        )}
        {successMsg && (
          <div className="rounded-2xl border border-emerald-500/50 bg-emerald-500/10 px-4 py-3 text-[11px] text-emerald-100">
            {successMsg}
          </div>
        )}

        {/* フォーム本体 */}
        <section className="space-y-4 rounded-3xl border border-white/10 bg-slate-950/80 px-4 py-5 text-xs text-slate-200">
          {/* 共通：表示名 */}
          <div className="space-y-1.5">
            <label className="block text-[11px] font-semibold text-slate-100">
              表示名 <span className="text-pink-400">*</span>
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="例）岡田 / Naoki / ○○スタイリスト"
              className="w-full rounded-2xl border border-slate-700 bg-slate-900/80 px-3 py-2 text-[12px] text-slate-50 outline-none focus:border-pink-400 focus:ring-2 focus:ring-pink-500/40"
            />
            <p className="text-[10px] text-slate-500">
              相手に表示される名前です。本名でもニックネームでも構いません。
            </p>
          </div>

          {/* 共通：自己紹介 */}
          <div className="space-y-1.5">
            <label className="block text-[11px] font-semibold text-slate-100">
              自己紹介
            </label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={4}
              placeholder={
                isCreator
                  ? '例）普段は都内でフリーランスのフォトグラファーをしています。ポートレート撮影やプロフィール写真が得意です。'
                  : '例）〇〇業界で働いています。休日に撮影やイラストの依頼をしたく、このサービスを使っています。'
              }
              className="w-full rounded-2xl border border-slate-700 bg-slate-900/80 px-3 py-2 text-[12px] text-slate-50 outline-none focus:border-pink-400 focus:ring-2 focus:ring-pink-500/40"
            />
          </div>

          {/* 共通：興味のあるジャンル / 得意ジャンル */}
          <div className="space-y-1.5">
            <label className="block text-[11px] font-semibold text-slate-100">
              興味のあるジャンル
            </label>
            <input
              type="text"
              value={genre}
              onChange={(e) => setGenre(e.target.value)}
              placeholder={
                isCreator
                  ? '例）ポートレート / Webデザイン / ロゴ / 名刺 など'
                  : '例）プロフィール写真 / 似顔絵 / ロゴデザイン など'
              }
              className="w-full rounded-2xl border border-slate-700 bg-slate-900/80 px-3 py-2 text-[12px] text-slate-50 outline-none focus:border-pink-400 focus:ring-2 focus:ring-pink-500/40"
            />
          </div>

          {/* クリエイター専用フィールド */}
          {isCreator && (
            <>
              {/* 活動エリア */}
              <div className="space-y-1.5">
                <label className="block text-[11px] font-semibold text-slate-100">
                  活動エリア
                </label>
                <input
                  type="text"
                  value={area}
                  onChange={(e) => setArea(e.target.value)}
                  placeholder="例）都内中心（渋谷・新宿周辺）、オンライン対応可"
                  className="w-full rounded-2xl border border-slate-700 bg-slate-900/80 px-3 py-2 text-[12px] text-slate-50 outline-none focus:border-pink-400 focus:ring-2 focus:ring-pink-500/40"
                />
              </div>

              {/* 外部リンク（Instagram / ポートフォリオ） */}
              <div className="space-y-1.5">
                <label className="block text-[11px] font-semibold text-slate-100">
                  外部リンク（Instagram / ポートフォリオ）
                </label>
                <input
                  type="url"
                  value={instagramUrl}
                  onChange={(e) => setInstagramUrl(e.target.value)}
                  placeholder="https:// から始まる URL を入力してください"
                  className="w-full rounded-2xl border border-slate-700 bg-slate-900/80 px-3 py-2 text-[12px] text-slate-50 outline-none focus:border-pink-400 focus:ring-2 focus:ring-pink-500/40"
                />
                <p className="text-[10px] text-slate-500">
                  Instagram やポートフォリオサイトなど、作品がまとまっている URL があれば入力してください。
                </p>
              </div>
            </>
          )}

          {/* ボタン */}
          <div className="mt-3 flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => router.back()}
              className="rounded-full border border-slate-600 bg-slate-900/80 px-4 py-1.5 text-[11px] font-medium text-slate-100 hover:bg-slate-800/80 transition"
            >
              キャンセル
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="rounded-full bg-gradient-to-r from-pink-500 to-sky-500 px-5 py-1.5 text-[11px] font-semibold text-white shadow-md shadow-pink-500/40 hover:brightness-110 transition disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {saving ? '保存中…' : '保存する'}
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}