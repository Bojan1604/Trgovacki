import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Blagajna',
};

/** Blagajna radi preko cijelog ekrana, bez navigacije back officea. */
export default function PosLayout({ children }: { children: React.ReactNode }) {
  return <div className="h-screen overflow-hidden bg-canvas">{children}</div>;
}
