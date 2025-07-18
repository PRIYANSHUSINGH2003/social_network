# Social Network User Connections API

A Node.js + Express backend for managing users and their mutual connections (friendships) in a social network, using MongoDB for data storage.

## Features
- User creation
- Mutual connection (friendship) management
- List direct friends
- List friends-of-friends (degree 2)
- Degree of separation (BFS)

## Prerequisites
- Node.js (v14+ recommended)
- MongoDB (local or Atlas)
- pnpm (or npm/yarn)

## Setup
1. **Clone the repository**
2. **Install dependencies**
   ```sh
   pnpm install
   # or
   npm install
   ```
3. **Configure environment variables**
   - Create a `.env` file:
     ```
     PORT=5000
     MONGO_URI=mongodb://localhost:27017/social_network
     ```
   - Adjust `MONGO_URI` if using MongoDB Atlas or a different host.
4. **Start MongoDB** (if running locally)
   ```sh
   mongod
   ```
5. **Run the server**
   ```sh
   node server.js
   ```

## API Endpoints

### Create User
- **POST /users**
- Body: `{ "user_str_id": "alice", "display_name": "Alice Wonderland" }`
- Response: `{ "internal_db_id": "...", "user_str_id": "alice", "status": "created" }`

### Add Connection (Friendship)
- **POST /connections**
- Body: `{ "user1_str_id": "alice", "user2_str_id": "bob" }`
- Response: `{ "status": "connection_added" }`

### Remove Connection
- **DELETE /connections**
- Body: `{ "user1_str_id": "alice", "user2_str_id": "bob" }`
- Response: `{ "status": "connection_removed" }`

### List Friends
- **GET /users/{user_str_id}/friends**
- Response: `[ { "user_str_id": "bob", "display_name": "Bob The Builder" }, ... ]`

### Friends of Friends
- **GET /users/{user_str_id}/friends-of-friends**
- Response: `[ { "user_str_id": "carol", "display_name": "Carol Danvers" }, ... ]`

### Degree of Separation
- **GET /connections/degree?from_user_str_id=alice&to_user_str_id=dave**
- Response: `{ "degree": N }` or `{ "degree": -1, "message": "not_connected" }`

## Example Usage (curl)
```sh
# Create users
curl -X POST http://localhost:5000/users -H "Content-Type: application/json" -d '{"user_str_id": "alice", "display_name": "Alice Wonderland"}'
curl -X POST http://localhost:5000/users -H "Content-Type: application/json" -d '{"user_str_id": "bob", "display_name": "Bob The Builder"}'

# Add connection
curl -X POST http://localhost:5000/connections -H "Content-Type: application/json" -d '{"user1_str_id": "alice", "user2_str_id": "bob"}'

# List friends
curl http://localhost:5000/users/alice/friends

# Remove connection
curl -X DELETE http://localhost:5000/connections -H "Content-Type: application/json" -d '{"user1_str_id": "alice", "user2_str_id": "bob"}'

# Friends of friends
curl http://localhost:5000/users/alice/friends-of-friends

# Degree of separation
curl "http://localhost:5000/connections/degree?from_user_str_id=alice&to_user_str_id=bob"
```

## License
MIT
