import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Potolok Planner',
  description: 'Планировщик натяжных потолков',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ru"><body>{children}</body></html>;
}