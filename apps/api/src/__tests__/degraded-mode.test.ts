import { shouldWebhookProcessDestructively, shouldAllowMutation, setRedisAvailable } from '../services/degraded-mode';
import { getEnv } from '@togi/config';

describe('Degraded mode', () => {
  describe('shouldWebhookProcessDestructively', () => {
    it('should return true when Redis is available', async () => {
      setRedisAvailable(true);
      expect(shouldWebhookProcessDestructively()).toBe(true);
    });

    it('should respect fail_open when Redis is unavailable', () => {
      setRedisAvailable(false);
      const env = getEnv();
      // fail_open mode should allow processing
      if (env.REDIS_DEGRADED_MODE === 'fail_open') {
        expect(shouldWebhookProcessDestructively()).toBe(true);
      }
    });

    it('should block destructive actions when fail_closed and Redis unavailable', () => {
      setRedisAvailable(false);
      const env = getEnv();
      // fail_closed mode should block processing
      if (env.REDIS_DEGRADED_MODE === 'fail_closed') {
        expect(shouldWebhookProcessDestructively()).toBe(false);
      }
    });
  });

  describe('shouldAllowMutation', () => {
    it('should return true when Redis is available', () => {
      setRedisAvailable(true);
      expect(shouldAllowMutation()).toBe(true);
    });
  });

  describe('Redis health check', () => {
    it('should have health check function', async () => {
      const { checkRedisHealth } = await import('../services/degraded-mode');
      expect(typeof checkRedisHealth).toBe('function');
    });
  });
});