# Socket.io Server - Sham Cash

This is a standalone Socket.io server for real-time presence tracking.

## Setup

### 1. Install dependencies
```bash
cd server
npm install
```

### 2. Run locally
```bash
npm start
```

Server will run on port 3001 by default.

### 3. Deploy to Railway

1. Create a new Railway project
2. Connect your GitHub repository
3. Set the root directory to `/server`
4. Railway will automatically detect Node.js and deploy

### 4. Get the Server URL

After deployment, get your server URL (e.g., `https://shamcash-socket.up.railway.app`)

### 5. Update Frontend

Add the URL to your frontend `.env` file:
```
VITE_SOCKET_URL=https://your-socket-server.up.railway.app
```

## API Endpoints

- `GET /` - Health check, returns server status and online users count

## Socket.io Events

### Client → Server

| Event | Data | Description |
|-------|------|-------------|
| `user_online` | `{ clientId, page }` | User connects to a page |
| `user_page_change` | `{ clientId, page }` | User navigates to another page |
| `user_heartbeat` | `{ clientId }` | Keep connection alive |
| `user_offline` | `{ clientId }` | User disconnects |

### Server → Client

| Event | Data | Description |
|-------|------|-------------|
| `users_update` | `SocketUser[]` | All online users (broadcast to all) |

## SocketUser Type

```typescript
interface SocketUser {
  clientId: string;
  page: string;
  online: boolean;
  lastSeen: string;
}
```
