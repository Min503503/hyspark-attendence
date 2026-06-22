/** Admin 테스트 발송은 이 주소로만 허용 */
export const TEST_EMAIL_RECIPIENT = 'cmins1@naver.com';

export function filterTestEmailRecipients<T extends { email?: string | null }>(members: T[]): T[] {
  const allowed = TEST_EMAIL_RECIPIENT.trim().toLowerCase();
  return members.filter(member => member.email?.trim().toLowerCase() === allowed);
}
