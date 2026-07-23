import amqb from 'amqplib';
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
dotenv.config();

export const startSendOtpConsumer = async () => {
    try {
        const connection = await amqb.connect({
            protocol: 'amqp',
            hostname: 'localhost',
            port: 5672,
            username: 'guest',
            password: 'guest',
        });

        const channel = await connection.createChannel();
        const queueName = "send-otp"
        await channel.assertQueue(queueName, { durable: true });
        console.log("mail service consumer , listening for otp emails");
        
        channel.consume(queueName, async (msg) => {
            if (msg) {
                try{
                    const {to , subject , body } = JSON.parse(msg.content.toString()); 
                    const transporter = nodemailer.createTransport({
                        host: "smtp.gmail.com",
                        port: 465,
                        auth: {
                            user: process.env.SMTP_USER,
                            pass: process.env.SMTP_PASS,
                        },
                    });
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

    } catch (error) {
        console.error('Error in OTP consumer:', error);
    }
}