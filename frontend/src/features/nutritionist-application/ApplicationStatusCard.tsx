import { CalendarClock, Check } from 'lucide-react';
import { applicationStatusLabels, applicationStatusOrder, type PublicApplication } from './model';

export function ApplicationStatusCard({ application }: { application: PublicApplication }) {
  const activeIndex = applicationStatusOrder.indexOf(application.status);

  return (
    <div className="surface-panel rounded-[30px] p-6 sm:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="portal-kicker !text-brand-green">Application status</p>
          <h2 className="mt-2 font-display text-2xl font-black text-brand-text">
            {applicationStatusLabels[application.status]}
          </h2>
          <p className="mt-2 text-sm text-brand-muted">
            {application.fullName} · {application.email}
          </p>
        </div>
        <span className="w-fit rounded-full border border-brand-green/20 bg-brand-green/10 px-3 py-2 font-mono text-[10px] font-bold text-brand-green">
          {application.referenceCode}
        </span>
      </div>

      {application.status === 'REJECTED' ? (
        <div className="mt-6 rounded-2xl border border-status-error-text/25 bg-status-error-bg/10 p-4 text-sm text-status-error-text">
          {application.decisionReason ||
            'The administrator recorded a final decision. Contact NutriMind if you need clarification.'}
        </div>
      ) : (
        <div className="mt-7 grid gap-3 sm:grid-cols-6">
          {applicationStatusOrder.map((status, index) => {
            const reached = activeIndex >= index;
            return (
              <div key={status} className="relative">
                <div
                  className={`flex h-9 w-9 items-center justify-center rounded-xl border ${reached ? 'border-brand-accent bg-brand-accent text-[#07100d]' : 'border-brand-border bg-brand-bgAlt text-brand-muted'}`}
                >
                  {reached ? <Check className="h-4 w-4" /> : <span className="text-xs font-bold">{index + 1}</span>}
                </div>
                <p className="mt-2 text-[10px] font-semibold leading-4 text-brand-muted">
                  {applicationStatusLabels[status]}
                </p>
              </div>
            );
          })}
        </div>
      )}

      {application.status === 'CALL_SCHEDULED' && application.scheduledCallAt && (
        <div className="mt-6 rounded-2xl border border-brand-cyan/20 bg-brand-cyan/[0.06] p-4">
          <p className="flex items-center gap-2 text-sm font-bold text-brand-text">
            <CalendarClock className="h-4 w-4 text-brand-cyan" />
            {new Date(application.scheduledCallAt).toLocaleString()}
          </p>
          {application.meetingUrl && (
            <a
              href={application.meetingUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-flex text-sm font-bold text-brand-green hover:text-brand-cyan"
            >
              Open meeting link
            </a>
          )}
        </div>
      )}
      {application.status === 'APPROVED' && (
        <p className="mt-6 text-sm leading-6 text-brand-muted">
          {application.invitationSentAt
            ? 'Check your email for the private activation link. It expires after 72 hours.'
            : 'Your application is approved, but invitation delivery is still pending. Contact NutriMind administration for a new invitation.'}
        </p>
      )}
    </div>
  );
}
