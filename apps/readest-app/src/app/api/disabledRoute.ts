import { NextResponse } from 'next/server';

export const localBuildDisabled = (feature: string) =>
  NextResponse.json(
    {
      error: `${feature} is disabled in this local-first build`,
    },
    { status: 410 },
  );

export const createDisabledRoute =
  (feature: string) =>
  async (_request?: Request): Promise<NextResponse> =>
    localBuildDisabled(feature);
