const nodemailer = require("nodemailer");

function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

async function sendOTP(email, otp, username) {
  const border = "==================================================";
  const content = `* OTP: ${otp} | USERNAME: ${username} | EMAIL: ${email} *`;
  
  console.log("\n" + "\x1b[33m" + border);
  console.log(`*               MÃ OTP SNEAKERHUB                *`);
  console.log(border);
  console.log(`*  ${content.padEnd(border.length - 6)}  *`);
  console.log(border + "\x1b[0m\n");

  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;

  if (smtpUser && smtpPass) {
    try {
      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: smtpUser,
          pass: smtpPass
        }
      });

      const mailOptions = {
        from: `"SneakerHub Support" <${smtpUser}>`,
        to: email,
        subject: `[SneakerHub] Xác thực tài khoản của bạn - Mã OTP: ${otp}`,
        html: `
          <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 500px; margin: 0 auto; padding: 25px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
            <div style="text-align: center; margin-bottom: 20px;">
              <span style="font-size: 30px;">👟</span>
              <h2 style="color: #166534; margin: 10px 0 0 0; font-size: 22px; font-weight: 800; letter-spacing: -0.5px;">SneakerHub</h2>
            </div>
            <div style="border-top: 3px solid #166534; padding-top: 20px;">
              <p style="font-size: 15px; color: #334155; line-height: 1.6;">Chào <strong>${username}</strong>,</p>
              <p style="font-size: 15px; color: #334155; line-height: 1.6;">Cảm ơn bạn đã đăng ký tài khoản tại <strong>SneakerHub</strong>. Mã xác minh OTP của bạn là:</p>
              <div style="text-align: center; margin: 25px 0;">
                <span style="font-size: 28px; font-weight: 800; background-color: #f0fdf4; color: #166534; padding: 12px 24px; border-radius: 8px; border: 1.5px dashed #bbf7d0; letter-spacing: 6px; display: inline-block;">
                  ${otp}
                </span>
              </div>
              <p style="font-size: 13px; color: #64748b; line-height: 1.5;">Mã xác minh này có hiệu lực trong vòng <strong>5 phút</strong>. Vui lòng không tiết lộ mã này cho bất kỳ ai khác.</p>
            </div>
            <div style="margin-top: 25px; border-top: 1px solid #e2e8f0; padding-top: 15px; text-align: center; font-size: 11px; color: #94a3b8;">
              <p>Nếu bạn không thực hiện yêu cầu này, bạn có thể bỏ qua email này.</p>
              <p>© ${new Date().getFullYear()} SneakerHub. Mọi quyền được bảo lưu.</p>
            </div>
          </div>
        `
      };

      await transporter.sendMail(mailOptions);
      console.log(`[SMTP] Mã OTP đã được gửi thành công đến email: ${email}`);
    } catch (error) {
      console.error("[SMTP Error] Không thể gửi email qua SMTP:", error.message);
      console.log("[Fallback] Mã OTP được hiển thị tại server console ở trên.");
    }
  } else {
    console.log("[Info] Chưa cấu hình SMTP_USER và SMTP_PASS trong file .env. Gửi OTP qua server console.");
  }
}

module.exports = { generateOTP, sendOTP };
