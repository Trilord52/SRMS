const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User');

// MongoDB connection with better error handling
const connectDB = async () => {
  try {
    console.log('🔌 Connecting to MongoDB...');
    
    // Remove deprecated options and add better connection handling
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/staff_report_system', {
      serverSelectionTimeoutMS: 5000, // 5 second timeout
      socketTimeoutMS: 45000,
    });
    
    console.log('✅ MongoDB connected successfully!');
    return true;
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error.message);
    console.log('\n🔧 Troubleshooting steps:');
    console.log('1. Make sure MongoDB is installed and running');
    console.log('2. Check if MongoDB service is started');
    console.log('3. Verify the connection string');
    console.log('4. Try running: mongod (to start MongoDB manually)');
    console.log('\n💡 If you don\'t have MongoDB installed:');
    console.log('- Download from: https://www.mongodb.com/try/download/community');
    console.log('- Or use MongoDB Atlas (cloud): https://www.mongodb.com/atlas');
    return false;
  }
};

const seedDummyAccounts = async () => {
  try {
    console.log('🌱 Starting dummy account seeding...');

    // Connect to database
    const connected = await connectDB();
    if (!connected) {
      process.exit(1);
    }

    // Check if dummy accounts already exist
    console.log('🔍 Checking for existing dummy accounts...');
    const existingStaff = await User.findOne({ email: 'staff@bankofabyssinia.com' });
    const existingSupervisor = await User.findOne({ email: 'supervisor@bankofabyssinia.com' });
    const existingManager = await User.findOne({ email: 'manager@bankofabyssinia.com' });

    if (existingStaff && existingSupervisor && existingManager) {
      console.log('✅ Dummy accounts already exist!');
      console.log('\n📋 Dummy Account Credentials:');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('👤 Staff Account:');
      console.log('   Email: staff@bankofabyssinia.com');
      console.log('   Password: staff123');
      console.log('   User ID: STAFF001');
      console.log('');
      console.log('👨‍💼 Supervisor Account:');
      console.log('   Email: supervisor@bankofabyssinia.com');
      console.log('   Password: supervisor123');
      console.log('   User ID: SUP001');
      console.log('');
      console.log('👨‍💻 Manager Account:');
      console.log('   Email: manager@bankofabyssinia.com');
      console.log('   Password: manager123');
      console.log('   User ID: MGR001');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      await mongoose.connection.close();
      process.exit(0);
    }

    console.log('🔐 Hashing passwords...');
    // Hash passwords
    const saltRounds = 10;
    const staffPassword = await bcrypt.hash('staff123', saltRounds);
    const supervisorPassword = await bcrypt.hash('supervisor123', saltRounds);
    const managerPassword = await bcrypt.hash('manager123', saltRounds);

    // Create dummy accounts
    const dummyAccounts = [
      {
        firstName: 'John',
        lastName: 'Doe',
        userId: 'STAFF001',
        email: 'staff@bankofabyssinia.com',
        password: staffPassword,
        role: 'staff',
        department: 'IT Department',
        phoneNumber: '+251911234567',
        isApproved: true,
        approvalStatus: 'approved',
        approvedAt: new Date(),
        approvedBy: null // Self-approved for dummy accounts
      },
      {
        firstName: 'Sarah',
        lastName: 'Johnson',
        userId: 'SUP001',
        email: 'supervisor@bankofabyssinia.com',
        password: supervisorPassword,
        role: 'supervisor',
        department: 'IT Operations',
        phoneNumber: '+251922345678',
        isApproved: true,
        approvalStatus: 'approved',
        approvedAt: new Date(),
        approvedBy: null
      },
      {
        firstName: 'Michael',
        lastName: 'Smith',
        userId: 'MGR001',
        email: 'manager@bankofabyssinia.com',
        password: managerPassword,
        role: 'manager',
        department: 'IT Management',
        phoneNumber: '+251933456789',
        isApproved: true,
        approvalStatus: 'approved',
        approvedAt: new Date(),
        approvedBy: null
      }
    ];

    console.log('📝 Creating dummy accounts...');
    // Insert accounts
    for (const account of dummyAccounts) {
      const existingUser = await User.findOne({ email: account.email });
      if (!existingUser) {
        await User.create(account);
        console.log(`✅ Created ${account.role} account: ${account.email}`);
      } else {
        console.log(`⚠️  ${account.role} account already exists: ${account.email}`);
      }
    }

    console.log('\n🎉 Dummy accounts seeded successfully!');
    console.log('\n📋 Dummy Account Credentials:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('👤 Staff Account:');
    console.log('   Email: staff@bankofabyssinia.com');
    console.log('   Password: staff123');
    console.log('   User ID: STAFF001');
    console.log('   Role: Staff (Can create reports, view own reports)');
    console.log('');
    console.log('👨‍💼 Supervisor Account:');
    console.log('   Email: supervisor@bankofabyssinia.com');
    console.log('   Password: supervisor123');
    console.log('   User ID: SUP001');
    console.log('   Role: Supervisor (Can review reports, create reports)');
    console.log('');
    console.log('👨‍💻 Manager Account:');
    console.log('   Email: manager@bankofabyssinia.com');
    console.log('   Password: manager123');
    console.log('   User ID: MGR001');
    console.log('   Role: Manager (Full system access, approve registrations)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('\n💡 You can now test the system with these accounts!');
    console.log('   Each role has different permissions and access levels.');

  } catch (error) {
    console.error('❌ Error seeding dummy accounts:', error.message);
    console.log('\n🔧 Possible solutions:');
    console.log('1. Check if MongoDB is running');
    console.log('2. Verify database connection string');
    console.log('3. Check if the database exists');
    console.log('4. Ensure you have proper permissions');
  } finally {
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
      console.log('🔌 Database connection closed.');
    }
    process.exit(0);
  }
};

// Run the seeding function
seedDummyAccounts();
