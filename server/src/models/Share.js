const mongoose = require('mongoose');

const ShareSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    docId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Document',
      required: true
    },
    title: {
      type: String,
      required: true
    },
    recipient: {
      type: String,
      default: ''
    },
    token: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    views: {
      type: Number,
      default: 0
    },
    maxViews: {
      type: Number,
      default: 5
    },
    allowDownload: {
      type: Boolean,
      default: false
    },
    status: {
      type: String,
      enum: ['active', 'revoked', 'expired'],
      default: 'active'
    },
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
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

module.exports = mongoose.model('Share', ShareSchema);

