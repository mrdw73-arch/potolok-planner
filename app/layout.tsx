import type { Metadata, Viewport } from 'next';
import './globals.css';
import CloudSync from './components/CloudSync';

export const metadata: Metadata = {
  title: 'Potolok Planner',
  description: 'Планировщик и расчёт натяжных потолков',
  applicationName: 'Potolok Planner',
  appleWebApp: {
    capable: true,
    title: 'Potolok Planner',
    statusBarStyle: 'default',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
  themeColor: '#17191d',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ru"><body><CloudSync />{children}</body></html>;
}
