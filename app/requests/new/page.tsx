// app/requests/new/page.tsx
import { Suspense } from 'react';
import RequestNewPageClient from './RequestNewPageClient';

export default function RequestNewPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[calc(100vh-56px)] flex items-center justify-center">
          <p className="text-xs text-slate-400">依頼フォームを読み込み中です…</p>
        </div>
      }
    >
      <RequestNewPageClient />
    </Suspense>
  );
}