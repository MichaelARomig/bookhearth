import { describe, it, expect } from 'vitest';

import { POST } from '@/app/api/stripe/webhook/route';

const makeReq = () =>
  new Request('https://web.readest.com/api/stripe/webhook', {
    method: 'POST',
    headers: { 'stripe-signature': 'sig', 'content-type': 'application/json' },
    body: '{}',
  }) as unknown as Parameters<typeof POST>[0];

describe('POST /api/stripe/webhook', () => {
  it('returns 410 in the local-first build without processing Stripe events', async () => {
    const res = await POST(makeReq());
    expect(res.status).toBe(410);
    await expect(res.json()).resolves.toEqual({
      error: 'Stripe webhooks is disabled in this local-first build',
    });
  });
});
