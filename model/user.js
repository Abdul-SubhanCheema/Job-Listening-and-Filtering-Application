const mongoose = require('mongoose');

const commentSchema = new mongoose.Schema({
  commenters: {
    type: Number,
  },
  text: String,
  commentid: {
    type: Number,
    default: 1
  },
});
const postSchema = new mongoose.Schema({
  postid: {
    type: Number,
    default: 1
  },
  canshow: {
    type: Boolean,
    default: true
  },
  date: {
    type: Date,
    default: Date.now
  },
  content: String,
  likes: {
    likerid: [{
      type: Number,
    }],
    totalLikes: {
      type: Number,
      default: 0,
    },
  },
  comments: [commentSchema]
});
const userSchema = new mongoose.Schema({
  userid: {
    type: Number,
    default: 1
  },
  name: String,
  password: String,
  email: String,
  canlogin: {
    type: Boolean,
    default: true
  },
  posts: [postSchema],
  followers: [{
    type: Number,
  }],
  following: [{
    type: Number,
  }],
  Notification_followers: [{
    type: String,
  }],
  Notification_comments: [{
    type: String,
  }]
});

const User = mongoose.model('User', userSchema);

module.exports = User;
