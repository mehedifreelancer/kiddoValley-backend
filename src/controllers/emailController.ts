import { Request, Response } from "express";
import nodemailer from "nodemailer";

export const sendOrderEmail = async (req: Request, res: Response) => {
  try {
    const { to, subject, html, text } = req.body;

    if (!to || !subject || !html) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Create transporter (using Gmail as example)
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || "smtp.gmail.com",
      port: parseInt(process.env.SMTP_PORT || "587"),
      secure: false, // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    const mailOptions = {
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to,
      subject,
      html,
      text: text || html.replace(/<[^>]*>/g, ""), // fallback plain text
    };

    await transporter.sendMail(mailOptions);

    res.json({ success: true, message: "Email sent successfully" });
  } catch (error: any) {
    console.error("Email send error:", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
};