import { Request, Response, NextFunction } from 'express';
import { validationResult, ValidationChain } from 'express-validator';
import { ApiResponse } from '../models';

export function validate(validations: ValidationChain[]) {
  return async (req: Request, res: Response<ApiResponse>, next: NextFunction): Promise<void> => {
    await Promise.all(validations.map((validation) => validation.run(req)));

    const errors = validationResult(req);
    if (errors.isEmpty()) {
      next();
      return;
    }

    const formattedErrors: Record<string, string[]> = {};
    errors.array().forEach((error) => {
      const field = error.type === 'field' ? error.path : String(error.location);
      if (!formattedErrors[field]) {
        formattedErrors[field] = [];
      }
      formattedErrors[field].push(error.msg);
    });

    res.status(400).json({
      success: false,
      message: 'Dữ liệu không hợp lệ',
      errors: formattedErrors,
    });
  };
}
