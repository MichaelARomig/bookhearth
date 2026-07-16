import { describe, it, expect } from 'vitest';

import { POST } from '@/app/api/stripe/check/route';

const postReq = (sessionId: string) =>
  new Request('https://web.readest.com/api/stripe/check', {
    method: 'POST',
    headers: { authorization: 'Bearer caller', 'content-type': 'application/json' },
    body: JSON.stringify({ sessionId }),
  });

describe('POST /api/stripe/check', () => {
  it('returns 410 in the local-first build without touching Stripe state', async () => {
    const res = await POST(postReq('cs_live_anything'));
    expect(res.status).toBe(410);
    await expect(res.json()).resolves.toEqual({
      error: 'Stripe checkout validation is disabled in this local-first build',
    });
  });
});
