const mongoose = require('mongoose');

const AuditSchema = new mongoose.Schema(
  {
    index: {
      type: Number,
      required: true,
      unique: true
    },
    at: {
      type: Date,
      default: Date.now
    },
    action: {
      type: String,
      required: true
    },
    detail: {
      type: String,
      default: ''
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    userName: {
      type: String,
      default: 'System'
    },
    fileHash: {
      type: String,
      default: ''
    },
    prevHash: {
      type: String,
      required: true
    },
    hash: {
      type: String,
      required: true
    },
    ip: {
      type: String,
      default: '127.0.0.1'
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

module.exports = mongoose.model('Audit', AuditSchema);

