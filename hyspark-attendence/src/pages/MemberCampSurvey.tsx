import { Link } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import hysparkLogo from '@/assets/hyspark-logo.png';
import { useApp } from '@/contexts/AppContext';
import CampSurveyCard from '@/components/member/CampSurveyCard';
import { APP_NAME } from '@/lib/brand';

/** 메일 링크(intent=camp-survey) 전용 — 멤버 홈에는 노출하지 않음 */
export default function MemberCampSurvey() {
  const { currentUser, logout, refreshData } = useApp();

  return (
    <div className="member-portal min-h-[100dvh] bg-grid bg-soft-gradient">
      <div className="mx-auto flex min-h-[100dvh] w-full max-w-md flex-col">
        <header className="flex shrink-0 items-center justify-between px-4 py-3">
          <Link to="/" className="app-focus-ring flex items-center gap-2 rounded-lg">
            <img src={hysparkLogo} alt={APP_NAME} className="h-8 w-auto" />
          </Link>
          <button
            type="button"
            onClick={logout}
            className="app-focus-ring rounded-xl p-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            aria-label="로그아웃"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto px-3 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
          {currentUser && (
            <CampSurveyCard
              memberId={currentUser.id}
              focusOnMount
              onSaved={() => refreshData()}
            />
          )}
        </main>
      </div>
    </div>
  );
}
