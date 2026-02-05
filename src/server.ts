import dotenv from 'dotenv';
import connectDB from './config/db';
import app from './app';

// Load environment variables
dotenv.config({ path: process.env.DOTENV_CONFIG_PATH });

// Connect to database and start server
const startServer = async () => {
    try {
        // Connect to database first
        await connectDB();
        
        // Start server after database connection
        const PORT = process.env.PORT || 5000;
        
        app.listen(PORT, () => {
            console.log(`🚀 Server is running on port ${PORT}`);
            console.log(`📦 Environment: ${process.env.NODE_ENV || 'development'}`);
            console.log(`🔗 API Base URL: http://localhost:${PORT}/api`);
        });
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
};

startServer();

export default app;
