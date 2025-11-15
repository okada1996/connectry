// app/layout.tsx
import './globals.css';
import type { Metadata } from 'next';
import { ReactNode } from 'react';
import AppHeader from '@/components/AppHeader';

export const metadata: Metadata = {
  title: 'Connectry',
  description: 'クリエイターと依頼者を「作品」でつなぐマッチングサービス',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ja">
      <body className="min-h-screen bg-slate-950 text-slate-50 antialiased">
        {/* カラフルな背景レイヤー */}
        <div className="pointer-events-none fixed inset-0 -z-10">
          <div className="absolute inset-0 bg-slate-950" />
          <div className="absolute -top-24 -left-16 h-72 w-72 rounded-full bg-pink-500/25 blur-3xl" />
          <div className="absolute -bottom-24 -right-10 h-80 w-80 rounded-full bg-sky-500/25 blur-3xl" />
          <div className="absolute inset-x-10 top-40 h-72 rounded-3xl bg-gradient-to-r from-pink-500/10 via-purple-500/10 to-sky-500/10 blur-2xl" />
        </div>

        {/* ロール連動ヘッダー */}
        <AppHeader />

        {/* コンテンツ領域 */}
        <main className="max-w-6xl mx-auto px-4 py-8">{children}</main>
      </body>
    </html>
  );
}