'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useEffect, useState, useTransition } from 'react';
import { Bell, Check, ChevronDown, LogOut, Moon, Store as StoreIcon, Sun, User } from 'lucide-react';
import { Avatar, Badge } from '@/components/ui/primitives';
import { Menu, MenuDivider, MenuItem } from '@/components/ui/overlay';
import { GlobalSearch } from './global-search';
import { cn } from '@/lib/utils';

export interface TopbarStore {
  id: string;
  code: string;
  name: string;
  city: string | null;
}

export function Topbar({
  user,
  stores,
  activeStoreId,
  notifications,
}: {
  user: { fullName: string; email: string; roles: string };
  stores: TopbarStore[];
  activeStoreId: string | null;
  notifications: { id: string; title: string; body: string | null; level: string; link: string | null }[];
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    const stored = (localStorage.getItem('tg-theme') as 'light' | 'dark' | null) ?? null;
    const preferred = stored ?? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    setTheme(preferred);
    document.documentElement.dataset.theme = preferred;
  }, []);

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem('tg-theme', next);
    } catch {
      /* privatni način rada — tema se jednostavno ne pamti */
    }
  };

  const switchStore = (storeId: string) => {
    document.cookie = `tg_store=${storeId}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
    startTransition(() => router.refresh());
  };

  const active = stores.find((s) => s.id === activeStoreId);

  return (
    <header className="flex h-[var(--spacing-topbar)] shrink-0 items-center gap-2 border-b border-hairline glass px-3">
      {/* Odabir poslovnice */}
      <Menu
        width={260}
        align="left"
        trigger={
          <button className="flex h-7 items-center gap-1.5 rounded-md px-2 text-base hover:bg-surface-3">
            <StoreIcon className="size-3.5 text-ink-3" />
            <span className="font-medium">{active ? active.name : 'Sve poslovnice'}</span>
            <ChevronDown className="size-3 text-ink-4" />
          </button>
        }
      >
        {(close) => (
          <>
            <p className="px-2 py-1 text-2xs font-semibold uppercase tracking-wide text-ink-4">Poslovnica</p>
            {stores.map((store) => (
              <MenuItem
                key={store.id}
                icon={store.id === activeStoreId ? <Check className="size-3.5" /> : <span className="size-3.5" />}
                onClick={() => {
                  switchStore(store.id);
                  close();
                }}
              >
                <span className="font-mono text-2xs text-ink-4">{store.code}</span> {store.name}
              </MenuItem>
            ))}
          </>
        )}
      </Menu>

      <div className="mx-1 h-4 w-px bg-hairline" />

      <GlobalSearch />

      <div className="flex-1" />

      {/* Obavijesti */}
      <Menu
        width={300}
        trigger={
          <button className="relative grid size-7 place-items-center rounded-md text-ink-2 hover:bg-surface-3">
            <Bell className="size-4" />
            {notifications.length > 0 && (
              <span className="absolute right-1 top-1 size-[6px] rounded-full bg-negative ring-2 ring-[var(--color-surface)]" />
            )}
          </button>
        }
      >
        <p className="px-2 py-1 text-2xs font-semibold uppercase tracking-wide text-ink-4">Obavijesti</p>
        {notifications.length === 0 ? (
          <p className="px-2 py-3 text-center text-sm text-ink-4">Nema novih obavijesti</p>
        ) : (
          notifications.map((n) => (
            <Link
              key={n.id}
              href={n.link ?? '#'}
              className="block rounded-sm px-2 py-1.5 hover:bg-surface-3"
            >
              <div className="flex items-center gap-1.5">
                <Badge tone={n.level === 'critical' ? 'negative' : n.level === 'warning' ? 'warning' : 'accent'}>
                  {n.level === 'critical' ? 'Hitno' : n.level === 'warning' ? 'Upozorenje' : 'Info'}
                </Badge>
                <span className="truncate text-base font-medium">{n.title}</span>
              </div>
              {n.body && <p className="mt-0.5 line-clamp-2 text-sm text-ink-3">{n.body}</p>}
            </Link>
          ))
        )}
      </Menu>

      <button
        onClick={toggleTheme}
        className="grid size-7 place-items-center rounded-md text-ink-2 hover:bg-surface-3"
        title={theme === 'dark' ? 'Svijetla tema' : 'Tamna tema'}
      >
        {theme === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}
      </button>

      {/* Korisnik */}
      <Menu
        width={210}
        trigger={
          <button className="flex h-7 items-center gap-1.5 rounded-md pl-1 pr-1.5 hover:bg-surface-3">
            <Avatar name={user.fullName} size={22} />
            <ChevronDown className="size-3 text-ink-4" />
          </button>
        }
      >
        <div className="px-2 py-1.5">
          <p className="truncate text-base font-medium">{user.fullName}</p>
          <p className="truncate text-sm text-ink-3">{user.email}</p>
          <p className="mt-1 truncate text-2xs text-ink-4">{user.roles}</p>
        </div>
        <MenuDivider />
        <MenuItem icon={<User className="size-3.5" />} onClick={() => router.push('/settings/profile')}>
          Moj profil
        </MenuItem>
        <MenuDivider />
        <MenuItem
          danger
          icon={<LogOut className="size-3.5" />}
          onClick={async () => {
            await fetch('/api/auth/logout', { method: 'POST' });
            router.push('/login');
            router.refresh();
          }}
        >
          Odjava
        </MenuItem>
      </Menu>
    </header>
  );
}

export { cn };
