'use strict';

const mongoose = require('mongoose');
const ObjectId = require('mongoose').Types.ObjectId;

const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');


mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });

const replySchema = new mongoose.Schema({
  text: String,
  created_on: Date,
  delete_password: String,
  reported: Boolean,
  thread: { type: ObjectId, ref: 'Thread'}
})

const threadSchema = new mongoose.Schema({
  text: String,
  created_on: Date,
  bumped_on: Date,
  reported: Boolean,
  delete_password: String,
  replies: [{ type: ObjectId, ref: 'Reply'}],
  board: String
})

let Reply = mongoose.model('Reply', replySchema);
let Thread = mongoose.model('Thread', threadSchema)

module.exports = function (app) {
  app.use(bodyParser.urlencoded({extended: false}));
  app.use(bodyParser.json());
  
  app.route('/api/threads/:board')
    .get(async (req, res) => {
      const board = req.params.board;

      const threads = await Thread.find({board: board}, {__v: 0, reported: 0, delete_password: 0, board: 0})
          .populate({
            path: 'replies',
            select: '-__v -reported -delete_password -thread',
            options: { sort: {created_on: -1}, limit: 3 }
          })
          .sort({bumped_on: -1})
          .limit(10)
          .exec();

      return res.status(200).send(threads);
      
    })
    .post(async (req, res) => {
      const board = req.params.board;
      const {text, delete_password } = req.body;

      if (!board || !text || !delete_password) {
        return res.status(400).send({ error: 'Missing required fields' });
      }

      const hashed_password = await bcrypt.hash(delete_password, 10);

      const thread = await createAndSaveThread(board, text, hashed_password);

      return res.status(200).send(thread);
    })
    .put(async (req, res) => {
      const board = req.params.board;
      const thread_id = req.body.thread_id;

      if (!board || !thread_id || !ObjectId.isValid(thread_id)) {
        return res.status(400).send({ error: 'Invalid or missing required fields' });
      }

      const thread = await Thread.findOneAndUpdate({board: board, _id: thread_id}, {$set: {reported: true}});

      if (!thread) {
        return res.status(400).send({error: 'No such thread exists on this board'});
      }

      return res.status(200).send('reported');
    })
    .delete(async (req, res) => {
      const board = req.params.board;
      const thread_id = req.body.thread_id;
      const delete_password = req.body.delete_password;

      if (!board || !thread_id || !delete_password || !ObjectId.isValid(thread_id)) {
        return res.status(400).send({ error: 'Invalid or missing required fields' });
      }

      const thread = await Thread.findOne({board: board, _id: thread_id});

      if (!thread) {
        return res.status(400).send({error: 'No such thread exists on this board'});
      }

      const isMatch = await bcrypt.compare(delete_password, thread.delete_password);
      
      if (isMatch) {
        await Thread.findOneAndDelete({ board: board, _id: thread_id });
        return res.status(200).send('success');
      } else {
        return res.send('incorrect password');
      }

    });
    
  app.route('/api/replies/:board')
    .get(async (req, res) => {
      const board = req.params.board;
      const thread_id = req.query.thread_id;

      if (ObjectId.isValid(thread_id)){
        const thread = await Thread.findOne({board: board, _id: thread_id}, {__v: 0, reported: 0, board: 0, delete_password: 0})
          .populate({
            path: 'replies',
            select: '-__v -reported -delete_password -thread',
            options: { sort: {created_on: -1}}
          })
          .exec();
        
          return res.status(200).send(thread);
      } else {
        return res.status(400).send({error: 'invalid thread_id'});
      }
    })
    .post(async (req, res) => {
      const board = req.params.board;
      const thread_id = req.body.thread_id;
      const text = req.body.text;
      const delete_password = req.body.delete_password;

      if (!board || !thread_id || !text || !delete_password || !ObjectId.isValid(thread_id)) {
        return res.status(400).send({ error: 'Invalid or missing required fields' });
      }

      const thread = await Thread.findOne({ board: board, _id: thread_id });

      if (!thread) {
        return res.status(400).send({ error: 'No such thread exists on this board' });
      }

      const hashed_password = await bcrypt.hash(req.body.delete_password, 10);

      const reply = await createAndSaveReply(text, hashed_password, thread_id);

      thread.replies.push(reply._id);
      thread.bumped_on = reply.created_on;
      await thread.save();

      return res.status(200).send(reply);
    })
    .put(async (req, res) => {
      const board = req.params.board;
      const thread_id = req.body.thread_id;
      const reply_id = req.body.reply_id;

      if (!board || !thread_id || !reply_id || !ObjectId.isValid(thread_id) || !ObjectId.isValid(reply_id)) {
        return res.status(400).send({ error: 'Invalid or missing required fields' });
      }

      const thread = await Thread.findOne({board: board, _id: thread_id});

      if (!thread) {
        return res.status(400).send({error: 'No such thread exists in that board'});
      }

      const reply = await Reply.findOneAndUpdate({_id: reply_id, thread: thread_id}, {$set: {reported: true}});

      if (!reply) {
        return res.status(400).send({error: 'No such reply exists in that thread'});
      }

      return res.status(200).send('reported');
    })
    .delete(async (req, res) => {
      const board = req.params.board;
      const thread_id = req.body.thread_id;
      const reply_id = req.body.reply_id;
      const delete_password = req.body.delete_password;

      const thread = await Thread.findOne({board: board, _id: thread_id});
      const reply = await Reply.findOne({_id: reply_id, thread: thread_id});

      if (!thread || !reply) {
        return res.status(400).send({error: 'no such thread or reply exists'});
      }

      const isMatch = await bcrypt.compare(delete_password, reply.delete_password);
      
      if (isMatch) {
        reply.text = '[deleted]';
        await reply.save();
        return res.status(200).send('success');
      } else {
        return res.send('incorrect password');
      }
    });

};

const createAndSaveThread = async (board, text, delete_password) => {
  const currentDate = new Date();
  const thread = new Thread({
    text: text,
    created_on: currentDate,
    bumped_on: currentDate,
    reported: false,
    delete_password: delete_password,
    replies: [],
    board: board
  })

  await thread.save();

  return thread
}

const createAndSaveReply = async (text, delete_password, thread_id) => {
  const reply = new Reply({
    text: text,
    created_on: new Date(),
    delete_password: delete_password,
    reported: false,
    thread: thread_id
  })

  await reply.save();

  return reply;
}
