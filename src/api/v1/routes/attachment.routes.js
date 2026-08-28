const { Router } = require('express');
const validate = require('../middlewares/validate');
const {
    getAttachments,
    createAttachment,
    deleteAttachment
} = require('../controllers/attachment.controller');
const {
    getAttachmentsSchema,
    createAttachmentSchema,
    deleteAttachmentSchema
} = require('../validation/attachment.validation');

const router = Router();

// Attachments CRUD routes
router.get('/', validate(getAttachmentsSchema), getAttachments);
router.post('/', validate(createAttachmentSchema), createAttachment);
router.delete('/:id', validate(deleteAttachmentSchema), deleteAttachment);

module.exports = router;
