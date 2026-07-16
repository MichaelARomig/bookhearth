import { describe, it, expect } from 'vitest';

import { POST as applePOST } from '@/app/api/apple/notifications/route';
import { POST as googlePOST } from '@/app/api/google/notifications/route';

const jsonReq = (url: string, body: unknown) =>
  new Request(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

describe('POST /api/apple/notifications', () => {
  it('returns 410 in the local-first build', async () => {
    const res = await applePOST(jsonReq('https://web.readest.com/api/apple/notifications', {}));
    expect(res.status).toBe(410);
    await expect(res.json()).resolves.toEqual({
      error: 'App Store notifications is disabled in this local-first build',
    });
  });
});

describe('POST /api/google/notifications', () => {
  it('returns 410 in the local-first build', async () => {
    const res = await googlePOST(
      jsonReq('https://web.readest.com/api/google/notifications?token=secret', {
        message: { data: 'abc' },
      }),
    );
    expect(res.status).toBe(410);
    await expect(res.json()).resolves.toEqual({
      error: 'Google Play notifications is disabled in this local-first build',
    });
  });
});
