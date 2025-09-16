const express = require('express');
const router = express.Router();
const Template = require('../models/Template');
const auth = require('../middleware/auth');

// Get all templates (for managers)
router.get('/', auth, async (req, res) => {
  try {
    if (req.user.role !== 'manager') {
      return res.status(403).json({ message: 'Access denied. Manager role required.' });
    }

    const templates = await Template.find({ isActive: true })
      .populate('createdBy', 'firstName lastName email')
      .populate('lastModifiedBy', 'firstName lastName email')
      .sort({ createdAt: -1 });

    res.json(templates);
  } catch (error) {
    console.error('Error fetching templates:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get available templates (for staff and supervisors)
router.get('/available', auth, async (req, res) => {
  try {
    const templates = await Template.find({ isActive: true })
      .select('name description category version fields')
      .sort({ category: 1, name: 1 });

    res.json(templates);
  } catch (error) {
    console.error('Error fetching available templates:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get template schema by ID
router.get('/:id/schema', auth, async (req, res) => {
  try {
    const template = await Template.findById(req.params.id)
      .select('name description category version fields');

    if (!template) {
      return res.status(404).json({ message: 'Template not found' });
    }

    res.json(template);
  } catch (error) {
    console.error('Error fetching template schema:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Create new template (managers only)
router.post('/', auth, async (req, res) => {
  try {
    if (req.user.role !== 'manager') {
      return res.status(403).json({ message: 'Access denied. Manager role required.' });
    }

    const { name, description, category, fields } = req.body;

    // Validate required fields
    if (!name || !description || !category || !fields || !Array.isArray(fields)) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    // Validate fields structure per new rules
    for (const field of fields) {
      if (!field.name) {
        return res.status(400).json({ message: 'Each field must have a name' });
      }
      const isReadOnly = !!field.readOnly;
      if (isReadOnly) {
        if (!field.label) {
          return res.status(400).json({ message: `Read-only field '${field.name}' must include a label` });
        }
        field.type = undefined;
        field.options = undefined;
        field.validators = undefined;
        field.required = false;
      } else {
        if (!field.type) {
          return res.status(400).json({ message: `Editable field '${field.name}' must include a type` });
        }
      }
    }

    const template = new Template({
      name,
      description,
      category,
      fields: fields.map(f => ({
        ...f,
        readOnly: !!f.readOnly
      })),
      createdBy: req.user.id
    });

    await template.save();

    res.status(201).json(template);
  } catch (error) {
    console.error('Error creating template:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update template (managers only)
router.put('/:id', auth, async (req, res) => {
  try {
    if (req.user.role !== 'manager') {
      return res.status(403).json({ message: 'Access denied. Manager role required.' });
    }

    const { name, description, category, fields, isActive } = req.body;

    const template = await Template.findById(req.params.id);
    if (!template) {
      return res.status(404).json({ message: 'Template not found' });
    }

    // Normalize and validate fields if provided
    if (fields) {
      for (const field of fields) {
        if (!field.name) {
          return res.status(400).json({ message: 'Each field must have a name' });
        }
        const isReadOnly = !!field.readOnly;
        if (isReadOnly) {
          if (!field.label) {
            return res.status(400).json({ message: `Read-only field '${field.name}' must include a label` });
          }
          field.type = undefined;
          field.options = undefined;
          field.validators = undefined;
          field.required = false;
        } else {
          if (!field.type) {
            return res.status(400).json({ message: `Editable field '${field.name}' must include a type` });
          }
        }
      }
      template.fields = fields.map(f => ({ ...f, readOnly: !!f.readOnly }));
    }

    if (name) template.name = name;
    if (description) template.description = description;
    if (category) template.category = category;
    if (isActive !== undefined) template.isActive = isActive;
    
    template.lastModifiedBy = req.user.id;
    template.version += 1;

    await template.save();

    res.json(template);
  } catch (error) {
    console.error('Error updating template:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete template (managers only)
router.delete('/:id', auth, async (req, res) => {
  try {
    if (req.user.role !== 'manager') {
      return res.status(403).json({ message: 'Access denied. Manager role required.' });
    }

    const template = await Template.findById(req.params.id);
    if (!template) {
      return res.status(404).json({ message: 'Template not found' });
    }

    // Soft delete by setting isActive to false
    template.isActive = false;
    template.lastModifiedBy = req.user.id;
    await template.save();

    res.json({ message: 'Template deleted successfully' });
  } catch (error) {
    console.error('Error deleting template:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Export templates (managers and supervisors)
router.get('/export', auth, async (req, res) => {
  try {
    if (req.user.role !== 'manager' && req.user.role !== 'supervisor') {
      return res.status(403).json({ message: 'Access denied. Manager or Supervisor role required.' });
    }

    const { format = 'json', ids } = req.query;
    const filter = { isActive: true };
    if (ids) {
      const idList = Array.isArray(ids) ? ids : String(ids).split(',');
      filter._id = { $in: idList };
    }

    const templates = await Template.find(filter).select('name description category version fields createdAt updatedAt');

    if (format === 'csv') {
      const header = 'Name,Category,Version,Fields Count,Created At,Updated At\n';
      const rows = templates.map(t => `"${t.name}","${t.category}","${t.version}","${t.fields?.length || 0}","${new Date(t.createdAt).toISOString()}","${new Date(t.updatedAt).toISOString()}"`).join('\n');
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=templates_${new Date().toISOString().split('T')[0]}.csv`);
      return res.send(header + rows);
    }

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename=templates_${new Date().toISOString().split('T')[0]}.json`);
    res.json(templates);
  } catch (error) {
    console.error('Error exporting templates:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;