// Placeholder for sending Telegram messages
export interface SendAdminReportParams {
  groupId: string;
  adminUserIds: string[];
  reportType: 'AGENT_RUN' | 'RECOMMENDATION' | 'SECURITY_ALERT' | 'WEEKLY_SUMMARY';
  title: string;
  summary: string;
  details?: Record<string, unknown>;
}

export async function sendAdminReport(params: SendAdminReportParams): Promise<{ success: boolean; messageIds: string[] }> {
  // Placeholder - would send Telegram messages
  return { success: true, messageIds: [] };
}