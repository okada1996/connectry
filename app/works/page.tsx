// app/works/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

type WorkRow = {
  id: string;
  creator_id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  created_at: string;
};

type Profile = {
  id: string;
  display_name: string | null;
};

type Work = WorkRow & {
  creator_name: string;
};

export default function WorksPage() {
  const router = useRouter();

  const [works, setWorks] = useState<Work[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // 作品一覧の取得
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setErrorMsg(null);

      try {
        const { data: worksData, error: worksError } = await supabase
        .from('works')
        .select('id, creator_id, title, description, image_url, created_at, is_public')
        .eq('is_public', true) // ★ 公開作品だけを表示
        .order('created_at', { ascending: false });
        
        if (worksError) {
          console.error('作品一覧取得エラー:', worksError.message);
          setErrorMsg('作品一覧の取得に失敗しました。時間をおいて再度お試しください。');
          setLoading(false);
          return;
        }

        const rows = (worksData || []) as WorkRow[];

        if (rows.length === 0) {
          setWorks([]);
          setLoading(false);
          return;
        }

        // 2) クリエイターの profiles をまとめて取得
        const creatorIds = Array.from(
          new Set(rows.map((w) => w.creator_id).filter((id): id is string => Boolean(id)))
        );

        const { data: profilesData, error: profilesError } = await supabase
          .from('profiles')
          .select('id, display_name')
          .in('id', creatorIds);

        if (profilesError) {
          console.error('プロフィール取得エラー:', profilesError.message);
        }

        const profilesMap: Record<string, Profile> = {};
        (profilesData || []).forEach((p) => {
          const prof = p as Profile;
          profilesMap[prof.id] = prof;
        });

        // 3) 結合して画面用データに整形
        const shaped: Work[] = rows.map((w) => {
          const prof = profilesMap[w.creator_id];
          return {
            ...w,
            creator_name: prof?.display_name || 'クリエイター',
          };
        });

        setWorks(shaped);
        setLoading(false);
      } catch (e) {
        console.error('作品一覧取得中の予期せぬエラー:', e);
        setErrorMsg('作品一覧の取得に失敗しました。');
        setLoading(false);
      }
    };

    void fetchData();
  }, []);

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('ja-JP', {
      month: 'numeric',
      day: 'numeric',
    });

  return (
    <div className="min-h-[calc(100vh-56px)] bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-slate-50">
      <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8 space-y-5">
        {/* ページヘッダー（ボタンは削除） */}
        <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-slate-200">
              <span className="h-1.5 w-1.5 rounded-full bg-pink-400" />
              <span>作品ギャラリー</span>
            </div>
            <h1 className="mt-2 text-xl sm:text-2xl font-semibold tracking-tight">
              みんなの作品から、<span className="text-pink-300">「いいな」</span>を見つける。
            </h1>
            <p className="mt-1 text-xs text-slate-400 max-w-xl">
              スタイリスト、イラストレーター、デザイナー…。Connectry に投稿された最新の作品です。
              気になる作品があれば、詳細からクリエイターへ直接依頼できます。
            </p>
          </div>
        </header>

        {/* エラー */}
        {errorMsg && (
          <div className="rounded-2xl border border-red-500/40 bg-red-950/40 px-4 py-3 text-xs text-red-100">
            {errorMsg}
          </div>
        )}

        {/* コンテンツ */}
        <section className="rounded-3xl border border-white/10 bg-slate-950/60 px-3 py-4 sm:px-5 sm:py-6 shadow-[0_18px_45px_rgba(15,23,42,0.8)] backdrop-blur">
          {loading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="rounded-2xl border border-slate-800 bg-slate-900/80 overflow-hidden animate-pulse"
                >
                  <div className="h-40 w-full bg-slate-800" />
                  <div className="space-y-2 px-4 py-3">
                    <div className="h-4 w-3/4 rounded bg-slate-800" />
                    <div className="h-3 w-1/2 rounded bg-slate-800" />
                    <div className="h-3 w-full rounded bg-slate-800" />
                  </div>
                </div>
              ))}
            </div>
          ) : works.length === 0 ? (
            <div className="flex h-40 flex-col items-center justify-center gap-2 text-center text-xs text-slate-400">
              <p>まだ作品が投稿されていません。</p>
              <p>最初の作品を投稿して、あなたの「らしさ」を見せてみませんか？</p>
              {/* ここは「まだ何もない時だけ」の導線なので残してOK */}
              <button
                type="button"
                onClick={() => router.push('/works/new')}
                className="mt-2 rounded-full border border-slate-600 bg-slate-900/80 px-4 py-2 text-xs font-semibold text-slate-100 hover:bg-slate-800/80 transition"
              >
                作品を投稿する
              </button>
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
                  {/* サムネイル */}
                  <div className="relative h-40 w-full overflow-hidden bg-slate-800">
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

                  {/* テキストエリア */}
                  <div className="flex flex-1 flex-col gap-2 px-4 py-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h2 className="truncate text-sm font-semibold text-slate-50">
                          {work.title}
                        </h2>
                        <p className="mt-0.5 text-[11px] text-slate-400 truncate">
                          by {work.creator_name}
                        </p>
                      </div>
                      <span className="shrink-0 rounded-full bg-slate-800/90 px-2 py-0.5 text-[10px] text-slate-300">
                        {formatDate(work.created_at)}
                      </span>
                    </div>

                    {work.description && (
                      <p className="line-clamp-2 text-[11px] text-slate-300">
                        {work.description}
                      </p>
                    )}

                    <div className="mt-auto flex items-center justify-between pt-1 text-[11px]">
                      <span className="inline-flex items-center gap-1 text-slate-400">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400/80" />
                        <span>依頼受付中</span>
                      </span>
                      <span className="inline-flex items-center gap-1 text-pink-300 group-hover:text-pink-200">
                        <span>作品の詳細を見る</span>
                        <span className="translate-x-0 text-[12px] transition group-hover:translate-x-0.5">
                          →
                        </span>
                      </span>
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