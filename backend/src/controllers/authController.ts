import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { User } from '../models/User.js';
import { generateToken } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';
import { ENV } from '../config/env.js';

export const loginSchema = z.object({
  body: z.object({
    email: z.string().trim().email('Valid email is required'),
    password: z.string().min(1, 'Password is required')
  })
});

const getCookieOptions = () => ({
  httpOnly: true,
  secure: ENV.NODE_ENV === 'production',
  sameSite: (ENV.NODE_ENV === 'production' ? 'none' : 'lax') as 'none' | 'lax',
  maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
});

export const authController = {
  async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, password } = req.body;

      // Find user and explicitly select passwordHash
      const user = await User.findOne({ email: email.toLowerCase() }).select('+passwordHash');
      if (!user) {
        throw new AppError('Invalid email or password', 401);
      }

      if (!user.isActive) {
        throw new AppError('Account is deactivated. Please contact the shop owner.', 403);
      }

      const isMatch = await user.comparePassword(password);
      if (!isMatch) {
        throw new AppError('Invalid email or password', 401);
      }

      const token = generateToken(user);

      // Set cookie
      res.cookie('token', token, getCookieOptions());

      res.status(200).json({
        success: true,
        message: 'Login successful',
        data: {
          token,
          user: {
            id: user._id,
            name: user.name,
            email: user.email,
            role: user.role
          }
        }
      });
    } catch (error) {
      next(error);
    }
  },

  async logout(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      res.clearCookie('token', getCookieOptions());
      res.status(200).json({
        success: true,
        message: 'Logged out successfully'
      });
    } catch (error) {
      next(error);
    }
  },

  async getMe(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AppError('Not authenticated', 401);
      }

      res.status(200).json({
        success: true,
        data: {
          user: {
            id: req.user._id,
            name: req.user.name,
            email: req.user.email,
            role: req.user.role,
            createdAt: req.user.createdAt
          }
        }
      });
    } catch (error) {
      next(error);
    }
  }
};
