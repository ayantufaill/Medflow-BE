import Joi from 'joi';

export const createShortlistValidator = Joi.object({
  patientId: Joi.alternatives().try(Joi.string(), Joi.number()).required().messages({
    'any.required': 'Patient ID is required',
  }),
  providerId: Joi.alternatives().try(Joi.string(), Joi.number()).optional().allow('', null),
  durationMins: Joi.number().integer().min(1).optional().allow(null),
  preferredDay: Joi.string().max(255).optional().allow('', null),
  preferredTime: Joi.string().max(255).optional().allow('', null),
  procedures: Joi.array().items(Joi.string()).optional().allow(null),
  notes: Joi.string().optional().allow('', null),
});
