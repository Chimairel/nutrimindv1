import SystemErrorPanel from '@/components/ui/SystemErrorPanel';

export default function NotFound() {
  return (
    <main className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-brand-bg p-4 transition-colors duration-300 sm:p-8">
      {/* Ambient background glows */}
      <div className="pointer-events-none absolute -left-40 -top-40 h-[500px] w-[500px] rounded-full bg-brand-green/5 blur-[128px] dark:bg-[#b8f45f]/5" />
      <div className="pointer-events-none absolute -bottom-40 -right-40 h-[500px] w-[500px] rounded-full bg-brand-cyan/5 blur-[128px] dark:bg-[#61e6ff]/5" />

      <SystemErrorPanel />
    </main>
  );
}
