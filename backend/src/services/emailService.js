const nodemailer = require('nodemailer');

class EmailService {
  constructor() {
    this.fromEmail = process.env.SMTP_FROM_EMAIL || 'noreply@brainbrawler.com';
    this.smtpHost = process.env.SMTP_HOST || '10.40.19.34';
    this.smtpPort = process.env.SMTP_PORT || 25;
    this.isConfigured = true; // Enable SMTP with default config
    
    // Configura nodemailer per SMTP semplice
    this.transporter = nodemailer.createTransport({
      host: this.smtpHost,
      port: this.smtpPort,
      secure: false, // No TLS/SSL
      auth: false,   // No authentication
      tls: {
        rejectUnauthorized: false // Accept self-signed certificates
      }
    });
  }

  // Invia email di verifica
  async sendVerificationEmail(email, code, displayName) {
    try {
      if (!this.isConfigured) {
        console.log(`📧 Email verification code for ${email}: ${code}`);
        console.log('SMTP not configured - code logged to console');
        return { success: true, method: 'console' };
      }

      const mailOptions = {
        from: this.fromEmail,
        to: email,
        subject: '🧠 Verify your BrainBrawler account',
        text: `Hi ${displayName}!\n\nYour verification code is: ${code}\n\nThis code will expire in 24 hours.\n\nWelcome to BrainBrawler!`,
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Verify your BrainBrawler account</title>
          </head>
          <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif; background-color: #f8f9fa;">
            <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1);">
              
              <!-- Header -->
              <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 20px; text-align: center;">
                <h1 style="color: white; margin: 0; font-size: 2.5rem; font-weight: 800;">🧠 BrainBrawler</h1>
                <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0; font-size: 1.1rem;">The Ultimate Multiplayer Quiz Experience</p>
              </div>
              
              <!-- Content -->
              <div style="padding: 40px 30px;">
                <h2 style="color: #333; margin: 0 0 20px 0; font-size: 1.8rem;">Hi ${displayName}! 👋</h2>
                <p style="color: #666; font-size: 1.1rem; line-height: 1.6; margin: 0 0 30px 0;">
                  Welcome to BrainBrawler! To complete your registration and start playing, please verify your email address using the code below:
                </p>
                
                <!-- Verification Code -->
                <div style="background: #f8f9fa; border: 2px dashed #667eea; border-radius: 15px; padding: 30px; text-align: center; margin: 30px 0;">
                  <p style="color: #667eea; font-size: 0.9rem; font-weight: 600; margin: 0 0 10px 0; text-transform: uppercase; letter-spacing: 1px;">Your Verification Code</p>
                  <div style="font-size: 2.5rem; font-weight: 800; color: #333; letter-spacing: 8px; font-family: 'Courier New', monospace;">${code}</div>
                </div>
                
                <!-- Instructions -->
                <div style="background: #e8f4fd; border-left: 4px solid #667eea; padding: 20px; border-radius: 8px; margin: 30px 0;">
                  <p style="color: #333; margin: 0; font-size: 0.95rem; line-height: 1.5;">
                    <strong>📱 How to verify:</strong><br>
                    1. Go back to the BrainBrawler verification page<br>
                    2. Enter the 6-digit code above<br>
                    3. Click "Verify Email" to complete registration
                  </p>
                </div>
                
                <p style="color: #999; font-size: 0.9rem; margin: 30px 0 0 0;">
                  ⏰ This code will expire in 24 hours. If you didn't create a BrainBrawler account, you can safely ignore this email.
                </p>
              </div>
              
              <!-- Footer -->
              <div style="background: #f8f9fa; padding: 30px; text-align: center; border-top: 1px solid #e1e5e9;">
                <p style="color: #667eea; font-weight: 600; margin: 0 0 10px 0;">Ready to challenge your brain? 🚀</p>
                <p style="color: #999; font-size: 0.8rem; margin: 0;">
                  BrainBrawler - Multiplayer Quiz Gaming Platform<br>
                  © 2024 BrainBrawler. All rights reserved.
                </p>
              </div>
              
            </div>
          </body>
          </html>
        `
      };

      // Log verification code always
      console.log(`🔐 VERIFICATION CODE for ${email}: ${code}`);
      console.log(`📮 Attempting to send email via SMTP to ${this.smtpHost}:${this.smtpPort}`);
      
      // Prova prima a inviare via SMTP
      try {
        const info = await this.transporter.sendMail(mailOptions);
        console.log(`✅ Verification email sent via SMTP to ${email}`);
        console.log(`📬 SMTP Response:`, info);
        return { success: true, method: 'smtp', messageId: info.messageId };
      } catch (smtpError) {
        console.error(`⚠️  SMTP failed for ${email}:`, {
          error: smtpError.message,
          code: smtpError.code,
          command: smtpError.command,
          host: this.smtpHost,
          port: this.smtpPort
        });
        
        // Fallback to console logging
        console.log(`📧 EMAIL FALLBACK - Verification code for ${email}: ${code}`);
        console.log('SMTP failed - code logged to console');
        
        return { success: true, method: 'console', error: smtpError.message };
      }

    } catch (error) {
      console.error('Email service error:', error);
      
      // Fallback to console logging
      console.log(`📧 EMAIL FALLBACK - Verification code for ${email}: ${code}`);
      console.log('Email service failed - code logged to console');
      
      return { success: true, method: 'console', error: error.message };
    }
  }

  // Invia email di reset password (per future implementazioni)
  async sendPasswordResetEmail(email, resetToken, displayName) {
    try {
      if (!this.isConfigured) {
        console.log(`🔑 Password reset token for ${email}: ${resetToken}`);
        return { success: true, method: 'console' };
      }

      const resetUrl = `${process.env.FRONTEND_URL || 'http://10.40.10.180:3001'}/reset-password?token=${resetToken}`;

      const mailOptions = {
        from: this.fromEmail,
        to: email,
        subject: '🔒 Reset your BrainBrawler password',
        text: `Hi ${displayName}!\n\nSomeone requested a password reset for your account.\n\nClick here to reset: ${resetUrl}\n\nIf you didn't request this, ignore this email.`,
        html: `
          <!-- Password reset email HTML template -->
          <div style="max-width: 600px; margin: 0 auto; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 20px; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 2.5rem;">🧠 BrainBrawler</h1>
            </div>
            <div style="padding: 40px 30px; background: white;">
              <h2>Hi ${displayName}! 👋</h2>
              <p>Someone requested a password reset for your BrainBrawler account.</p>
              <div style="text-align: center; margin: 30px 0;">
                <a href="${resetUrl}" style="background: #667eea; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: 600;">Reset Password</a>
              </div>
              <p><small>If you didn't request this, you can safely ignore this email. The link will expire in 1 hour.</small></p>
            </div>
          </div>
        `
      };

      try {
        await this.transporter.sendMail(mailOptions);
        console.log(`✅ Password reset email sent via SMTP to ${email}`);
        return { success: true, method: 'smtp' };
      } catch (smtpError) {
        console.log(`🔑 EMAIL FALLBACK - Password reset token for ${email}: ${resetToken}`);
        return { success: true, method: 'console', error: smtpError.message };
      }

    } catch (error) {
      console.error('Email service error:', error);
      console.log(`🔑 EMAIL FALLBACK - Password reset token for ${email}: ${resetToken}`);
      return { success: true, method: 'console', error: error.message };
    }
  }

  // Invia email di benvenuto
  async sendWelcomeEmail(email, displayName, accountType = 'FREE') {
    try {
      if (!this.isConfigured) {
        console.log(`🎉 Welcome email for ${email} (${accountType})`);
        return { success: true, method: 'console' };
      }

      const isPremium = accountType === 'PREMIUM' || accountType === 'ADMIN';

      const mailOptions = {
        from: this.fromEmail,
        to: email,
        subject: `🎉 Welcome to BrainBrawler${isPremium ? ' Premium' : ''}!`,
        html: `
          <!-- Welcome email HTML template -->
          <div style="max-width: 600px; margin: 0 auto; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 20px; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 2.5rem;">🧠 BrainBrawler</h1>
              <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0;">Welcome to the community!</p>
            </div>
            <div style="padding: 40px 30px; background: white;">
              <h2>Welcome ${displayName}! 🎉</h2>
              <p>Your email has been verified and your account is ready! Here's what you can do now:</p>
              
              <div style="background: #f8f9fa; padding: 20px; border-radius: 10px; margin: 20px 0;">
                <h3 style="color: #667eea; margin: 0 0 15px 0;">✅ Available Features:</h3>
                <ul style="margin: 0; padding-left: 20px;">
                  <li>Join unlimited quiz games</li>
                  <li>Play across all question categories</li>
                  <li>Track your statistics and achievements</li>
                  ${isPremium ? '<li><strong>Create custom rooms</strong></li><li><strong>Upload custom questions</strong></li><li><strong>Private rooms with friends</strong></li>' : ''}
                </ul>
              </div>
              
              ${!isPremium ? `
              <div style="background: linear-gradient(135deg, #ffc107 0%, #ff8f00 100%); padding: 20px; border-radius: 10px; margin: 20px 0; text-align: center;">
                <h3 style="color: white; margin: 0 0 10px 0;">⭐ Upgrade to Premium</h3>
                <p style="color: white; margin: 0 0 15px 0;">Unlock room creation and custom questions for just $4.99!</p>
                <a href="${process.env.FRONTEND_URL || 'http://10.40.10.180:3001'}/lobby" style="background: white; color: #ff8f00; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600;">Upgrade Now</a>
              </div>
              ` : ''}
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="${process.env.FRONTEND_URL || 'http://10.40.10.180:3001'}/lobby" style="background: #667eea; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: 600;">Start Playing Now! 🚀</a>
              </div>
            </div>
          </div>
        `
      };

      try {
        await this.transporter.sendMail(mailOptions);
        console.log(`✅ Welcome email sent via SMTP to ${email}`);
        return { success: true, method: 'smtp' };
      } catch (smtpError) {
        console.log(`🎉 EMAIL FALLBACK - Welcome email for ${email}`);
        return { success: true, method: 'console', error: smtpError.message };
      }

    } catch (error) {
      console.error('Email service error:', error);
      console.log(`🎉 EMAIL FALLBACK - Welcome email for ${email}`);
      return { success: true, method: 'console', error: error.message };
    }
  }

  // Invia email generica per test
  async sendEmail(to, subject, text, html = null) {
    try {
      if (!this.isConfigured) {
        console.log(`📧 TEST EMAIL - To: ${to}, Subject: ${subject}`);
        console.log(`📧 TEST EMAIL - Text: ${text}`);
        return { success: true, method: 'console' };
      }

      const mailOptions = {
        from: this.fromEmail,
        to: to,
        subject: subject,
        text: text
      };

      if (html) {
        mailOptions.html = html;
      }

      console.log(`📮 TEST EMAIL - Attempting to send via SMTP to ${this.smtpHost}:${this.smtpPort}`);
      console.log(`📮 TEST EMAIL - From: ${this.fromEmail} To: ${to}`);
      console.log(`📮 TEST EMAIL - Subject: ${subject}`);
      
      try {
        const info = await this.transporter.sendMail(mailOptions);
        console.log(`✅ TEST EMAIL - Sent successfully via SMTP`);
        console.log(`📬 TEST EMAIL - SMTP Response:`, info);
        return { 
          success: true, 
          method: 'smtp', 
          messageId: info.messageId,
          response: info.response 
        };
      } catch (smtpError) {
        console.error(`⚠️  TEST EMAIL - SMTP failed:`, {
          error: smtpError.message,
          code: smtpError.code,
          command: smtpError.command,
          host: this.smtpHost,
          port: this.smtpPort,
          responseCode: smtpError.responseCode,
          response: smtpError.response
        });
        
        // Fallback to console logging
        console.log(`📧 TEST EMAIL FALLBACK - To: ${to}, Subject: ${subject}`);
        console.log(`📧 TEST EMAIL FALLBACK - Text: ${text}`);
        console.log('SMTP failed - email logged to console');
        
        return { 
          success: false, 
          method: 'console', 
          error: smtpError.message,
          details: smtpError.response || smtpError.code
        };
      }

    } catch (error) {
      console.error('TEST EMAIL - Service error:', error);
      
      // Fallback to console logging
      console.log(`📧 TEST EMAIL FALLBACK - To: ${to}, Subject: ${subject}`);
      console.log(`📧 TEST EMAIL FALLBACK - Text: ${text}`);
      console.log('Email service failed - email logged to console');
      
      return { 
        success: false, 
        method: 'console', 
        error: error.message,
        details: error.stack
      };
    }
  }

  // Controlla se SMTP è configurato
  checkIfConfigured() {
    return this.isConfigured;
  }

  // Ottieni stato del servizio
  getStatus() {
    return {
      isConfigured: this.isConfigured,
      smtpHost: this.smtpHost,
      smtpPort: this.smtpPort,
      fromEmail: this.fromEmail,
      method: this.isConfigured ? 'SMTP' : 'Console Logging'
    };
  }
}

module.exports = new EmailService(); 