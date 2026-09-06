import {
  BadgeCheck,
  CalendarClock,
  CheckCircle2,
  GraduationCap,
  Mail,
  Phone,
  RotateCw,
  ShieldCheck,
  Stethoscope,
  UserCheck,
  Video,
  XCircle,
} from 'lucide-react';
import api from '@/lib/axios';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import {
  statusLabel,
  toLocalInput,
  type ApplicationActionResponse,
  type NutritionistApplication,
  type ScheduleDraft,
} from './model';

type Props = {
  application: NutritionistApplication;
  onAction: (
    id: string,
    request: () => Promise<ApplicationActionResponse>,
    successMessage: string | ((result: ApplicationActionResponse) => string)
  ) => Promise<void>;
  onRejectionReasonChange: (id: string, value: string) => void;
  onScheduleChange: (id: string, draft: ScheduleDraft) => void;
  rejectionReason: string;
  scheduleDraft?: ScheduleDraft;
  workingId: string | null;
};

export function NutritionistApplicationCard(props: Props) {
  const { application, onAction, onRejectionReasonChange, onScheduleChange, rejectionReason, workingId } = props;
  const draft = props.scheduleDraft || {
    scheduledCallAt: toLocalInput(application.availableCallSlots?.[0]),
    meetingUrl: '',
  };
  const callOccurred = Boolean(
    application.scheduledCallAt && new Date(application.scheduledCallAt).getTime() <= Date.now()
  );

  return (
    <Card className="overflow-hidden p-0">
      <ApplicationIdentity application={application} />
      <div className="bg-brand-bgAlt/35 p-5 sm:p-6">
        {application.status === 'SUBMITTED' && (
          <Button
            onClick={() =>
              void onAction(
                application.id,
                () => api.patch(`/admin/nutritionist-applications/${application.id}/stage`, { status: 'UNDER_REVIEW' }),
                'Credential review started.'
              )
            }
            isLoading={workingId === application.id}
          >
            <UserCheck className="h-4 w-4" />
            Begin credential review
          </Button>
        )}
        {application.status === 'UNDER_REVIEW' && (
          <Button
            onClick={() =>
              void onAction(
                application.id,
                () =>
                  api.patch(`/admin/nutritionist-applications/${application.id}/stage`, { status: 'CALL_REQUIRED' }),
                'Applicant advanced to the required call stage.'
              )
            }
            isLoading={workingId === application.id}
          >
            <Video className="h-4 w-4" />
            Credentials checked — require call
          </Button>
        )}
        {application.status === 'CALL_REQUIRED' && (
          <CallScheduler
            application={application}
            draft={draft}
            onScheduleChange={onScheduleChange}
            onAction={onAction}
            workingId={workingId}
          />
        )}
        {application.status === 'CALL_SCHEDULED' && (
          <ScheduledCall
            application={application}
            callOccurred={callOccurred}
            onAction={onAction}
            workingId={workingId}
          />
        )}
        {application.status === 'APPROVED' && (
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs text-brand-muted">
              {application.invitationSentAt
                ? `Invitation sent ${new Date(application.invitationSentAt).toLocaleString()}`
                : 'Invitation delivery needs attention.'}
            </span>
            <Button
              variant="secondary"
              onClick={() =>
                void onAction(
                  application.id,
                  () => api.post(`/admin/nutritionist-applications/${application.id}/resend-invitation`),
                  invitationNotice
                )
              }
              isLoading={workingId === application.id}
            >
              <RotateCw className="h-4 w-4" />
              Resend invitation
            </Button>
          </div>
        )}
        {!['APPROVED', 'REJECTED', 'ACTIVATED'].includes(application.status) && (
          <div className="mt-5 flex flex-col gap-3 border-t border-brand-border/60 pt-5 sm:flex-row">
            <Input
              id={`reject-${application.id}`}
              label="Rejection reason"
              value={rejectionReason}
              onChange={(event) => onRejectionReasonChange(application.id, event.target.value)}
              placeholder="Required before rejecting"
            />
            <Button
              variant="danger"
              className="self-end"
              disabled={!rejectionReason.trim()}
              onClick={() =>
                void onAction(
                  application.id,
                  () =>
                    api.patch(`/admin/nutritionist-applications/${application.id}/decision`, {
                      decision: 'reject',
                      reason: rejectionReason,
                    }),
                  'Application rejected.'
                )
              }
              isLoading={workingId === application.id}
            >
              <XCircle className="h-4 w-4" />
              Reject
            </Button>
          </div>
        )}
        {application.status === 'REJECTED' && (
          <p className="text-xs text-status-error-text">Reason: {application.decisionReason}</p>
        )}
        {application.status === 'ACTIVATED' && (
          <p className="flex items-center gap-2 text-sm font-bold text-brand-green">
            <BadgeCheck className="h-4 w-4" />
            Professional account activated
          </p>
        )}
      </div>
    </Card>
  );
}

