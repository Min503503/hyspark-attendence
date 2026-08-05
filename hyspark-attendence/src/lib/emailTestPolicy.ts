/** 테스트 발송 수신자 필터 없음 — 선택한 모든 멤버에게 발송 가능 */
export function filterTestEmailRecipients<T extends { email?: string | null }>(members: T[]): T[] {
  return members;
}
