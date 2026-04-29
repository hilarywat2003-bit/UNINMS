import type { Metadata } from 'next';
import '@/styles/globals.css';
import { Providers } from './providers';

export const metadata: Metadata = {
  title: { template: '%s — UniNMS', default: 'UniNMS · National Knowledge Network' },
  description: 'National Intelligence Knowledge Management System for Nigerian Universities',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
