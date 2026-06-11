import { param, body } from 'express-validator';

export const idParamValidator = [
  param('id')
    .custom((val) => {
      try {
        BigInt(val);
        return true;
      } catch {
        throw new Error('id must be a valid big integer');
      }
    }),
];

export const createTerminalValidator = [
  body('Type')
    .isIn(['OpenEdge', 'Prosperipay', 'Payrix'])
    .withMessage('Type must be one of: OpenEdge, Prosperipay, Payrix'),
  body('SerialNum')
    .isString()
    .trim()
    .notEmpty()
    .withMessage('SerialNum is required'),
  body('AccountToken')
    .if(body('Type').equals('OpenEdge'))
    .isString()
    .trim()
    .notEmpty()
    .withMessage('AccountToken is required for OpenEdge'),
  body('Name')
    .if(body('Type').equals('Prosperipay'))
    .isString()
    .trim()
    .notEmpty()
    .withMessage('Name is required for Prosperipay'),
  body('TerminalId')
    .if(body('Type').equals('Payrix'))
    .isString()
    .trim()
    .notEmpty()
    .withMessage('TerminalId is required for Payrix'),
];
