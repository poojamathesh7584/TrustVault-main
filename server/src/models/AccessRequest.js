const mongoose = require('mongoose');

const AccessRequestSchema = new mongoose.Schema(
  {
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: false,
      index: true
    },
    targetEmail: {
      type: String,
      trim: true,
      lowercase: true,
      index: true
    },
    targetRoll: {
      type: String,
      trim: true,
      uppercase: true,
      index: true
    },
    facultyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    types: {
      type: [String],
      default: ['aadhaar', 'pan', 'tenth', 'degree']
    },
    granted: {
      type: [String],
      default: []
    },
    reason: {
      type: String,
      required: true,
      trim: true
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'denied', 'revoked', 'expired'],
      default: 'pending'
    },
    requestedAt: {
      type: Date,
      default: Date.now
    },
    respondedAt: {
      type: Date,
      default: null
    },
    expiresAt: {
      type: Date,
      default: null
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

module.exports = mongoose.model('AccessRequest', AccessRequestSchema);

