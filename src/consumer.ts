import amqb from 'amqplib';
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
dotenv.config();

const wait = (milliseconds: number) =>
    new Promise((resolve) => setTimeout(resolve, milliseconds));

export const startSendOtpConsumer = async () => {
    let attempt = 0;
    while (true) {
        let connection: amqb.ChannelModel | undefined;
        try {
            connection = await amqb.connect({
                protocol: 'amqp',
                hostname: process.env.Rabbitmq_Host || 'localhost',
                port: 5672,
                username: process.env.Rabbitmq_Username || 'guest',
                password: process.env.Rabbitmq_Password || 'guest',
            });

            const channel = await connection.createChannel();
            const queueName = "send-otp";
            const transporter = nodemailer.createTransport({
                host: "smtp.gmail.com",
                port: 465,
                secure: true,
                auth: {
                    user: process.env.SMTP_USER,
                    pass: process.env.SMTP_PASS,
                },
            });

            connection.on('error', (error) => {
                console.error('RabbitMQ connection error in mail service:', error);
            });

            await channel.assertQueue(queueName, { durable: true });
            await channel.consume(queueName, async (msg) => {
                if (msg) {
                    try {
                        const { to, subject, body } = JSON.parse(msg.content.toString());
                        await transporter.sendMail({
                            from: process.env.SMTP_USER,
                            to,
                            subject,
                            text: body,
                        });
                        console.log(`OTP email sent to ${to}`);
                        channel.ack(msg);
                    } catch (error) {
                        console.error('Error processing OTP email message:', error);
                    }
                }
            });

            attempt = 0;
            console.log("Mail service is listening for OTP emails");

            const activeConnection = connection;
            await Promise.race([
                new Promise<void>((resolve) => activeConnection.once('close', resolve)),
                new Promise<void>((resolve) => channel.once('close', resolve)),
            ]);
            console.warn('RabbitMQ connection closed in mail service. Reconnecting...');
        } catch (error) {
            console.error('Error in OTP consumer:', error);
        } finally {
            await connection?.close().catch(() => undefined);
        }

        attempt += 1;
        const retryDelay = Math.min(1000 * 2 ** Math.min(attempt - 1, 4), 15000);
        console.log(`Retrying OTP consumer in ${retryDelay}ms`);
        await wait(retryDelay);
    }
};
