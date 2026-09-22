'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useMemo, useState } from 'react';
import { ChevronsLeft, Monitor, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { hasPermission } from '@/lib/permissions';
import { NAV_GROUPS } from './nav-config';

export function Sidebar({
  permissions,
  tenantName,
  counters = {},
}: {
  permissions: string[];
  tenantName: string;
  counters?: Record<string, number>;
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [filter, setFilter] = useState('');

  const groups = useMemo(() => {
    const term = filter.trim().toLowerCase();
    return NAV_GROUPS.map((group) => ({
      ...group,
      items: group.items.filter(
        (item) =>
          (!item.permission || hasPermission(permissions, item.permission)) &&
          (!term || item.label.toLowerCase().includes(term)),
      ),
    })).filter((group) => group.items.length > 0);
  }, [permissions, filter]);

  return (
    <aside
      className={cn(
        'flex shrink-0 flex-col bg-sidebar transition-[width] duration-150 no-select',
        'border-r border-hairline',
        collapsed ? 'w-[52px]' : 'w-[var(--spacing-sidebar)]',
      )}
    >
      {/* Zaglavlje */}
      <div className="flex h-[var(--spacing-topbar)] items-center gap-2 px-2.5">
        <div className="grid size-[22px] shrink-0 place-items-center rounded-[6px] bg-accent text-white">
          <svg viewBox="0 0 24 24" className="size-[13px]" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 6h18l-1.6 9.2a2 2 0 0 1-2 1.8H6.6a2 2 0 0 1-2-1.8Z" />
            <path d="M8 6V4.5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2V6" />
          </svg>
        </div>
        {!collapsed && (
          <div className="min-w-0 flex-1">
            <p className="truncate text-base font-semibold leading-tight">Trgovački</p>
            <p className="truncate text-2xs text-ink-4 leading-tight">{tenantName}</p>
          </div>
        )}
        <button
          type="button"
          onClick={() => setCollapsed((v) => !v)}
          className="grid size-6 shrink-0 place-items-center rounded-md text-ink-4 hover:bg-surface-3 hover:text-ink-2"
          title={collapsed ? 'Proširi izbornik' : 'Skupi izbornik'}
        >
          <ChevronsLeft className={cn('size-3.5 transition-transform', collapsed && 'rotate-180')} />
        </button>
      </div>

      {/* Filtar izbornika */}
      {!collapsed && (
        <div className="px-2.5 pb-1.5">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2 top-1/2 size-3 -translate-y-1/2 text-ink-4" />
            <input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Traži u izborniku"
              className="h-6 w-full rounded-[6px] border border-transparent bg-surface-3 pl-6.5 pr-2 text-sm placeholder:text-ink-4 focus:border-accent/40 focus:bg-surface focus:outline-none"
              style={{ paddingLeft: 24 }}
            />
          </div>
        </div>
      )}

      {/* Navigacija */}
      <nav className="flex-1 overflow-y-auto scroll-thin px-1.5 pb-2">
        {groups.map((group) => (
          <div key={group.label} className="mb-2">
            {!collapsed && (
              <p className="px-2 pb-1 pt-1.5 text-2xs font-semibold uppercase tracking-[0.06em] text-ink-4">
                {group.label}
              </p>
            )}
            <ul className="space-y-[1px]">
              {group.items.map((item) => {
                const active =
                  pathname === item.href ||
                  (item.href !== '/dashboard' && pathname.startsWith(`${item.href}/`));
                const Icon = item.icon;
                const badge = item.badgeKey ? counters[item.badgeKey] : undefined;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      title={collapsed ? item.label : undefined}
                      className={cn(
                        'group flex h-[26px] items-center gap-2 rounded-[6px] px-2 text-base transition-colors duration-75',
                        active
                          ? 'bg-accent text-white font-medium'
                          : 'text-ink-2 hover:bg-surface-3 hover:text-ink',
                        collapsed && 'justify-center px-0',
                      )}
                    >
                      <Icon className={cn('size-[15px] shrink-0', active ? 'opacity-100' : 'opacity-65')} />
                      {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
                      {!collapsed && badge !== undefined && badge > 0 && (
                        <span
                          className={cn(
                            'rounded-full px-1 text-2xs tnum',
                            active ? 'bg-white/25' : 'bg-ink-4/20 text-ink-2',
                          )}
                        >
                          {badge}
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Blagajna */}
      <div className="p-1.5">
        <Link
          href="/pos"
          className={cn(
            'flex h-8 items-center justify-center gap-1.5 rounded-md bg-ink text-surface text-base font-medium transition-opacity hover:opacity-90',
            collapsed && 'px-0',
          )}
          title="Otvori blagajnu"
        >
          <Monitor className="size-[15px]" />
          {!collapsed && 'Blagajna'}
        </Link>
      </div>
    </aside>
  );
}
