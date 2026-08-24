import type { Request } from 'express';

export interface RequestContext {
  requestId: string;
  startedAt: bigint;
}

export interface RequestWithContext extends Request {
  requestContext?: RequestContext;
}
