const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true
    },
    password: {
      type: String,
      required: true
    },
    role: {
      type: String,
      enum: ['student', 'verifier', 'admin'],
      default: 'student'
    },
    roll: {
      type: String,
      trim: true,
      default: ''
    },
    batch: {
      type: String,
      default: '2023-2025'
    },
    dept: {
      type: String,
      default: 'Computer Applications'
    },
    phone: {
      type: String,
      default: '+91 98765 43210'
    },
    avatar: {
      type: String,
      default: ''
    },
    hasVaultPin: {
      type: Boolean,
      default: true
    },
    vaultPin: {
      type: String,
      default: ''
    },
    totpSecret: {
      type: String,
      default: ''
    },
    backupCodes: {
      type: [String],
      default: []
    },
    status: {
      type: String,
      enum: ['active', 'inactive', 'suspended'],
      default: 'active'
    }
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (doc, ret) => {
        ret.id = ret._id.toString();
        delete ret.password;
        delete ret.vaultPin;
        delete ret.__v;
        return ret;
      }
    }
  }
);

module.exports = mongoose.model('User', UserSchema);

