import { body } from 'express-validator';

const req = {
  body: {
    assignmentAndRelease: null
  }
};

const run = async () => {
  const validations = [
    body('assignmentAndRelease').optional().isObject().withMessage('must be an object')
  ];

  for (let validation of validations) {
    const result = await validation.run(req);
    if (result.errors.length) console.error(result.errors);
  }
  console.log('done');
};
run();
