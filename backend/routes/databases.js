const express = require('express');
const router = express.Router();
const Database = require('../models/Database');
const Report = require('../models/Report');
const authenticate = require('../middleware/auth');

// Get all databases
router.get('/', authenticate, async (req, res) => {
  try {
    const databases = await Database.find().populate('createdBy', 'firstName lastName');
    res.json(databases);
  } catch (error) {
    console.error('Get databases error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all databases including inactive (manager only)
router.get('/all', authenticate, async (req, res) => {
  try {
    if (req.user.role !== 'manager') {
      return res.status(403).json({ message: 'Access denied. Manager role required.' });
    }

    const databases = await Database.find().populate('createdBy', 'firstName lastName');
    res.json(databases);
  } catch (error) {
    console.error('Get all databases error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Create new database (manager only)
router.post('/', authenticate, async (req, res) => {
  if (req.user.role !== 'manager') return res.status(403).send('Forbidden');
  
  try {
    const { database, databaseType, ipAddress, dbVersion, osVersion, customFeatures } = req.body;
    const newDatabase = new Database({
      database,
      databaseType,
      ipAddress,
      dbVersion,
      osVersion,
      customFeatures: customFeatures || [],
      createdBy: req.user._id,
    });
    await newDatabase.save();
    res.status(201).json(newDatabase);
  } catch (error) {
    console.error('Create database error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update database (manager only)
router.put('/:id', authenticate, async (req, res) => {
  if (req.user.role !== 'manager') return res.status(403).send('Forbidden');
  
  try {
    const { database, databaseType, ipAddress, dbVersion, osVersion, customFeatures, isActive } = req.body;
    const databaseId = req.params.id;

    const existingDatabase = await Database.findById(databaseId);
    if (!existingDatabase) {
      return res.status(404).json({ message: 'Database not found' });
    }

    // Update database fields
    existingDatabase.database = database || existingDatabase.database;
    existingDatabase.databaseType = databaseType || existingDatabase.databaseType;
    existingDatabase.ipAddress = ipAddress || existingDatabase.ipAddress;
    existingDatabase.dbVersion = dbVersion || existingDatabase.dbVersion;
    existingDatabase.osVersion = osVersion || existingDatabase.osVersion;
    existingDatabase.customFeatures = customFeatures || existingDatabase.customFeatures;
    existingDatabase.isActive = isActive !== undefined ? isActive : existingDatabase.isActive;

    await existingDatabase.save();
    res.json(existingDatabase);
  } catch (error) {
    console.error('Update database error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Deactivate database (manager only) - soft delete
router.delete('/:id', authenticate, async (req, res) => {
  if (req.user.role !== 'manager') return res.status(403).send('Forbidden');
  
  try {
    const database = await Database.findById(req.params.id);
    if (!database) {
      return res.status(404).json({ message: 'Database not found' });
    }

    // Soft delete - just deactivate
    database.isActive = false;
    await database.save();
    
    res.json({ message: 'Database deactivated successfully' });
  } catch (error) {
    console.error('Deactivate database error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Reactivate database (manager only)
router.put('/:id/reactivate', authenticate, async (req, res) => {
  if (req.user.role !== 'manager') return res.status(403).send('Forbidden');
  
  try {
    const database = await Database.findById(req.params.id);
    if (!database) {
      return res.status(404).json({ message: 'Database not found' });
    }

    database.isActive = true;
    await database.save();
    
    res.json({ message: 'Database reactivated successfully' });
  } catch (error) {
    console.error('Reactivate database error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Bulk deactivate databases (manager only)
router.delete('/bulk-delete', authenticate, async (req, res) => {
  if (req.user.role !== 'manager') return res.status(403).send('Forbidden');
  
  try {
    const { databaseIds } = req.body;
    
    if (!databaseIds || !Array.isArray(databaseIds) || databaseIds.length === 0) {
      return res.status(400).json({ message: 'Invalid database IDs provided' });
    }

    // Find all databases to be deactivated
    const databases = await Database.find({ _id: { $in: databaseIds } });
    
    if (databases.length === 0) {
      return res.status(404).json({ message: 'No databases found' });
    }

    // Deactivate all databases
    await Database.updateMany(
      { _id: { $in: databaseIds } },
      { isActive: false }
    );
    
    res.json({ 
      message: `${databases.length} database(s) deactivated successfully`,
      deactivatedCount: databases.length
    });
  } catch (error) {
    console.error('Bulk deactivate databases error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get database with custom features
router.get('/:id', authenticate, async (req, res) => {
  try {
    const database = await Database.findById(req.params.id).populate('createdBy', 'firstName lastName');
    if (!database) {
      return res.status(404).json({ message: 'Database not found' });
    }
    res.json(database);
  } catch (error) {
    console.error('Get database error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;