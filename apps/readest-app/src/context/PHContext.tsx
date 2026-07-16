'use client';

import { ReactNode } from 'react';

// Local integration build: telemetry is disabled, so the provider is a
// pass-through wrapper that preserves the tree shape for existing callers.
export const CSPostHogProvider = ({ children }: { children: ReactNode }) => children;
