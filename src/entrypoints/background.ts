import { defineBackground } from 'wxt/utils/define-background';
import { z } from 'zod';

// Zod v4 must never attempt `new Function` (SHELL-5): force the interpreted parser path.
z.config({ jitless: true });

// Skeleton. The router and the alarm reconciliation arrive in tasks 0.22 and 0.23.
export default defineBackground(() => {});
