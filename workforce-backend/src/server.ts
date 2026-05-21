import dotenv from "dotenv";
dotenv.config();

import http from "http";
import app from "./app";
import { connectDB } from "./config/db";
import { attachScreenMonitorServer } from "./realtime/screenMonitor";

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  await connectDB();

  const server = http.createServer(app);
  attachScreenMonitorServer(server);

  server.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
  });
};

startServer();
