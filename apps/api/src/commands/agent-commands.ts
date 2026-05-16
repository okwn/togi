import { runAgentCycle } from '@togi/security-agent';
import type { SafetyLevel } from '@togi/security-agent';
import { db } from '@togi/db';
import { groupAdmins, agentRuns, recommendations, autonomousAgentPolicies } from '@togi/db/src/schema';
import { eq, and, desc } from 'drizzle-orm';

export function registerAgentCommands(bot: Telegraf) {
  // /togi_analyze - Trigger immediate analysis
  bot.command('togi_analyze', async (ctx) => {
    const chatId = ctx.chat?.id;
    if (!chatId) return;

    // Verify admin
    const admin = await db.query.groupAdmins.findFirst({
      where: and(
        eq(groupAdmins.telegramUserId, BigInt(ctx.from?.id ?? 0)),
        eq(groupAdmins.chatId, BigInt(chatId))
      ),
    });
    if (!admin) {
      return ctx.reply('⛔ Admin verification required.');
    }

    await ctx.reply('🔍 Running security analysis...');

    try {
      const result = await runAgentCycle(
        String(chatId),
        'ADMIN_REQUEST',
        'RECOMMEND_ONLY' as SafetyLevel
      );

      const summary = result.recommended.length > 0
        ? `✅ Analysis complete. Found ${result.recommended.length} recommendations.`
        : `✅ Analysis complete. No actions needed.`;

      await ctx.reply(summary);
    } catch (err) {
      await ctx.reply('❌ Analysis failed. Please try again.');
    }
  });

  // /togi_recommend - Request recommendations summary
  bot.command('togi_recommend', async (ctx) => {
    const chatId = ctx.chat?.id;
    if (!chatId) return;

    const pending = await db.query.recommendations.findMany({
      where: and(
        eq(recommendations.groupId, String(chatId)),
        eq(recommendations.status, 'PENDING')
      ),
      limit: 5,
    });

    if (pending.length === 0) {
      return ctx.reply('📋 No pending recommendations.');
    }

    const lines = pending.map((rec, i) =>
      `${i + 1}. [${rec.type}] ${rec.reason.slice(0, 50)}...`
    ).join('\n');

    await ctx.reply(`📋 Pending Recommendations:\n\n${lines}`);
  });

  // /togi_agent_status - Show agent mode and last run
  bot.command('togi_agent_status', async (ctx) => {
    const chatId = ctx.chat?.id;
    if (!chatId) return;

    const policy = await db.query.autonomousAgentPolicies.findFirst({
      where: eq(autonomousAgentPolicies.groupId, String(chatId)),
    });

    const lastRun = await db.query.agentRuns.findFirst({
      where: eq(agentRuns.groupId, String(chatId)),
      orderBy: [desc(agentRuns.startedAt)],
    });

    const status = policy?.enabled === 'true' ? '🟢 Enabled' : '🔴 Disabled';
    const mode = policy?.mode ?? 'RECOMMEND_ONLY';
    const lastRunTime = lastRun?.startedAt
      ? new Date(lastRun.startedAt).toLocaleString()
      : 'Never';

    await ctx.reply(`🤖 Agent Status\n\n${status}\nMode: ${mode}\nLast Run: ${lastRunTime}`);
  });
}
