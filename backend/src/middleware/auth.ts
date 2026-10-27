import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { User, IUser, UserRole } from '../models/User.js';
import { ENV } from '../config/env.js';
import { AppError } from './errorHandler.js';

// Extend Express Request interface to include authenticated user
declare global {
  namespace Express {
    interface Request {
      user?: IUser;
    }
  }
}

interface JwtPayload {
  id: string;
  role: UserRole;
}

/**
 * Authentication middleware: verifies JWT from Authorization header or cookie.
 */
export const authenticate = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  let token: string | undefined;

  // 1. Check Authorization Bearer header
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  }
  // 2. Check HTTP-only cookie
  else if (req.cookies && req.cookies.token) {
    token = req.cookies.token;
  }

  if (!token) {
    next(new AppError('Authentication required. No token provided.', 401));
    return;
  }

  try {
    const decoded = jwt.verify(token, ENV.JWT_SECRET) as JwtPayload;

    const user = await User.findById(decoded.id);
    if (!user) {
      next(new AppError('The account associated with this token no longer exists.', 401));
      return;
    }

    if (!user.isActive) {
      next(new AppError('Your account has been deactivated. Please contact the shop owner.', 403));
      return;
    }

    req.user = user;
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Role-based authorization middleware.
 * Verifies that the authenticated user possesses the required role.
 */
export const requireRole = (role: UserRole) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new AppError('Authentication required.', 401));
      return;
    }

    if (req.user.role !== role) {
      next(
        new AppError(
          `Forbidden: Access restricted to ${role}. Current user role is ${req.user.role}.`,
          403
        )
      );
      return;
    }

    next();
  };
};

/**
 * Helper to generate JWT token for a user
 */
export const generateToken = (user: IUser): string => {
  return jwt.sign(
    {
      id: user._id.toString(),
      role: user.role
    },
    ENV.JWT_SECRET,
    {
      expiresIn: ENV.JWT_EXPIRES_IN as any
    }
  );
};
