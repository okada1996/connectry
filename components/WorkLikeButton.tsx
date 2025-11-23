// components/WorkLikeButton.tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

type Props = {
  workId: string;
  creatorId: string;
};

type LikeRow = {
  user_id: string;
};

export default function WorkLikeButton({ workId, creatorId }: Props) {
  const router = useRouter();

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [likeCount, setLikeCount] = useState<number>(0);
  const [liked, setLiked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const isOwner = currentUserId === creatorId;

  // 初期ロード：ログインユーザ & いいね状況
  useEffect(() => {
    const init = async () => {
      setLoading(true);
      setErrorMsg(null);

      try {
        // 1) ログインユーザ
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError) {
          console.error('WorkLikeButton: auth.getUser エラー', userError.message);
        }

        const uid = user?.id ?? null;
        setCurrentUserId(uid);

        // 2) この作品への全いいねを取得
        const { data, error, count } = await supabase
          .from('work_likes')
          .select('user_id', { count: 'exact' })
          .eq('work_id', workId);

        if (error) {
          console.error('WorkLikeButton: work_likes 取得エラー', error.message);
          setErrorMsg('いいね情報の取得に失敗しました。時間をおいて再度お試しください。');
          setLoading(false);
          return;
        }

        const rows = (data || []) as LikeRow[];
        setLikeCount(count ?? rows.length);

        if (uid) {
          const alreadyLiked = rows.some((r) => r.user_id === uid);
          setLiked(alreadyLiked);
        } else {
          setLiked(false);
        }

        setLoading(false);
      } catch (e) {
        console.error('WorkLikeButton: 予期せぬエラー', e);
        setErrorMsg('いいね情報の取得に失敗しました。');
        setLoading(false);
      }
    };

    void init();
  }, [workId]);

  // いいねトグル
  const handleToggleLike = async () => {
    setErrorMsg(null);

    // ログインしてない → ログイン画面へ
    if (!currentUserId) {
      router.push(`/auth/login?next=/works/${workId}`);
      return;
    }

    // 自分の作品にはいいねできない
    if (isOwner) {
      return;
    }

    if (toggling) return;
    setToggling(true);

    try {
      if (!liked) {
        // いいね追加
        const { error } = await supabase
          .from('work_likes')
          .insert({
            work_id: workId,
            user_id: currentUserId,
          });

        if (error) {
          console.error('WorkLikeButton: いいね追加エラー', error.message);
          setErrorMsg('いいねの追加に失敗しました。時間をおいて再度お試しください。');
          setToggling(false);
          return;
        }

        setLiked(true);
        setLikeCount((prev) => prev + 1);
      } else {
        // いいね解除
        const { error } = await supabase
          .from('work_likes')
          .delete()
          .eq('work_id', workId)
          .eq('user_id', currentUserId);

        if (error) {
          console.error('WorkLikeButton: いいね解除エラー', error.message);
          setErrorMsg('いいねの解除に失敗しました。時間をおいて再度お試しください。');
          setToggling(false);
          return;
        }

        setLiked(false);
        setLikeCount((prev) => Math.max(0, prev - 1));
      }

      setToggling(false);
    } catch (e) {
      console.error('WorkLikeButton: トグル時の予期せぬエラー', e);
      setErrorMsg('いいねの切り替えに失敗しました。');
      setToggling(false);
    }
  };

  const buttonLabel = (() => {
    if (!currentUserId) return 'ログインしていいね';
    if (isOwner) return '自分の作品';
    return liked ? 'いいね済み' : 'いいね';
  })();

  return (
    <div className="flex flex-col items-start gap-1 text-[11px] text-slate-300">
      <button
        type="button"
        onClick={handleToggleLike}
        disabled={loading || toggling || isOwner}
        className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-medium transition ${
          liked
            ? 'border-pink-500/80 bg-pink-500/15 text-pink-100'
            : 'border-slate-600 bg-slate-900/70 text-slate-100 hover:border-pink-400 hover:text-pink-100'
        } disabled:opacity-60 disabled:cursor-not-allowed`}
      >
        <span className={liked ? 'text-pink-300' : 'text-slate-300'}>
          {liked ? '❤️' : '🤍'}
        </span>
        <span>{buttonLabel}</span>
        <span className="ml-1 text-[10px] opacity-80">({likeCount})</span>
      </button>

      {errorMsg && <span className="text-[10px] text-red-300">{errorMsg}</span>}
    </div>
  );
}