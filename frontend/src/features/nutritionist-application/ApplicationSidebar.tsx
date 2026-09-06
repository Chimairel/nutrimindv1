import { Stethoscope } from 'lucide-react';

const applicationStages = [
  'Online professional application',
  'Manual PRC credential review',
  'Required admin verification call',
  'Private account invitation',
];

export function ApplicationSidebar() {
  return (
    <aside className="futuristic-grid relative overflow-hidden rounded-[32px] bg-[#07100d] p-7 text-white lg:sticky lg:top-24 lg:h-fit lg:p-9">
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-accent text-[#07100d]">
        <Stethoscope className="h-5 w-5" />
      </span>
      <p className="mt-7 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-brand-accent">
        Professional review team
      </p>
      <h1 className="mt-4 font-display text-4xl font-black leading-[1.02] tracking-[-0.045em]">
        Bring professional judgment into the loop.
      </h1>
      <p className="mt-5 text-sm leading-7 text-white/50">
        Registered nutritionist-dietitians from anywhere in the Philippines can apply online. Access is granted only
        after credential review and a one-on-one verification call.
      </p>
      <div className="mt-8 space-y-3">
        {applicationStages.map((item, index) => (
          <div
            key={item}
            className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-xs text-white/70"
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-accent/10 font-mono text-[10px] text-brand-accent">
              0{index + 1}
            </span>
            {item}
          </div>
        ))}
      </div>
      <p className="mt-7 text-[11px] leading-5 text-white/35">
        Submitting an application does not grant access or guarantee employment. NutriMind administrators review every
        applicant.
      </p>
    </aside>
  );
}
