import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { User, UserRole } from '../models/User.js';
import { AppError } from '../middleware/errorHandler.js';

export const createStaffSchema = z.object({
  body: z.object({
    name: z.string().trim().min(2, 'Name must be at least 2 characters').max(100),
    email: z.string().trim().email('Valid email is required'),
    password: z.string().min(6, 'Password must be at least 6 characters'),
    role: z.enum(['STAFF', 'OWNER']).default('STAFF')
  })
});

export const updateStaffSchema = z.object({
  params: z.object({
    id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid Staff ID format')
  }),
  body: z.object({
    name: z.string().trim().min(2).max(100).optional(),
    role: z.enum(['STAFF', 'OWNER']).optional(),
    isActive: z.boolean().optional(),
    password: z.string().min(6).optional()
  })
});

export const staffController = {
  /**
   * List all staff accounts (Owner only)
   */
  async getStaffList(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const users = await User.find().select('-passwordHash').sort({ createdAt: -1 });
      res.status(200).json({
        success: true,
        data: users
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Create a new staff account (Owner only)
   */
  async createStaff(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { name, email, password, role = 'STAFF' } = req.body;

      const existingUser = await User.findOne({ email: email.toLowerCase() });
      if (existingUser) {
        throw new AppError('An account with this email already exists.', 409);
      }

      const passwordHash = await (User as any).hashPassword(password);

      const newUser = new User({
        name,
        email: email.toLowerCase(),
        passwordHash,
        role: role as UserRole,
        isActive: true
      });

      await newUser.save();

      res.status(201).json({
        success: true,
        message: 'Staff account created successfully',
        data: {
          id: newUser._id,
          name: newUser.name,
          email: newUser.email,
          role: newUser.role,
          isActive: newUser.isActive,
          createdAt: newUser.createdAt
        }
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Update staff account details or status (Owner only)
   */
  async updateStaff(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const { name, role, isActive, password } = req.body;

      const user = await User.findById(id);
      if (!user) {
        throw new AppError('User not found', 404);
      }

      // Prevent deactivating own account
      if (req.user!._id.toString() === id && isActive === false) {
        throw new AppError('You cannot deactivate your own account.', 400);
      }

      if (name !== undefined) user.name = name;
      if (role !== undefined) user.role = role as UserRole;
      if (isActive !== undefined) user.isActive = isActive;
      if (password) {
        user.passwordHash = await (User as any).hashPassword(password);
      }

      await user.save();

      res.status(200).json({
        success: true,
        message: 'Staff account updated successfully',
        data: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          isActive: user.isActive,
          updatedAt: user.updatedAt
        }
      });
    } catch (error) {
      next(error);
    }
  }
};
