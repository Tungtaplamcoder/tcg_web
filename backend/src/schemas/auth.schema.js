const { z } = require('zod');

const VN_PHONE_REGEX = /^(84|0[3|5|7|8|9])+([0-9]{8})\b/;

const registerSchema = z
  .object({
    // Email is optional: syntax is validated only when a value is provided
    email: z.preprocess(
      (v) => (v === '' || v === null ? undefined : v),
      z.string().trim().email('Invalid email address').optional()
    ),
    password: z.string().min(8, 'Password must be at least 8 characters')
      .regex(/[A-Z]/, 'Password must contain an uppercase letter')
      .regex(/[a-z]/, 'Password must contain a lowercase letter')
      .regex(/[0-9]/, 'Password must contain a number'),
    confirmPassword: z.string().min(1, 'Confirm password is required'),
    fullName: z.string().trim().min(2, 'Full name must be at least 2 characters'),
    phone: z.string().trim().min(1, 'Phone number is required')
      .regex(VN_PHONE_REGEX, 'Invalid phone number format'),
    address: z.string().trim().optional()
  })
  .superRefine((data, ctx) => {
    if (data.password !== data.confirmPassword) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['confirmPassword'],
        message: 'Confirm password does not match'
      });
    }
  });

// Login accepts email OR phone (phone is the primary identifier; email optional on accounts)
const loginSchema = z
  .object({
    email: z.preprocess(
      (v) => (v === '' || v === null ? undefined : v),
      z.string().trim().email('Invalid email address').optional()
    ),
    phone: z.preprocess(
      (v) => (v === '' || v === null ? undefined : v),
      z.string().trim().regex(VN_PHONE_REGEX, 'Invalid phone number format').optional()
    ),
    password: z.string().min(1, 'Password is required')
  })
  .superRefine((data, ctx) => {
    if (!data.email && !data.phone) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['email'],
        message: 'Email or phone is required'
      });
    }
  });

const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required')
});

const updateProfileSchema = z.object({
  fullName: z.string().trim().min(2, 'Full name must be at least 2 characters').optional(),
  phone: z.preprocess(
    (v) => (v === '' || v === null ? undefined : v),
    z.string().trim().regex(VN_PHONE_REGEX, 'Invalid phone number format').optional()
  ),
  address: z.preprocess(
    (v) => (v === '' ? null : v),
    z.string().trim().nullable().optional()
  ),
  avatarUrl: z.string().url().nullable().optional()
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(8).regex(/[A-Z]/).regex(/[a-z]/).regex(/[0-9]/)
});

const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email address')
});

const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Token is required'),
  newPassword: z.string().min(8).regex(/[A-Z]/).regex(/[a-z]/).regex(/[0-9]/)
});

module.exports = {
  registerSchema,
  loginSchema,
  refreshTokenSchema,
  updateProfileSchema,
  changePasswordSchema,
  forgotPasswordSchema,
  resetPasswordSchema
};