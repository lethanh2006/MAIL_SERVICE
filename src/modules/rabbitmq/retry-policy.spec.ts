import { decideRetry, retryCountFrom } from './retry-policy';

describe('RabbitMQ retry policy', () => {
  it('đưa lỗi tạm thời vào hàng đợi retry khi còn lượt', () => {
    expect(decideRetry(1, 3, true)).toEqual({
      destination: 'retry',
      nextRetryCount: 2,
    });
  });

  it('đưa message vào DLQ khi hết lượt retry', () => {
    expect(decideRetry(3, 3, true)).toEqual({
      destination: 'dead-letter',
      nextRetryCount: 4,
    });
  });

  it('không retry lỗi dữ liệu vĩnh viễn', () => {
    expect(decideRetry(0, 3, false).destination).toBe('dead-letter');
  });

  it('đọc retry count an toàn từ header RabbitMQ', () => {
    expect(retryCountFrom({ 'x-retry-count': 2 })).toBe(2);
    expect(retryCountFrom({ 'x-retry-count': '3' })).toBe(3);
    expect(retryCountFrom({ 'x-retry-count': -1 })).toBe(0);
    expect(retryCountFrom(undefined)).toBe(0);
  });
});
