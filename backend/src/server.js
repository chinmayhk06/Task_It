const dns = require("dns");
dns.setServers(["8.8.8.8", "8.8.4.4"]);

const dotenv = require("dotenv");
const path = require("path");

dotenv.config({
    path: path.join(__dirname, "../.env"),
});

const app = require("./app");
const connectDB = require("./config/db");
const { startDeadlineNotificationJob } = require("./services/deadlineNotificationService");

const PORT = process.env.PORT || 5000;

const startServer = async () => {
    try {
        await connectDB();
        await require("./services/rbacMigration").assertCurrentRbac(require("mongoose").connection.db);

        app.listen(PORT, () => {
            console.log(`Server running on port ${PORT}`);
        });

        startDeadlineNotificationJob();

    } catch (error) {
        console.error(error);
        process.exit(1);
    }
};

startServer();