function ApplicationIdentity({ application }: { application: NutritionistApplication }) {
  return (
    <div className="border-b border-brand-border/70 p-5 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand-green/10 text-brand-green">
            <Stethoscope className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h3 className="truncate font-display text-base font-black text-brand-text">{application.fullName}</h3>
            <p className="mt-1 font-mono text-[9px] uppercase tracking-wider text-brand-muted">
              {application.referenceCode} · Applied {new Date(application.createdAt).toLocaleDateString()}
            </p>
          </div>
        </div>
        <span className="w-fit rounded-full border border-brand-green/20 bg-brand-green/10 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-brand-green">
          {statusLabel[application.status]}
        </span>
      </div>
      <div className="mt-5 grid gap-2 text-xs sm:grid-cols-2">
        <p className="flex items-center gap-2 rounded-xl bg-brand-bgAlt/60 p-3 text-brand-muted">
          <Mail className="h-3.5 w-3.5" />
          {application.email}
        </p>
        <p className="flex items-center gap-2 rounded-xl bg-brand-bgAlt/60 p-3 text-brand-muted">
          <Phone className="h-3.5 w-3.5" />
          {application.phoneNumber}
        </p>
        <p className="rounded-xl bg-brand-bgAlt/60 p-3 text-brand-muted">
          PRC <strong className="ml-1 text-brand-text">{application.prcLicenseNumber}</strong>
        </p>
        <p className="rounded-xl bg-brand-bgAlt/60 p-3 text-brand-muted">
          Expires{' '}
          <strong className="ml-1 text-brand-text">
            {new Date(application.prcLicenseExpiry).toLocaleDateString()}
          </strong>
        </p>
      </div>
      <div className="mt-4 space-y-2 text-xs leading-5 text-brand-muted">
        <p className="flex items-center gap-2">
          <GraduationCap className="h-3.5 w-3.5" />
          {application.university}
        </p>
        <p className="flex items-center gap-2">
          <ShieldCheck className="h-3.5 w-3.5" />
          {application.specialization} · {application.yearsOfExperience} year(s)
        </p>
        <p className="rounded-xl border border-brand-border/60 p-3">{application.professionalBio}</p>
      </div>
    </div>
  );
}

function CallScheduler({
  application,
  draft,
  onScheduleChange,
  onAction,
  workingId,
}: Pick<Props, 'application' | 'onScheduleChange' | 'onAction' | 'workingId'> & { draft: ScheduleDraft }) {
  return (
    <div className="space-y-4">
      <div>
        <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-brand-muted">Applicant availability</p>
        <div className="flex flex-wrap gap-2">
          {application.availableCallSlots.map((slot) => (
            <button
              key={slot}
              type="button"
              onClick={() => onScheduleChange(application.id, { ...draft, scheduledCallAt: toLocalInput(slot) })}
              className="rounded-xl border border-brand-border bg-brand-surface px-3 py-2 text-[10px] font-semibold text-brand-muted hover:border-brand-green/40"
            >
              {new Date(slot).toLocaleString()}
            </button>
          ))}
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Input
          id={`call-${application.id}`}
          type="datetime-local"
          label="Confirmed call schedule"
          value={draft.scheduledCallAt}
          onChange={(event) => onScheduleChange(application.id, { ...draft, scheduledCallAt: event.target.value })}
        />
        <Input
          id={`meeting-${application.id}`}
          type="url"
          label="Google Meet or Zoom link"
          value={draft.meetingUrl}
          onChange={(event) => onScheduleChange(application.id, { ...draft, meetingUrl: event.target.value })}
          placeholder="https://meet.google.com/..."
        />
      </div>
      <Button
        onClick={() =>
          void onAction(
            application.id,
            () =>
              api.patch(`/admin/nutritionist-applications/${application.id}/schedule`, {
                scheduledCallAt: new Date(draft.scheduledCallAt).toISOString(),
                meetingUrl: draft.meetingUrl,
              }),
            'Verification call scheduled.'
          )
        }
        disabled={!draft.scheduledCallAt || !draft.meetingUrl}
        isLoading={workingId === application.id}
      >
        <CalendarClock className="h-4 w-4" />
        Confirm call
      </Button>
    </div>
  );
}

function ScheduledCall({
  application,
  callOccurred,
  onAction,
  workingId,
}: Pick<Props, 'application' | 'onAction' | 'workingId'> & { callOccurred: boolean }) {
  return (
    <div>
      <div className="rounded-2xl border border-brand-cyan/20 bg-brand-cyan/[0.06] p-4">
        <p className="flex items-center gap-2 text-sm font-bold text-brand-text">
          <CalendarClock className="h-4 w-4 text-brand-cyan" />
          {new Date(application.scheduledCallAt!).toLocaleString()}
        </p>
        {application.meetingUrl && (
          <a
            href={application.meetingUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-2 inline-flex text-xs font-bold text-brand-green"
          >
            Open meeting room
          </a>
        )}
      </div>
      <div className="mt-4 flex flex-wrap gap-3">
        <Button
          onClick={() =>
            void onAction(
              application.id,
              () => api.patch(`/admin/nutritionist-applications/${application.id}/decision`, { decision: 'approve' }),
              approvalNotice
            )
          }
          disabled={!callOccurred}
          isLoading={workingId === application.id}
        >
          <CheckCircle2 className="h-4 w-4" />
          Approve after call
        </Button>
        {!callOccurred && (
          <p className="self-center text-[10px] text-brand-muted">Approval unlocks after the scheduled call time.</p>
        )}
      </div>
    </div>
  );
}

const approvalNotice = (result: ApplicationActionResponse) =>
  result.data?.data?.invitationEmailSent
    ? 'Application approved and invitation email sent.'
    : 'Application approved, but invitation delivery failed. Use resend after checking SMTP.';
const invitationNotice = (result: ApplicationActionResponse) =>
  result.data?.data?.invitationEmailSent
    ? 'A new invitation email was sent.'
    : 'A new invitation was created, but email delivery failed.';
