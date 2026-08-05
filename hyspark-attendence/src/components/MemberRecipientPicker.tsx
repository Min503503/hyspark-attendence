import { Checkbox } from '@/components/ui/checkbox';
import type { MailDeliveryStatus, MemberWithSummary } from '@/types';
import { cn } from '@/lib/utils';

type Props = {
  members: MemberWithSummary[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
};

function MailStatusBadge({ status }: { status: MailDeliveryStatus }) {
  if (status === 'active') return null;
  const label = status === 'bounced' ? '반송' : '수신거부';
  return (
    <span className={cn(
      'ml-1.5 inline-flex items-center rounded px-1 py-0 text-[10px] font-bold leading-4',
      status === 'bounced'
        ? 'bg-destructive/15 text-destructive'
        : 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
    )}>
      {label}
    </span>
  );
}

export default function MemberRecipientPicker({ members, selectedIds, onChange }: Props) {
  // Bounced members cannot be selected — exclude them from "all"
  const selectableMembers = members.filter(m => m.mail_delivery_status !== 'bounced');
  const allSelected = selectableMembers.length > 0 && selectableMembers.every(m => selectedIds.includes(m.id));

  const toggleAll = () => {
    if (allSelected) {
      onChange([]);
    } else {
      onChange(selectableMembers.map(m => m.id));
    }
  };

  const toggleOne = (id: string) => {
    onChange(
      selectedIds.includes(id)
        ? selectedIds.filter(value => value !== id)
        : [...selectedIds, id],
    );
  };

  if (members.length === 0) {
    return <p className="text-sm text-muted-foreground">이메일이 등록된 활성 학회원이 없습니다.</p>;
  }

  return (
    <div className="space-y-3">
      <label className="flex items-center gap-2 rounded-lg border border-border/60 bg-secondary/20 px-3 py-2.5 cursor-pointer">
        <Checkbox checked={allSelected} onCheckedChange={toggleAll} aria-label="모두 선택" />
        <span className="text-sm font-bold">모두 선택 ({selectableMembers.length}명)</span>
        {selectableMembers.length < members.length && (
          <span className="text-xs text-muted-foreground">
            · 반송 {members.length - selectableMembers.length}명 제외
          </span>
        )}
      </label>
      <div className="max-h-52 space-y-1 overflow-auto rounded-xl border border-border/60 p-2">
        {members.map(member => {
          const isBounced = member.mail_delivery_status === 'bounced';
          return (
            <label
              key={member.id}
              className={cn(
                'flex items-center gap-2 rounded-lg px-2 py-2',
                isBounced
                  ? 'cursor-not-allowed opacity-50'
                  : 'hover:bg-secondary/30 cursor-pointer',
              )}
            >
              <Checkbox
                checked={!isBounced && selectedIds.includes(member.id)}
                disabled={isBounced}
                onCheckedChange={() => !isBounced && toggleOne(member.id)}
                aria-label={`${member.full_name} 선택`}
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center truncate text-sm font-medium">
                  {member.full_name}
                  <MailStatusBadge status={member.mail_delivery_status} />
                </div>
                <div className="truncate text-xs text-muted-foreground">
                  {member.email}
                  {isBounced && member.last_bounce_reason && (
                    <span className="ml-1 text-[10px]">— {member.last_bounce_reason.slice(0, 40)}</span>
                  )}
                </div>
              </div>
            </label>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground">
        선택됨: <span className="font-semibold text-foreground">{selectedIds.length}</span>명
      </p>
    </div>
  );
}

export function useDefaultRecipientIds(members: MemberWithSummary[]) {
  return members.filter(m => m.mail_delivery_status !== 'bounced').map(m => m.id);
}
