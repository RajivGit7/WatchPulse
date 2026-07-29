import validator from "validator";

export const validate = (schema) => (req, res, next) => {
  const errors = [];

  for (const [field, rules] of Object.entries(schema)) {
    const value = req.body[field];

    if (rules.required && (value === undefined || value === null || value === "")) {
      errors.push(`${field} is required`);
      continue;
    }

    if (value !== undefined && value !== null && value !== "") {
      if (rules.isEmail && !validator.isEmail(value)) {
        errors.push(`${field} must be a valid email`);
      }
      if (rules.minLength && value.length < rules.minLength) {
        errors.push(`${field} must be at least ${rules.minLength} characters`);
      }
      if (rules.maxLength && value.length > rules.maxLength) {
        errors.push(`${field} must be at most ${rules.maxLength} characters`);
      }
    }
  }

  if (errors.length > 0) {
    return res.status(400).json({ success: false, message: errors.join(", ") });
  }

  next();
};
