// lib/email.ts
import nodemailer from "nodemailer";

// Debug: Log all email-related env vars (remove in production)
console.log("📧 Email Configuration Check:");
console.log("EMAIL_USER:", process.env.EMAIL_USER ? "✓ Set" : "✗ MISSING");
console.log(
  "EMAIL_PASSWORD:",
  process.env.EMAIL_PASSWORD ? "✓ Set" : "✗ MISSING",
);
console.log(
  "EMAIL_HOST:",
  process.env.EMAIL_HOST || "✗ MISSING (will use default)",
);
console.log(
  "EMAIL_PORT:",
  process.env.EMAIL_PORT || "✗ MISSING (will use default)",
);
console.log(
  "EMAIL_SECURE:",
  process.env.EMAIL_SECURE || "✗ MISSING (will use false)",
);

// Email configuration with fallbacks
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || "smtp.gmail.com",
  port: Number(process.env.EMAIL_PORT) || 587,
  secure: process.env.EMAIL_SECURE === "true",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
  // Add connection timeout
  connectionTimeout: 10000, // 10 seconds
});

// Verify connection configuration
transporter.verify((error) => {
  if (error) {
    console.error("❌ Email configuration error:", {
      message: error.message,
      name: error.name,
    });

    // Check for specific error patterns
    if (error.message.includes("ECONNREFUSED")) {
      console.error("\n💡 Tips to fix:");
      console.error("1. Check if EMAIL_HOST is set correctly in .env.local");
      console.error(
        "2. Make sure you're using an App Password for Gmail (not your regular password)",
      );
      console.error("3. Restart your Next.js server after changing .env.local");
      console.error("4. Your current .env values:", {
        host: process.env.EMAIL_HOST || "smtp.gmail.com (default)",
        port: process.env.EMAIL_PORT || "587 (default)",
        user: process.env.EMAIL_USER ? "✓ Set" : "✗ Missing",
        pass: process.env.EMAIL_PASSWORD ? "✓ Set" : "✗ Missing",
      });
    } else if (error.message.includes("EAUTH")) {
      console.error("\n🔐 Authentication Error:");
      console.error(
        "1. Make sure you're using a Gmail App Password (16 characters, no spaces)",
      );
      console.error("2. Enable 2-Factor Authentication on your Google account");
      console.error(
        "3. Generate an App Password at: https://myaccount.google.com/apppasswords",
      );
    }
  } else {
    console.log("✅ Email server is ready to send messages");
  }
});

interface EmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  cc?: string | string[];
  bcc?: string | string[];
  attachments?: Array<{
    filename: string;
    content?: string | Buffer;
    path?: string;
    contentType?: string;
  }>;
}

export async function sendEmail(options: EmailOptions) {
  try {
    // Validate required env vars
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
      throw new Error(
        "EMAIL_USER and EMAIL_PASSWORD must be set in .env.local",
      );
    }

    const mailOptions = {
      from: `"PWD Application System" <${process.env.EMAIL_FROM || process.env.EMAIL_USER}>`,
      to: options.to,
      cc: options.cc,
      bcc: options.bcc,
      subject: options.subject,
      html: options.html,
      text: options.text,
      attachments: options.attachments,
    };

    console.log("📧 Attempting to send email to:", options.to);
    const info = await transporter.sendMail(mailOptions);
    console.log("✅ Email sent successfully:", info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error("❌ Error sending email:", error);
    return { success: false, error };
  }
}

// Email templates
export const emailTemplates = {
  applicationSubmitted: (data: {
    name: string;
    applicationId: string;
    applicationType: string;
  }) => ({
    subject: `Application Submitted: PWD ID ${data.applicationType}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">Application Submitted Successfully</h2>
        <p>Dear ${data.name},</p>
        <p>Your PWD ID application has been submitted successfully.</p>
        <div style="background-color: #f3f4f6; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <p><strong>Application ID:</strong> ${data.applicationId}</p>
          <p><strong>Application Type:</strong> ${data.applicationType}</p>
          <p><strong>Status:</strong> Submitted - Pending Review</p>
        </div>
        <p>Your application is now pending review by our team. We will notify you once it has been processed.</p>
        <p>You can track the status of your application by logging into your account.</p>
        <p>Thank you,<br>PWD Application System Team</p>
      </div>
    `,
  }),

  applicationApproved: (data: {
    name: string;
    applicationId: string;
    pwdNumber?: string;
  }) => ({
    subject: "Application Approved: PWD ID Application",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #16a34a;">Application Approved!</h2>
        <p>Dear ${data.name},</p>
        <p>Congratulations! Your PWD ID application has been approved.</p>
        <div style="background-color: #f3f4f6; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <p><strong>Application ID:</strong> ${data.applicationId}</p>
          ${data.pwdNumber ? `<p><strong>PWD Number:</strong> ${data.pwdNumber}</p>` : ""}
          <p><strong>Status:</strong> Approved</p>
        </div>
        <p>You can now claim your PWD ID at your local PWD Affairs Office. Please bring a valid ID for verification.</p>
        <p>Thank you for using our service.</p>
        <p>Best regards,<br>PWD Application System Team</p>
      </div>
    `,
  }),

  applicationRejected: (data: {
    name: string;
    applicationId: string;
    reason: string;
  }) => ({
    subject: "Application Update: PWD ID Application",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #dc2626;">Application Update</h2>
        <p>Dear ${data.name},</p>
        <p>We regret to inform you that your PWD ID application has been reviewed and was not approved at this time.</p>
        <div style="background-color: #f3f4f6; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <p><strong>Application ID:</strong> ${data.applicationId}</p>
          <p><strong>Status:</strong> Rejected</p>
          <p><strong>Reason:</strong> ${data.reason}</p>
        </div>
        <p>If you have any questions or would like to reapply with updated information, please contact your local PWD Affairs Office.</p>
        <p>Thank you for your understanding.</p>
        <p>Best regards,<br>PWD Application System Team</p>
      </div>
    `,
  }),

  applicationUnderReview: (data: { name: string; applicationId: string }) => ({
    subject: "Application Under Review: PWD ID Application",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #d97706;">Application Under Review</h2>
        <p>Dear ${data.name},</p>
        <p>Your PWD ID application is now being reviewed by our team.</p>
        <div style="background-color: #f3f4f6; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <p><strong>Application ID:</strong> ${data.applicationId}</p>
          <p><strong>Status:</strong> Under Review</p>
        </div>
        <p>We will notify you once the review process is complete.</p>
        <p>Thank you for your patience.</p>
        <p>Best regards,<br>PWD Application System Team</p>
      </div>
    `,
  }),

  pwdNumberAssigned: (data: {
    name: string;
    applicationId: string;
    pwdNumber: string;
  }) => ({
    subject: "PWD Number Assigned",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">PWD Number Assigned</h2>
        <p>Dear ${data.name},</p>
        <p>Your PWD number has been generated and assigned to you.</p>
        <div style="background-color: #f3f4f6; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <p><strong>Application ID:</strong> ${data.applicationId}</p>
          <p><strong>PWD Number:</strong> ${data.pwdNumber}</p>
        </div>
        <p>This number will be used as your official PWD identification number.</p>
        <p>You can now use this number for your transactions and benefits.</p>
        <p>Best regards,<br>PWD Application System Team</p>
      </div>
    `,
  }),
};
