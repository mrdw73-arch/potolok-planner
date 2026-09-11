import type { Metadata } from 'next';
import './globals.css';
import CloudSync from './components/CloudSync';

export const metadata: Metadata = {
  title: 'Potolok Planner',
  description: 'Планировщик натяжных потолков',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ru"><body><CloudSync />{children}</body></html>;
}
