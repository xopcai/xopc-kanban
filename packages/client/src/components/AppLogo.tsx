import clsx from 'clsx';

/** Brand mark: `logo.svg` / `logo-dark.svg` in `public/` (synced from xopc web). */
export function AppLogo({ className }: { className?: string }) {
  return (
    <span
      className={clsx('relative inline-block shrink-0', className)}
      aria-hidden
    >
      <img
        src="/logo.svg"
        alt=""
        className="h-full w-full object-contain dark:hidden"
        draggable={false}
      />
      <img
        src="/logo-dark.svg"
        alt=""
        className="hidden h-full w-full object-contain dark:block"
        draggable={false}
      />
    </span>
  );
}
