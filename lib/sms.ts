// lib/sms.ts

interface SMSResponse {
  success: boolean;
  message: string;
  data?: any;
  error?: string;
}

class IprogSMS {
  private apiToken: string;
  private apiUrl: string;
  private smsProvider: number;

  constructor() {
    this.apiToken = process.env.IPROG_SMS_API_KEY || "";
    this.apiUrl =
      process.env.IPROG_SMS_API_URL ||
      "https://sms.iprogtech.com/api/v1/sms_messages";
    this.smsProvider = parseInt(process.env.IPROG_SMS_PROVIDER || "0");

    if (!this.apiToken) {
      console.warn("IPROG_SMS_API_KEY is not set in environment variables");
    }
  }

  private formatPhoneNumber(phoneNumber: string): string | null {
    let cleanNumber = phoneNumber.replace(/\D/g, "");

    // Already correct: 639XXXXXXXXX (12 digits) → return as-is
    if (cleanNumber.startsWith("63") && cleanNumber.length === 12) {
      return cleanNumber;
    }

    // Convert 09XXXXXXXXX → 639XXXXXXXXX
    if (cleanNumber.startsWith("0") && cleanNumber.length === 11) {
      cleanNumber = "63" + cleanNumber.substring(1);
    }

    // Convert 9XXXXXXXXX → 639XXXXXXXXX
    if (cleanNumber.length === 10 && cleanNumber.startsWith("9")) {
      cleanNumber = "63" + cleanNumber;
    }

    // Validate Philippine mobile number (639XXXXXXXXX)
    if (!/^639\d{9}$/.test(cleanNumber)) {
      return null;
    }

    return cleanNumber;
  }

  async sendSMS(phoneNumber: string, message: string): Promise<SMSResponse> {
    try {
      if (!this.apiToken) {
        return {
          success: false,
          error: "IPROG_SMS_API_KEY is not configured",
          message: "",
        };
      }

      const cleanNumber = this.formatPhoneNumber(phoneNumber);

      if (!cleanNumber) {
        return {
          success: false,
          error: `Invalid Philippine mobile number format: ${phoneNumber}`,
          message: "",
        };
      }

      console.log(
        `📱 Sending SMS to ${cleanNumber}: ${message.substring(0, 50)}...`,
      );

      const response = await fetch(this.apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          api_token: this.apiToken,
          phone_number: cleanNumber, // 639XXXXXXXXX format ✅
          message: message,
          sms_provider: this.smsProvider, // 0 = default, 1, or 2
        }),
      });

      let data: any = {};
      try {
        data = await response.json();
      } catch {
        data = { message: await response.text() };
      }

      console.log(`📨 iProg SMS Response [${response.status}]:`, data);

      // Check both HTTP status and inner data.status
      // iProg returns HTTP 200 but with status: 500 inside on errors
      if (response.ok && data.status !== 500) {
        return {
          success: true,
          message: "SMS sent successfully",
          data,
        };
      } else {
        return {
          success: false,
          error: Array.isArray(data.message)
            ? data.message[0]
            : data.message ||
              data.error ||
              data.errors ||
              `HTTP ${response.status}: Failed to send SMS`,
          message: "",
          data,
        };
      }
    } catch (error) {
      console.error("❌ Error sending SMS:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to send SMS",
        message: "",
      };
    }
  }

  async sendBulkSMS(
    phoneNumbers: string[],
    message: string,
  ): Promise<SMSResponse> {
    try {
      if (!this.apiToken) {
        return {
          success: false,
          error: "IPROG_SMS_API_KEY is not configured",
          message: "",
        };
      }

      if (phoneNumbers.length === 0) {
        return {
          success: false,
          error: "No phone numbers provided",
          message: "",
        };
      }

      console.log(
        `📱 Sending bulk SMS to ${phoneNumbers.length} recipients...`,
      );

      const results = await Promise.allSettled(
        phoneNumbers.map((number) => this.sendSMS(number, message)),
      );

      const successful = results.filter(
        (r) => r.status === "fulfilled" && r.value.success,
      ).length;

      const failed = results.filter(
        (r) =>
          r.status === "rejected" ||
          (r.status === "fulfilled" && !r.value.success),
      ).length;

      const failedDetails = results
        .map((r, i) => ({
          number: phoneNumbers[i],
          result: r,
        }))
        .filter(
          (r) =>
            r.result.status === "rejected" ||
            (r.result.status === "fulfilled" && !r.result.value.success),
        )
        .map((r) => ({
          number: r.number,
          error:
            r.result.status === "rejected"
              ? r.result.reason
              : r.result.status === "fulfilled"
                ? r.result.value.error
                : "Unknown error",
        }));

      if (failedDetails.length > 0) {
        console.warn("⚠️ Failed SMS recipients:", failedDetails);
      }

      console.log(`✅ Bulk SMS complete: ${successful} sent, ${failed} failed`);

      return {
        success: successful > 0,
        message: `SMS sent to ${successful} recipients, failed for ${failed}`,
        data: {
          successful,
          failed,
          total: phoneNumbers.length,
          failedDetails,
        },
      };
    } catch (error) {
      console.error("❌ Error sending bulk SMS:", error);
      return {
        success: false,
        error: "Failed to send bulk SMS",
        message: "",
      };
    }
  }

  // Test the connection with a single SMS
  async testConnection(testPhoneNumber: string): Promise<SMSResponse> {
    console.log("🔧 Testing iProg SMS connection...");
    return this.sendSMS(
      testPhoneNumber,
      "Test message from PDAO PWD Application System. Please ignore.",
    );
  }
}

// Export a singleton instance
export const smsService = new IprogSMS();
