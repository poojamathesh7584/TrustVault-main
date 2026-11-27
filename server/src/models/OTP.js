const mongoose = require('mongoose');

const OTPSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true
    },
    code: {
      type: String,
      required: true
    },
    recentCodes: {
      type: [String],
      default: []
    },
    role: {
      type: String,
      default: 'student'
    },
    name: {
      type: String,
      default: ''
    },
    roll: {
      type: String,
      default: ''
    },
    expiresAt: {
      type: Number,
      required: true
    }
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (doc, ret) => {
        ret.id = ret._id.toString();
        delete ret.__v;
        return ret;
      }
    }
  }
);

// TTL index — automatically deletes expired OTPs after 10 minutes past expiry
OTPSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 600 });

module.exports = mongoose.model('OTP', OTPSchema);
