import crypto from 'node:crypto';

export const uniqueToken = (prefix: string) =>
  `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
