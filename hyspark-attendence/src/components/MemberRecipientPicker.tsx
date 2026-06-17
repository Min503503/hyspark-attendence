import { Checkbox } from '@/components/ui/checkbox';
import type { MemberWithSummary } from '@/types';

type Props = {
  members: MemberWithSummary[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
};

export default function MemberRecipientPicker({ members, selectedIds, onChange }: Props) {
  const allSelected = members.length > 0 && selectedIds.length === members.length;

  const toggleAll = () => {
    onChange(allSelected ? [] : members.map(member => member.id));
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
        <span className="text-sm font-bold">모두 선택 ({members.length}명)</span>
      </label>
      <div className="max-h-52 space-y-1 overflow-auto rounded-xl border border-border/60 p-2">
        {members.map(member => (
          <label
            key={member.id}
            className="flex items-center gap-2 rounded-lg px-2 py-2 hover:bg-secondary/30 cursor-pointer"
          >
            <Checkbox
              checked={selectedIds.includes(member.id)}
              onCheckedChange={() => toggleOne(member.id)}
              aria-label={`${member.full_name} 선택`}
            />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">{member.full_name}</div>
              <div className="truncate text-xs text-muted-foreground">{member.email}</div>
            </div>
          </label>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        선택됨: <span className="font-semibold text-foreground">{selectedIds.length}</span>명
      </p>
    </div>
  );
}

export function useDefaultRecipientIds(members: MemberWithSummary[]) {
  return members.map(member => member.id);
}
