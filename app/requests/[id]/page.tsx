'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

type Status = 'pending' | 'accepted' | 'rejected' | 'closed';

type RequestRow = {
  id: string;
  title: string;
  message: string;
  status: Status;
  creator_id: string;
  client_id: string;
  work_id: string | null;
  created_at: string;
  updated_at: string;
};

type ProfileRow = {
  id: string;
  display_name: string | null;
  role: 'creator' | 'client' | null;
};

type WorkRow = {
  id: string;
  title: string;
};

type MessageRow = {
  id: string;
  sender_id: string;
  body: string;
  created_at: string;
};

type ViewModel = {
  request: RequestRow;
  creator: ProfileRow | null;
  client: ProfileRow | null;
  work: WorkRow | null;
  messages: MessageRow[];
  currentUserId: string | null;
  isCreator: boolean;
  isClient: boolean;
};

export default function RequestDetailPage() {
  const params = useParams();
  const router = useRouter();
  const requestId = params?.id as string;

  const [view, setView] = useState<ViewModel | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // ステータスとフラッシュメッセージをローカルで持つ
  const [status, setStatus] = useState<Status>('pending');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);

  // 初期ロード
  useEffect(() => {
    const init = async () => {
      if (!requestId) return;
      setLoading(true);
      setErrorMsg(null);

      try {
        // 1. ログインユーザー取得
        const {
          data: { user },
        } = await supabase.auth.getUser();

        const currentUserId = user?.id ?? null;

        // 2. リクエスト本体取得
        const { data: reqData, error: reqError } = await supabase
          .from('requests')
          .select('*')
          .eq('id', requestId)
          .single();

        if (reqError || !reqData) {
          console.error('RequestDetail: requests 取得エラー', reqError?.message);
          setErrorMsg('依頼の情報を取得できませんでした。削除された可能性があります。');
          setLoading(false);
          return;
        }

        const request = reqData as RequestRow;
        setStatus(request.status);

        // 3. 関連プロフィール
        const { data: profilesData, error: profilesError } = await supabase
          .from('profiles')
          .select('id, display_name, role')
          .in('id', [request.creator_id, request.client_id]);

        if (profilesError) {
          console.error('RequestDetail: profiles 取得エラー', profilesError.message);
        }

        let creator: ProfileRow | null = null;
        let client: ProfileRow | null = null;

        (profilesData || []).forEach((p) => {
          const row = p as ProfileRow;
          if (row.id === request.creator_id) creator = row;
          if (row.id === request.client_id) client = row;
        });

        // 4. 作品タイトル（あれば）
        let work: WorkRow | null = null;
        if (request.work_id) {
          const { data: workData, error: workError } = await supabase
            .from('works')
            .select('id, title')
            .eq('id', request.work_id)
            .single();

          if (!workError && workData) {
            work = workData as WorkRow;
          }
        }

        // 5. メッセージ一覧
        const { data: msgData, error: msgError } = await supabase
          .from('messages')
          .select('id, sender_id, body, created_at')
          .eq('request_id', requestId)
          .order('created_at', { ascending: true });

        if (msgError) {
          console.error('RequestDetail: messages 取得エラー', msgError.message);
        }

        const messages = (msgData || []) as MessageRow[];

        const isCreator = !!currentUserId && currentUserId === request.creator_id;
        const isClient = !!currentUserId && currentUserId === request.client_id;

        if (!isCreator && !isClient) {
          setErrorMsg('この依頼を見る権限がありません。');
          setLoading(false);
          return;
        }

        setView({
          request,
          creator,
          client,
          work,
          messages,
          currentUserId,
          isCreator,
          isClient,
        });

        setLoading(false);
      } catch (e) {
        console.error('RequestDetail: 予期せぬエラー', e);
        setErrorMsg('依頼の取得中にエラーが発生しました。');
        setLoading(false);
      }
    };

    void init();
  }, [requestId]);

  const formatDateTime = (iso: string) =>
    new Date(iso).toLocaleString('ja-JP', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

  // ステータス更新共通処理
  const updateStatus = async (next: Status, successMessage: string) => {
    if (!view) return;

    setUpdatingStatus(true);
    setStatusMessage(null);
    setErrorMsg(null);

    const { error } = await supabase
      .from('requests')
      .update({ status: next })
      .eq('id', view.request.id);

    if (error) {
      console.error('RequestDetail: ステータス更新エラー', error.message);
      setErrorMsg('ステータスの更新に失敗しました。時間をおいて再度お試しください。');
      setUpdatingStatus(false);
      return;
    }

    // ローカル状態を即反映
    setStatus(next);
    setView({
      ...view,
      request: { ...view.request, status: next, updated_at: new Date().toISOString() },
    });
    setStatusMessage(successMessage);
    setUpdatingStatus(false);

    setTimeout(() => {
      setStatusMessage(null);
    }, 3000);
  };

  const handleAccept = () => {
    void updateStatus(
      'accepted',
      'この依頼を「受ける」として受付しました。メッセージで詳細を相談できます。'
    );
  };

  const handleReject = () => {
    void updateStatus('rejected', 'この依頼を「お断りする」として処理しました。');
  };

  const handleClose = () => {
    void updateStatus('closed', 'この依頼をクローズしました。');
  };

  // メッセージ送信
  const handleSendMessage = async () => {
    if (!view || !view.currentUserId) return;
    if (!newMessage.trim()) return;

    setSending(true);
    setErrorMsg(null);

    const body = newMessage.trim();

    const { data, error } = await supabase
      .from('messages')
      .insert({
        request_id: view.request.id,
        sender_id: view.currentUserId,
        body,
      })
      .select('id, sender_id, body, created_at')
      .single();

    if (error || !data) {
      console.error('RequestDetail: メッセージ送信エラー', error?.message);
      setErrorMsg('メッセージの送信に失敗しました。時間をおいて再度お試しください。');
      setSending(false);
      return;
    }

    setView({
      ...view,
      messages: [...view.messages, data as MessageRow],
    });
    setNewMessage('');
    setSending(false);
  };

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-56px)] flex items-center justify-center">
        <div className="text-xs text-slate-400">依頼の情報を読み込み中です…</div>
      </div>
    );
  }

  if (errorMsg || !view) {
    return (
      <div className="min-h-[calc(100vh-56px)] flex items-center justify-center">
        <div className="rounded-2xl border border-red-500/40 bg-red-950/40 px-4 py-3 text-xs text-red-100">
          {errorMsg || '依頼が見つかりませんでした。'}
        </div>
      </div>
    );
  }

  const { request, creator, client, work, messages, isCreator, isClient } = view;

  const statusLabel = (() => {
    switch (status) {
      case 'pending':
        return '保留中（対応待ち）';
      case 'accepted':
        return '受けた依頼（対応中）';
      case 'rejected':
        return 'お断り済み';
      case 'closed':
        return 'クローズ済み';
      default:
        return status;
    }
  })();

  const statusStyle = (() => {
    switch (status) {
      case 'pending':
        return 'border-yellow-500/60 bg-yellow-500/10 text-yellow-100';
      case 'accepted':
        return 'border-emerald-500/70 bg-emerald-500/10 text-emerald-100';
      case 'rejected':
        return 'border-red-500/70 bg-red-500/10 text-red-100';
      case 'closed':
        return 'border-slate-500/70 bg-slate-800/70 text-slate-100';
      default:
        return 'border-slate-600 bg-slate-900/70 text-slate-100';
    }
  })();

  const canOperateStatus = isCreator && (status === 'pending' || status === 'accepted');

  return (
    <div className="min-h-[calc(100vh-56px)]">
      <main className="mx-auto w-full max-w-5xl space-y-6">
        {/* 戻るボタン */}
        <div className="mb-1">
          <button
            type="button"
            onClick={() => router.push('/requests')}
            className="inline-flex items-center gap-1 rounded-full border border-slate-700 bg-slate-900/70 px-3 py-1 text-[11px] text-slate-200 hover:bg-slate-800/80 transition"
          >
            <span className="text-xs">←</span>
            <span>依頼一覧に戻る</span>
          </button>
        </div>

        {/* 上部ヘッダー */}
        <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-slate-200">
              <span className="h-1.5 w-1.5 rounded-full bg-pink-400" />
              <span>依頼詳細</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">
              {request.title}
            </h1>
            <p className="text-[11px] text-slate-400">
              作成日: {formatDateTime(request.created_at)}
            </p>
          </div>

          <div className="flex flex-col items-end gap-2 text-xs">
            <span
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 ${statusStyle}`}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-current/80" />
              <span>{statusLabel}</span>
            </span>

            {canOperateStatus && (
              <div className="flex flex-wrap gap-2 justify-end">
                {status === 'pending' && (
                  <>
                    <button
                      type="button"
                      onClick={handleAccept}
                      disabled={updatingStatus}
                      className="rounded-full bg-emerald-500/90 px-3 py-1.5 text-[11px] font-semibold text-slate-950 shadow-sm hover:bg-emerald-400 transition disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {updatingStatus ? '更新中…' : '依頼を受ける'}
                    </button>
                    <button
                      type="button"
                      onClick={handleReject}
                      disabled={updatingStatus}
                      className="rounded-full border border-red-500/70 bg-red-500/10 px-3 py-1.5 text-[11px] font-semibold text-red-100 hover:bg-red-500/20 transition disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      お断りする
                    </button>
                  </>
                )}

                {status === 'accepted' && (
                  <button
                    type="button"
                    onClick={handleClose}
                    disabled={updatingStatus}
                    className="rounded-full border border-slate-600 bg-slate-900/80 px-3 py-1.5 text-[11px] font-semibold text-slate-100 hover:bg-slate-800/80 transition disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {updatingStatus ? '更新中…' : 'この依頼をクローズする'}
                  </button>
                )}
              </div>
            )}
          </div>
        </header>

        {/* ステータス変更のフラッシュメッセージ */}
        {statusMessage && (
          <div className="rounded-2xl border border-emerald-500/50 bg-emerald-500/10 px-4 py-3 text-[11px] text-emerald-100">
            {statusMessage}
          </div>
        )}

        {/* エラー */}
        {errorMsg && (
          <div className="rounded-2xl border border-red-500/40 bg-red-950/40 px-4 py-3 text-[11px] text-red-100">
            {errorMsg}
          </div>
        )}

        <section className="grid gap-6 lg:grid-cols-[1.4fr_1.1fr]">
          {/* 左：メッセージスレッド */}
          <div className="space-y-4">
            {/* 初回依頼内容 */}
            <div className="rounded-3xl border border-white/10 bg-slate-950/70 px-4 py-4 text-xs text-slate-200">
              <h2 className="mb-2 text-[13px] font-semibold text-slate-50">
                初回の依頼内容
              </h2>
              <p className="whitespace-pre-wrap leading-relaxed text-[12px]">
                {request.message}
              </p>
            </div>

            {/* メッセージ一覧 */}
            <div className="rounded-3xl border border-white/10 bg-slate-950/80 px-4 py-4 flex flex-col gap-3 max-h-[420px] overflow-y-auto">
              {messages.length === 0 ? (
                <p className="text-[11px] text-slate-500">
                  まだメッセージはありません。ここから条件のすり合わせができます。
                </p>
              ) : (
                messages.map((m) => {
                  const isMe = m.sender_id === view.currentUserId;
                  const sender =
                    m.sender_id === creator?.id
                      ? creator?.display_name || 'クリエイター'
                      : client?.display_name || '依頼者';

                  return (
                    <div
                      key={m.id}
                      className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[75%] rounded-2xl px-3 py-2 text-[11px] leading-relaxed ${
                          isMe
                            ? 'bg-gradient-to-r from-pink-500 to-sky-500 text-white'
                            : 'bg-slate-800/90 text-slate-100'
                        }`}
                      >
                        <div className="mb-1 flex items-center justify-between gap-2 text-[10px] opacity-80">
                          <span>{sender}</span>
                          <span>{formatDateTime(m.created_at)}</span>
                        </div>
                        <p className="whitespace-pre-wrap">{m.body}</p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* メッセージ送信フォーム */}
            {view.currentUserId && status !== 'rejected' && status !== 'closed' && (
              <div className="rounded-3xl border border-white/10 bg-slate-950/80 px-4 py-3 space-y-2 text-[11px]">
                <p className="text-slate-400">
                  メッセージで詳細を相談できます。納期・金額・条件などをここで擦り合わせてください。
                </p>
                <textarea
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  rows={3}
                  placeholder="例）〇月△日に撮影をお願いしたいです。条件のすり合わせをさせてください。"
                  className="mt-1 w-full rounded-2xl border border-slate-700 bg-slate-900/80 px-3 py-2 text-[12px] text-slate-50 outline-none focus:border-pink-400 focus:ring-2 focus:ring-pink-500/40"
                />
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={handleSendMessage}
                    disabled={sending || !newMessage.trim()}
                    className="inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-pink-500 to-sky-500 px-4 py-1.5 text-[11px] font-semibold text-white shadow-md shadow-pink-500/40 hover:brightness-110 transition disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {sending ? '送信中…' : 'メッセージを送信'}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* 右：依頼概要・相手情報 */}
          <aside className="space-y-4 text-xs">
            <div className="rounded-3xl border border-white/10 bg-slate-950/80 px-4 py-4">
              <h2 className="mb-2 text-[13px] font-semibold text-slate-50">
                依頼概要
              </h2>
              <dl className="space-y-1.5 text-[11px] text-slate-300">
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-400">依頼者</dt>
                  <dd>{client?.display_name || '依頼者'}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-400">クリエイター</dt>
                  <dd>{creator?.display_name || 'クリエイター'}</dd>
                </div>
                {work && (
                  <div className="flex justify-between gap-4">
                    <dt className="text-slate-400">対象作品</dt>
                    <dd className="text-right">
                      <a
                        href={`/works/${work.id}`}
                        className="text-sky-300 hover:text-sky-200 underline underline-offset-2"
                      >
                        {work.title}
                      </a>
                    </dd>
                  </div>
                )}
              </dl>
            </div>

            <div className="rounded-3xl border border-slate-800 bg-slate-950/80 px-4 py-3 text-[11px] text-slate-400">
              <p>
                ステータスは
                <span className="mx-1 font-semibold text-slate-100">{statusLabel}</span>
                です。
              </p>
              {isCreator && status === 'pending' && (
                <p className="mt-1">
                  「依頼を受ける」を押すと、この画面がそのままやり取り用のチャットルームとして使えます。
                </p>
              )}
              {isCreator && status === 'accepted' && (
                <p className="mt-1">
                  作業が完了したら「この依頼をクローズする」で締めておくと管理しやすくなります。
                </p>
              )}
            </div>
          </aside>
        </section>
      </main>
    </div>
  );
}