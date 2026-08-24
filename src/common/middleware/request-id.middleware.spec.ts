import type { NextFunction, Response } from 'express';
import type { RequestWithContext } from '../interfaces/request-context.interface';
import {
  REQUEST_ID_HEADER,
  RequestIdMiddleware,
} from './request-id.middleware';

describe('RequestIdMiddleware', () => {
  const middleware = new RequestIdMiddleware();

  it('giữ request id hợp lệ từ upstream', () => {
    const request = {
      headers: { [REQUEST_ID_HEADER]: 'req-123' },
    } as unknown as RequestWithContext;
    const setHeader = jest.fn();
    const response = { setHeader } as unknown as Response;
    const next = jest.fn() as NextFunction;

    middleware.use(request, response, next);

    expect(request.requestContext?.requestId).toBe('req-123');
    expect(setHeader).toHaveBeenCalledWith(REQUEST_ID_HEADER, 'req-123');
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('sinh UUID khi request id không an toàn', () => {
    const request = {
      headers: { [REQUEST_ID_HEADER]: 'không hợp lệ' },
    } as unknown as RequestWithContext;
    const response = { setHeader: jest.fn() } as unknown as Response;

    middleware.use(request, response, jest.fn());

    expect(request.requestContext?.requestId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });
});
