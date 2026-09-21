# Common của Mail

Luồng HTTP: `main.ts` khởi động `AppModule` → kiểm tra biến môi trường → `CoreModule` đăng ký middleware, logger và exception filter → `RequestIdMiddleware` gắn `x-request-id` → health controller → service. Khi có lỗi HTTP, `GlobalExceptionFilter` giữ định dạng phản hồi và ghi log kèm request ID. Mail hiện không có HTTP guard.

| Thư mục trong `src/common` | Trách nhiệm |
| --- | --- |
| `config/` | Kiểm tra và chuẩn hóa cấu hình SMTP, RabbitMQ, port khi khởi động. |
| `filters/` | Chuyển exception thành HTTP response và ghi log. |
| `interfaces/` | Kiểu dữ liệu request context. |
| `logging/` | Một file `logger.ts` tạo logger và flush log khi ứng dụng dừng. |
| `middleware/` | Nhận hoặc tạo request ID trước khi xử lý route. |
| `utils/` | Chuẩn hóa lỗi. |

Luồng gửi mail: RabbitMQ → `OtpMailConsumer` → kiểm tra message DTO → `MailSenderService` → SMTP. Luồng này không đi qua HTTP middleware hoặc filter; retry và dead-letter queue do `modules/rabbitmq` xử lý. Giữ các phần này để message lỗi được xử lý đúng.

Nghiệp vụ gửi mail nằm ở `modules/mail`. Logger dùng `@nrapp/observability` trong repo Logger để xuất log và nối log theo request ID. Test đặt cạnh file được kiểm tra; chỉ tạo thư mục khi service thực sự cần.
