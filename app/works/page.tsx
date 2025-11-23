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
  tags: string | null;
  is_public: boolean | null;
  created_at: string;
};

type Profile = {
  id: string;
  display_name: string | null;
  genre: string | null;
  area: string | null;
};

type Work = WorkRow & {
  creator_name: string;
  creator_genre: string | null;
  creator_area: string | null;
  likes_count: number;
};

type SortMode = 'newest' | 'popular';

export default function WorksPage() {
  const router = useRouter();

  const [works, setWorks] = useState<Work[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // 🔍 検索＆フィルタ
  const [keyword, setKeyword] = useState('');
  const [genreFilter, setGenreFilter] = useState<string>('');
  const [areaFilter, setAreaFilter] = useState<string>('');

  // 並び替え
  const [sortMode, setSortMode] = useState<SortMode>('newest');

  // ⭐ 作品投稿ボタンを出していいか（creator だけ true）
  const [canPostWork, setCanPostWork] = useState(false);

  // 作品一覧＋プロフィール＋いいね数 取得
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setErrorMsg(null);

      try {
        // 0) ログインユーザー & プロフィール（クリエイター判定）
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (user) {
          const { data: myProfile, error: myProfileError } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .maybeSingle();

          if (myProfileError) {
            console.error(
              'プロフィール取得エラー(投稿可否判定):',
              myProfileError.message
            );
          }

          const role =
            (myProfile as { role?: string | null } | null)?.role ?? null;

          // role が 'creator' のユーザーだけ「作品を投稿する」ボタン表示
          setCanPostWork(role === 'creator');
        } else {
          setCanPostWork(false);
        }

        // 1) 作品一覧（公開作品だけ）
        const { data: worksData, error: worksError } = await supabase
          .from('works')
          .select(
            'id, creator_id, title, description, image_url, tags, is_public, created_at'
          )
          .eq('is_public', true) // ★ 一覧には公開作品だけ
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

        // 2) クリエイタープロフィール
        const creatorIds = Array.from(
          new Set(
            rows
              .map((w) => w.creator_id)
              .filter((id): id is string => Boolean(id))
          )
        );

        const { data: profilesData, error: profilesError } = await supabase
          .from('profiles')
          .select('id, display_name, genre, area')
          .in('id', creatorIds);

        if (profilesError) {
          console.error('プロフィール取得エラー:', profilesError.message);
        }

        const profilesMap: Record<string, Profile> = {};
        (profilesData || []).forEach((p) => {
          const prof = p as Profile;
          profilesMap[prof.id] = prof;
        });

        // 3) work_likes 取得 → work_id ごとに件数集計
        const workIds = rows.map((w) => w.id);

        const { data: likesData, error: likesError } = await supabase
          .from('work_likes')
          .select('work_id')
          .in('work_id', workIds);

        if (likesError) {
          console.error('いいね数取得エラー:', likesError.message);
        }

        const likesCountMap: Record<string, number> = {};
        (likesData || []).forEach((l) => {
          const wid = (l as { work_id: string }).work_id;
          likesCountMap[wid] = (likesCountMap[wid] ?? 0) + 1;
        });

        // 4) 結合して画面用データに整形
        const shaped: Work[] = rows.map((w) => {
          const prof = profilesMap[w.creator_id];
          return {
            ...w,
            creator_name: prof?.display_name || 'クリエイター',
            creator_genre: prof?.genre ?? null,
            creator_area: prof?.area ?? null,
            likes_count: likesCountMap[w.id] ?? 0,
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

  // 🔍 検索＆フィルタ＋並び替え適用
  const filteredAndSortedWorks: Work[] = (() => {
    const filtered = works.filter((w) => {
      // ジャンル
      if (genreFilter && (w.creator_genre || '') !== genreFilter) return false;
      // エリア
      if (areaFilter && (w.creator_area || '') !== areaFilter) return false;

      // キーワード（タイトル・説明・タグ・クリエイター名）
      const kw = keyword.trim().toLowerCase();
      if (kw.length > 0) {
        const haystack = [
          w.title,
          w.description || '',
          w.tags || '',
          w.creator_name || '',
        ]
          .join(' ')
          .toLowerCase();

        if (!haystack.includes(kw)) return false;
      }

      return true;
    });

    const sorted = [...filtered];

    if (sortMode === 'popular') {
      // いいね多い順 → 同数なら新しい順
      sorted.sort((a, b) => {
        if (b.likes_count !== a.likes_count) {
          return b.likes_count - a.likes_count;
        }
        return (
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
      });
    } else {
      // 新着順
      sorted.sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    }

    return sorted;
  })();

  // プルダウン候補用（ジャンル・エリア）
  const genreOptions = Array.from(
    new Set(
      works
        .map((w) => w.creator_genre || '')
        .filter((g) => g && g.trim().length > 0)
    )
  );

  const areaOptions = Array.from(
    new Set(
      works
        .map((w) => w.creator_area || '')
        .filter((a) => a && a.trim().length > 0)
    )
  );

  return (
    <div className="min-h-[calc(100vh-56px)] bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-slate-50">
      <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8 space-y-5">
        {/* ヘッダー */}
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-slate-200">
              <span className="h-1.5 w-1.5 rounded-full bg-pink-400" />
              <span>作品ギャラリー</span>
            </div>
            <h1 className="mt-2 text-xl sm:text-2xl font-semibold tracking-tight">
              みんなの作品から、<span className="text-pink-300">「いいな」</span>を見つける。
            </h1>
            <p className="mt-1 text-xs text-slate-400 max-w-xl">
              スタイリスト、イラストレーター、デザイナー…。Connectry に投稿された作品です。
              気になる作品があれば、詳細からクリエイターへ直接依頼できます。
            </p>
          </div>

          {/* 作品投稿ボタン → クリエイターだけ表示 */}
          {canPostWork && (
            <button
              type="button"
              onClick={() => router.push('/works/new')}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-pink-500 to-sky-500 px-5 py-2 text-xs font-semibold text-white shadow-lg shadow-pink-500/30 transition hover:brightness-110"
            >
              <span className="text-base leading-none">＋</span>
              <span>作品を投稿する</span>
            </button>
          )}
        </header>

        {/* 🔍 検索＆フィルタ ＋ 並び替え */}
        <section className="rounded-3xl border border-white/10 bg-slate-950/80 px-3 py-4 sm:px-5 sm:py-4 shadow-[0_18px_45px_rgba(15,23,42,0.8)]">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            {/* キーワード検索 */}
            <div className="w-full sm:max-w-xs">
              <label className="block text-[11px] text-slate-300 mb-1">
                キーワードで探す
              </label>
              <input
                type="text"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="例）ショート / レイヤー / 撮影 など"
                className="w-full rounded-full border border-slate-700 bg-slate-900/80 px-3 py-1.5 text-xs text-slate-50 placeholder:text-slate-500 outline-none focus:border-pink-400 focus:ring-2 focus:ring-pink-500/30"
              />
            </div>

            <div className="flex flex-wrap items-end gap-3 text-[11px] text-slate-300">
              {/* ジャンル */}
              <div>
                <span className="block mb-1">ジャンル</span>
                <select
                  value={genreFilter}
                  onChange={(e) => setGenreFilter(e.target.value)}
                  className="min-w-[140px] rounded-full border border-slate-700 bg-slate-900/80 px-3 py-1.5 text-xs outline-none focus:border-pink-400 focus:ring-2 focus:ring-pink-500/30"
                >
                  <option value="">すべて</option>
                  {genreOptions.map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </select>
              </div>

              {/* 活動エリア */}
              <div>
                <span className="block mb-1">活動エリア</span>
                <select
                  value={areaFilter}
                  onChange={(e) => setAreaFilter(e.target.value)}
                  className="min-w-[140px] rounded-full border border-slate-700 bg-slate-900/80 px-3 py-1.5 text-xs outline-none focus:border-pink-400 focus:ring-2 focus:ring-pink-500/30"
                >
                  <option value="">すべて</option>
                  {areaOptions.map((a) => (
                    <option key={a} value={a}>
                      {a}
                    </option>
                  ))}
                </select>
              </div>

              {/* 並び替え */}
              <div className="ml-auto flex items-center gap-1 rounded-full border border-slate-700 bg-slate-900/80 px-1 py-1">
                <button
                  type="button"
                  onClick={() => setSortMode('newest')}
                  className={`rounded-full px-3 py-1 text-[11px] transition ${
                    sortMode === 'newest'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  新着順
                </button>
                <button
                  type="button"
                  onClick={() => setSortMode('popular')}
                  className={`rounded-full px-3 py-1 text-[11px] transition ${
                    sortMode === 'popular'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  いいねが多い順
                </button>
              </div>
            </div>
          </div>
        </section>

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
          ) : filteredAndSortedWorks.length === 0 ? (
            <div className="flex h-40 flex-col items-center justify-center gap-2 text-center text-xs text-slate-400">
              <p>条件に合う作品が見つかりませんでした。</p>
              <p>キーワードや絞り込み条件を少しゆるくしてみてください。</p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredAndSortedWorks.map((work) => (
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

                    {/* タグ */}
                    {work.tags && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {work.tags
                          .split(',')
                          .map((tag) => tag.trim())
                          .filter((t) => t.length > 0)
                          .map((tag, idx) => (
                            <span
                              key={`${work.id}-tag-${idx}-${tag}`}
                              className="rounded-full bg-slate-800/90 px-2 py-0.5 text-[10px] text-slate-300"
                            >
                              #{tag}
                            </span>
                          ))}
                      </div>
                    )}

                    <div className="mt-auto flex items-center justify-between pt-1 text-[11px]">
                      <span className="inline-flex items-center gap-1 text-slate-400">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400/80" />
                        {/* 一覧は公開作品だけなので、表示は常に「依頼受付中」でOK */}
                        <span>依頼受付中</span>
                      </span>

                      {/* ❤️ いいね数 */}
                      <span className="inline-flex items-center gap-1 text-pink-300 group-hover:text-pink-200">
                        <span aria-hidden>❤️</span>
                        <span>{work.likes_count}</span>
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