require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');

const app = express();
app.use(bodyParser.json());

// MongoDB connection
const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://priyanshusingh00004:110044@cluster0.o86idqy.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';
mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB connection error:', err));

// User Schema
const userSchema = new mongoose.Schema({
  user_str_id: { type: String, unique: true, required: true },
  display_name: { type: String, required: true },
});
const User = mongoose.model('User', userSchema);

// Connection Schema
const connectionSchema = new mongoose.Schema({
  user1: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  user2: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { indexes: [{ unique: true, fields: ['user1', 'user2'] }] });
connectionSchema.index({ user1: 1, user2: 1 }, { unique: true });
const Connection = mongoose.model('Connection', connectionSchema);

// Helper: Sort user IDs lexicographically
function sortUserIds(id1, id2) {
  return id1 < id2 ? [id1, id2] : [id2, id1];
}

// POST /users - Create a new user
app.post('/users', async (req, res) => {
  const { user_str_id, display_name } = req.body;
  if (!user_str_id || !display_name) {
    return res.status(400).json({ error: 'user_str_id and display_name required' });
  }
  try {
    const user = new User({ user_str_id, display_name });
    await user.save();
    return res.json({ internal_db_id: user._id, user_str_id, status: 'created' });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ error: 'user_str_id already exists' });
    }
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /connections - Create a mutual connection
app.post('/connections', async (req, res) => {
  const { user1_str_id, user2_str_id } = req.body;
  if (!user1_str_id || !user2_str_id) {
    return res.status(400).json({ error: 'user1_str_id and user2_str_id required' });
  }
  if (user1_str_id === user2_str_id) {
    return res.status(400).json({ error: 'Cannot connect user to themselves' });
  }
  try {
    const user1 = await User.findOne({ user_str_id: user1_str_id });
    const user2 = await User.findOne({ user_str_id: user2_str_id });
    if (!user1 || !user2) {
      return res.status(404).json({ error: 'One or both users not found' });
    }
    const [id1, id2] = sortUserIds(user1._id.toString(), user2._id.toString());
    const exists = await Connection.findOne({ user1: id1, user2: id2 });
    if (exists) {
      return res.status(409).json({ error: 'Connection already exists' });
    }
    const conn = new Connection({ user1: id1, user2: id2 });
    await conn.save();
    return res.json({ status: 'connection_added' });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /users/:user_str_id/friends - List direct friends
app.get('/users/:user_str_id/friends', async (req, res) => {
  const { user_str_id } = req.params;
  try {
    const user = await User.findOne({ user_str_id });
    if (!user) return res.status(404).json({ error: 'User not found' });
    const connections = await Connection.find({
      $or: [ { user1: user._id }, { user2: user._id } ]
    });
    const friendIds = connections.map(conn =>
      conn.user1.equals(user._id) ? conn.user2 : conn.user1
    );
    const friends = await User.find({ _id: { $in: friendIds } });
    return res.json(friends.map(f => ({ user_str_id: f.user_str_id, display_name: f.display_name })));
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /connections - Remove a connection
app.delete('/connections', async (req, res) => {
  const { user1_str_id, user2_str_id } = req.body;
  if (!user1_str_id || !user2_str_id) {
    return res.status(400).json({ error: 'user1_str_id and user2_str_id required' });
  }
  try {
    const user1 = await User.findOne({ user_str_id: user1_str_id });
    const user2 = await User.findOne({ user_str_id: user2_str_id });
    if (!user1 || !user2) {
      return res.status(404).json({ error: 'One or both users not found' });
    }
    const [id1, id2] = sortUserIds(user1._id.toString(), user2._id.toString());
    const result = await Connection.findOneAndDelete({ user1: id1, user2: id2 });
    if (!result) {
      return res.status(404).json({ error: 'Connection not found' });
    }
    return res.json({ status: 'connection_removed' });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /users/:user_str_id/friends-of-friends - Degree 2 friends
app.get('/users/:user_str_id/friends-of-friends', async (req, res) => {
  const { user_str_id } = req.params;
  try {
    const user = await User.findOne({ user_str_id });
    if (!user) return res.status(404).json({ error: 'User not found' });
    // Get direct friends
    const connections = await Connection.find({ $or: [ { user1: user._id }, { user2: user._id } ] });
    const directFriendIds = connections.map(conn =>
      conn.user1.equals(user._id) ? conn.user2.toString() : conn.user1.toString()
    );
    // Get friends of friends
    const fofConnections = await Connection.find({
      $or: [
        { user1: { $in: directFriendIds } },
        { user2: { $in: directFriendIds } }
      ]
    });
    let fofIds = new Set();
    fofConnections.forEach(conn => {
      if (!conn.user1.equals(user._id) && !directFriendIds.includes(conn.user1.toString())) fofIds.add(conn.user1.toString());
      if (!conn.user2.equals(user._id) && !directFriendIds.includes(conn.user2.toString())) fofIds.add(conn.user2.toString());
    });
    fofIds.delete(user._id.toString());
    directFriendIds.forEach(id => fofIds.delete(id));
    const friendsOfFriends = await User.find({ _id: { $in: Array.from(fofIds) } });
    return res.json(friendsOfFriends.map(f => ({ user_str_id: f.user_str_id, display_name: f.display_name })));
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /connections/degree?from_user_str_id=alice&to_user_str_id=dave
app.get('/connections/degree', async (req, res) => {
  const { from_user_str_id, to_user_str_id } = req.query;
  if (!from_user_str_id || !to_user_str_id) {
    return res.status(400).json({ error: 'from_user_str_id and to_user_str_id required' });
  }
  if (from_user_str_id === to_user_str_id) {
    return res.json({ degree: 0 });
  }
  try {
    const fromUser = await User.findOne({ user_str_id: from_user_str_id });
    const toUser = await User.findOne({ user_str_id: to_user_str_id });
    if (!fromUser || !toUser) {
      return res.status(404).json({ degree: -1, message: 'user_not_found' });
    }
    // BFS
    const visited = new Set();
    let queue = [{ id: fromUser._id.toString(), degree: 0 }];
    visited.add(fromUser._id.toString());
    while (queue.length > 0) {
      const { id, degree } = queue.shift();
      if (id === toUser._id.toString()) {
        return res.json({ degree });
      }
      // Get friends
      const conns = await Connection.find({ $or: [ { user1: id }, { user2: id } ] });
      for (const conn of conns) {
        const friendId = conn.user1.toString() === id ? conn.user2.toString() : conn.user1.toString();
        if (!visited.has(friendId)) {
          visited.add(friendId);
          queue.push({ id: friendId, degree: degree + 1 });
        }
      }
    }
    return res.json({ degree: -1, message: 'not_connected' });
  } catch (err) {
    return res.status(500).json({ error: 'Internal server error' });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
