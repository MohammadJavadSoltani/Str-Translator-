export type ActiveTab = 'studio' | 'compare' | 'history' | 'dialects';

interface HeaderProps {
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  onPrimaryAction: () => void;
  primaryActionLabel: string;
  isBusy: boolean;
}

const NAV_ITEMS: Array<{ id: ActiveTab; label: string }> = [
  { id: 'studio', label: 'Studio' },
  { id: 'compare', label: 'Compare' },
  { id: 'history', label: 'History' },
  { id: 'dialects', label: 'Dialects' },
];

export function Header({
  activeTab,
  onSelectTab,
  onPrimaryAction,
  primaryActionLabel,
  isBusy,
}: HeaderProps) {
  return (
    <header className="sticky top-0 z-30 border-b border-stone-200 dark:border-zinc-800 bg-stone-50/95 dark:bg-zinc-950/95 backdrop-blur-sm">
      <div className="max-w-6xl mx-auto px-3 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-2 sm:gap-8">
        {/* Zone 1: Single-element editorial wordmark */}
        <button
          type="button"
          onClick={() => onSelectTab('studio')}
          className="font-serif text-lg sm:text-2xl font-medium tracking-tight text-zinc-900 dark:text-zinc-50 hover:text-blue-700 dark:hover:text-blue-400 transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 rounded-sm"
        >
          Zaban
        </button>

        {/* Zone 2: Clean single-line text navigation links */}
        <nav
          aria-label="Primary navigation"
          className="flex items-stretch h-full gap-2.5 sm:gap-7"
        >
          {NAV_ITEMS.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectTab(item.id)}
                aria-current={isActive ? 'page' : undefined}
                className={`relative inline-flex items-center text-xs sm:text-sm font-medium transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 rounded-sm ${
                  isActive
                    ? 'text-zinc-950 dark:text-zinc-50'
                    : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
                }`}
              >
                {item.label}
                {isActive && (
                  <span
                    aria-hidden="true"
                    className="absolute inset-x-0 bottom-0 h-[2px] bg-blue-700 dark:bg-blue-400"
                  />
                )}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Single primary action */}
        <div className="shrink-0">
          <button
            type="button"
            onClick={onPrimaryAction}
            disabled={isBusy}
            className="px-2.5 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-medium text-white bg-blue-700 hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-500 disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-700 dark:focus-visible:ring-offset-zinc-950"
          >
            {primaryActionLabel}
          </button>
        </div>
      </div>
    </header>
  );
}
