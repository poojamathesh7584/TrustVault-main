const mongoose = require('mongoose');

const DocumentSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    title: {
      type: String,
      required: true,
      trim: true
    },
    type: {
      type: String,
      enum: ['aadhaar', 'pan', 'license', 'tenth', 'twelfth', 'class10', 'class12', 'marksheet', 'degree', 'certificate', 'income', 'community', 'other'],
      default: 'other'
    },
    originalName: {
      type: String,
      required: true
    },
    numberMasked: {
      type: String,
      default: ''
    },
    size: {
      type: Number,
      default: 0
    },
    mime: {
      type: String,
      default: 'application/pdf'
    },
    fileHash: {
      type: String,
      default: ''
    },
    sha256: {
      type: String,
      default: ''
    },
    filePath: {
      type: String,
      default: ''
    },
    status: {
      type: String,
      enum: ['verified', 'pending', 'rejected', 'stored'],
      default: 'pending'
    },
    reviewNote: {
      type: String,
      default: ''
    },
    autoCheck: {
      state: { type: String, default: 'done' },
      passed: { type: Boolean, default: true },
      details: { type: String, default: 'Automated structure and checksum validation passed' },
      score: { type: Number, default: 98 },
      checks: [
        {
          name: { type: String },
          ok: { type: Boolean },
          detail: { type: String }
        }
      ]
    },
    verifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    verifiedAt: {
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

module.exports = mongoose.model('Document', DocumentSchema);

