const mongoose = require('mongoose');

console.log('🔍 Checking MongoDB connection...');

const checkMongoDB = async () => {
  try {
    console.log('🔌 Attempting to connect to MongoDB...');
    
    await mongoose.connect('mongodb://localhost:27017/staff_report_system', {
      serverSelectionTimeoutMS: 3000, // 3 second timeout
    });
    
    console.log('✅ MongoDB is running and accessible!');
    console.log('📍 Connection: mongodb://localhost:27017/staff_report_system');
    
    // Test database operations
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log(`📊 Database contains ${collections.length} collections`);
    
    await mongoose.connection.close();
    console.log('🔌 Connection closed successfully.');
    
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error.message);
    console.log('\n🔧 MongoDB is not running. Here are your options:');
    console.log('\n📥 Option 1: Install MongoDB Community Edition');
    console.log('1. Download from: https://www.mongodb.com/try/download/community');
    console.log('2. Install and start the MongoDB service');
    console.log('3. Run: mongod (to start manually)');
    
    console.log('\n☁️ Option 2: Use MongoDB Atlas (Cloud - Free)');
    console.log('1. Go to: https://www.mongodb.com/atlas');
    console.log('2. Create a free account');
    console.log('3. Create a cluster');
    console.log('4. Get your connection string');
    console.log('5. Update your .env file with MONGODB_URI');
    
    console.log('\n🔧 Option 3: Check if MongoDB service is running');
    console.log('Windows:');
    console.log('  - Open Services (services.msc)');
    console.log('  - Look for "MongoDB" service');
    console.log('  - Start it if it\'s stopped');
    console.log('\nMac/Linux:');
    console.log('  - Run: sudo systemctl start mongod');
    console.log('  - Or: brew services start mongodb-community');
    
    console.log('\n💡 Quick fix for Windows:');
    console.log('1. Open Command Prompt as Administrator');
    console.log('2. Run: net start MongoDB');
    console.log('3. If that doesn\'t work, try: mongod');
    
    console.log('\n📝 To use MongoDB Atlas instead:');
    console.log('1. Create a .env file in the backend folder');
    console.log('2. Add: MONGODB_URI=your_atlas_connection_string');
    console.log('3. Replace "your_atlas_connection_string" with your actual connection string');
  }
};

checkMongoDB();
