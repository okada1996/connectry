// app/requests/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

type Role = 'creator' | 'client' | null;

type RequestRow = {
  id: string;
  creator_id: string;
  client_id: string;
  work_id: string | null;
  title: string;
  message: string | null;
  status: 'pending' | 'accepted' | 'rejected' | 'closed';
  created_at: string;
  updated_at: string;
};

type Profile = {
  id: string;
  display_name: string | null;
};

type Work = {
  id: string;
  title: string;
};

type Tab = 'received' | 'sent';

export default function RequestsPage() {
  const router = useRouter();

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<Role>(null);
  const [activeTab, setActiveTab] = useState<Tab>('received');

  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [profilesMap, setProfilesMap] = useState<Record<string, Profile>>({});
  const [worksMap, setWorksMap] = useState<Record<string, Work>>({});

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // ログインユーザー & ロール取得
  useEffect(() => {
    const init = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push('/auth/login?next=/requests');
        return;
      }

      setCurrentUserId(user.id);

      // profiles.role を取得してタブ初期値を決める
      const { data: prof, error: profError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      if (profError) {
        console.error('RequestsPage: profiles 取得エラー', profError.message);
        setUserRole(null);
        // 役割不明ならデフォルト（受けた依頼）
        setActiveTab('received');
        return;
      }

      const role = (prof?.role as Role) ?? null;
      setUserRole(role);

      // 依頼者なら「送った依頼」タブをデフォルトにする
      if (role === 'client') {
        setActiveTab('sent');
      } else {
        setActiveTab('received');
      }
    };

    void init();
  }, [router]);

  // 依頼一覧の取得
  useEffect(() => {
    const fetchData = async () => {
      if (!currentUserId) return;

      setLoading(true);
      setErrorMsg(null);

      try {
        const filterCol = activeTab === 'received' ? 'creator_id' : 'client_id';

        // 1) requests 取得
        const { data: reqData, error: reqError } = await supabase
          .from('requests')
          .select('*')
          .eq(filterCol, currentUserId)
          .order('updated_at', { ascending: false });

        if (reqError) {
          console.error('依頼一覧取得エラー:', reqError.message);
          setErrorMsg('依頼一覧の取得に失敗しました。時間をおいて再度お試しください。');
          setLoading(false);
          return;
        }

        const rows = (reqData || []) as RequestRow[];
        setRequests(rows);

        if (rows.length === 0) {
          setProfilesMap({});
          setWorksMap({});
          setLoading(false);
          return;
        }

        // 2) 関係する profiles / works をまとめて取得
        const profileIds = Array.from(
          new Set(
            rows
              .flatMap((r) => [r.creator_id, r.client_id])
              .filter((id): id is string => Boolean(id))
          )
        );

        const workIds = Array.from(
          new Set(
            rows
              .map((r) => r.work_id)
              .filter((id): id is string => Boolean(id))
          )
        );

        const [profilesRes, worksRes] = await Promise.all([
          profileIds.length
            ? supabase
                .from('profiles')
                .select('id, display_name')
                .in('id', profileIds)
            : Promise.resolve({ data: [], error: null }),
          workIds.length
            ? supabase.from('works').select('id, title').in('id', workIds)
            : Promise.resolve({ data: [], error: null }),
        ]);

        if (profilesRes && !profilesRes.error && profilesRes.data) {
          const map: Record<string, Profile> = {};
          (profilesRes.data as Profile[]).forEach((p) => {
            map[p.id] = p;
          });
          setProfilesMap(map);
        } else {
          setProfilesMap({});
        }

        if (worksRes && !worksRes.error && worksRes.data) {
          const map: Record<string, Work> = {};
          (worksRes.data as Work[]).forEach((w) => {
            map[w.id] = w;
          });
          setWorksMap(map);
        } else {
          setWorksMap({});
        }

        setLoading(false);
      } catch (e) {
        console.error('依頼一覧取得中の予期せぬエラー:', e);
        setErrorMsg('依頼一覧の取得に失敗しました。');
        setLoading(false);
      }
    };

    void fetchData();
  }, [currentUserId, activeTab]);

  const formatTime = (iso: string) =>
    new Date(iso).toLocaleString('ja-JP', {
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

  const statusLabel = (status: RequestRow['status']) => {
    switch (status) {
      case 'pending':
        return '確認中';
      case 'accepted':
        return '受諾済み';
      case 'rejected':
        return '辞退';
      case 'closed':
        return 'クローズ';
      default:
        return status;
    }
  };

  const emptyMessage =
    activeTab === 'received'
      ? 'まだ受けた依頼はありません。'
      : 'まだ送った依頼はありません。';

  const isCreator = userRole === 'creator';
  const isClient = userRole === 'client';

  const subtitle = isClient
    ? 'あなたが送った依頼を一覧で確認できます。'
    : 'あなたが送った依頼 / 受けた依頼を一覧で確認できます。';

  return (
    <div className="min-h-[calc(100vh-56px)] bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-slate-50">
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 py-6 sm:px-6 lg:px-8">
        {/* ヘッダー */}
        <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">
              依頼一覧
            </h1>
            <p className="mt-1 text-xs text-slate-400">{subtitle}</p>
          </div>

          {/* タブ */}
          <div className="inline-flex items-center gap-2 rounded-full bg-slate-900/80 p-1 text-xs border border-slate-700/70">
            {/* クリエイターだけ「受けた依頼」を表示 */}
            {isCreator && (
              <button
                type="button"
                onClick={() => setActiveTab('received')}
                className={`rounded-full px-3 py-1.5 transition ${
                  activeTab === 'received'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                受けた依頼
              </button>
            )}
            {/* 全員：送った依頼 */}
            <button
              type="button"
              onClick={() => setActiveTab('sent')}
              className={`rounded-full px-3 py-1.5 transition ${
                activeTab === 'sent'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              送った依頼
            </button>
          </div>
        </header>

        {/* エラー表示 */}
        {errorMsg && (
          <div className="rounded-2xl border border-red-500/40 bg-red-950/40 px-4 py-3 text-xs text-red-100">
            {errorMsg}
          </div>
        )}

        {/* 本体リスト */}
        <section className="mt-1 rounded-3xl border border-white/15 bg-slate-900/80 px-3 py-3 sm:px-5 sm:py-4 shadow-[0_18px_45px_rgba(15,23,42,0.7)]">
          {loading ? (
            <div className="flex h-40 items-center justify-center text-xs text-slate-400">
              依頼一覧を読み込み中です…
            </div>
          ) : requests.length === 0 ? (
            <div className="flex h-40 flex-col items-center justify-center gap-2 text-center text-xs text-slate-400">
              <p>{emptyMessage}</p>
            </div>
          ) : (
            <ul className="divide-y divide-slate-800/80">
              {requests.map((req) => {
                const isCreatorSide = currentUserId === req.creator_id;
                const otherUserId = isCreatorSide ? req.client_id : req.creator_id;
                const otherProfile = profilesMap[otherUserId];
                const otherName =
                  otherProfile?.display_name ||
                  (isCreatorSide ? '依頼者' : 'クリエイター');

                const work = req.work_id ? worksMap[req.work_id] : undefined;

                return (
                  <li key={req.id}>
                    <button
                      type="button"
                      onClick={() => router.push(`/requests/${req.id}`)}
                      className="flex w-full flex-col gap-1 px-2 py-3 text-left hover:bg-slate-800/70 rounded-2xl transition"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-800 text-[11px] text-slate-200">
                            {otherName.slice(0, 1)}
                          </span>
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-slate-50 truncate">
                              {req.title}
                            </p>
                            <p className="text-[11px] text-slate-400 truncate">
                              {isCreatorSide
                                ? `依頼者：${otherName}`
                                : `クリエイター：${otherName}`}
                            </p>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1 text-right">
                          <span className="inline-flex items-center rounded-full border border-slate-700 bg-slate-900/80 px-2 py-0.5 text-[10px] text-slate-200">
                            {statusLabel(req.status)}
                          </span>
                          <span className="text-[10px] text-slate-500">
                            更新: {formatTime(req.updated_at)}
                          </span>
                        </div>
                      </div>

                      <div className="mt-1 flex items-center justify-between gap-2 text-[11px] text-slate-400">
                        <p className="line-clamp-1">
                          {req.message || 'メッセージなし'}
                        </p>
                        {work && (
                          <p className="shrink-0 text-[10px] text-slate-500">
                            作品：{work.title}
                          </p>
                        )}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}