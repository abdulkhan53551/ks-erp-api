const Joi = require("joi");

const queryEmployeesSchema = {
    query: Joi.object({
        page: Joi.number().integer().min(1).default(1),
        pageSize: Joi.number().integer().min(1).max(500).default(10),
        search: Joi.string().allow('', null).optional(),
        status: Joi.string().valid('ACTIVE', 'RESIGNED', 'TERMINATED', 'ABSCONDED', 'ALL', '').allow(null).optional(),
        employmentType: Joi.string().valid('PERMANENT', 'DAILY_WAGE', 'CONTRACT', 'PART_TIME', 'ALL', '').allow(null).optional(),
        salaryType: Joi.string().valid('MONTHLY', 'DAILY', 'HOURLY', 'ALL', '').allow(null).optional(),
        department: Joi.string().allow('', null).optional(),
        designation: Joi.string().allow('', null).optional(),
        branchId: Joi.number().integer().positive().allow(null, '').optional(),
        firmId: Joi.alternatives().try(Joi.number().integer().positive(), Joi.string().valid('all', '')).allow(null).optional(),
        trash: Joi.alternatives().try(Joi.boolean(), Joi.string().valid('true', 'false')).optional(),
        sortBy: Joi.string().allow('', null).optional(),
        sortOrder: Joi.string().valid('asc', 'desc', 'ASC', 'DESC', '').allow(null).optional()
    }).unknown(true)
};

const employeeIdParamSchema = {
    params: Joi.object({
        id: Joi.number().integer().positive().required().label('Employee ID')
    })
};

const createEmployeeSchema = {
    body: Joi.object({
        firmId: Joi.number().integer().positive().optional().label('Firm ID'),
        branchId: Joi.number().integer().positive().allow(null).optional().label('Branch ID'),
        userId: Joi.number().integer().positive().allow(null).optional().label('ERP User ID'),

        empCode: Joi.string().trim().max(50).required().label('Employee Code'),
        firstName: Joi.string().trim().max(100).required().label('First Name'),
        lastName: Joi.string().trim().max(100).allow('', null).optional().label('Last Name'),
        email: Joi.string().email().allow('', null).optional().label('Email'),
        phone: Joi.string().trim().max(25).allow('', null).optional().label('Phone'),
        photoUrl: Joi.string().uri().allow('', null).optional().label('Photo URL'),
        photoPublicId: Joi.string().allow('', null).optional().label('Photo Public ID'),

        dateOfBirth: Joi.date().iso().allow(null, '').optional().label('Date of Birth'),
        gender: Joi.string().valid('MALE', 'FEMALE', 'OTHER', '').allow(null).optional().label('Gender'),
        bloodGroup: Joi.string().trim().max(10).allow('', null).optional().label('Blood Group'),
        address: Joi.string().allow('', null).optional().label('Address'),
        cityId: Joi.number().integer().positive().allow(null, '').optional().label('City ID'),
        stateId: Joi.number().integer().positive().allow(null, '').optional().label('State ID'),
        pincode: Joi.string().trim().max(15).allow('', null).optional().label('Pincode'),
        emergencyContactName: Joi.string().trim().max(100).allow('', null).optional().label('Emergency Contact Name'),
        emergencyContactPhone: Joi.string().trim().max(25).allow('', null).optional().label('Emergency Contact Phone'),

        dateOfJoining: Joi.date().iso().required().label('Date of Joining'),
        dateOfExit: Joi.date().iso().allow(null, '').optional().label('Date of Exit'),
        department: Joi.string().trim().max(100).allow('', null).optional().label('Department'),
        designation: Joi.string().trim().max(100).allow('', null).optional().label('Designation'),
        employmentType: Joi.string().valid('PERMANENT', 'DAILY_WAGE', 'CONTRACT', 'PART_TIME').default('PERMANENT').label('Employment Type'),
        status: Joi.string().valid('ACTIVE', 'RESIGNED', 'TERMINATED', 'ABSCONDED').default('ACTIVE').label('Status'),

        salaryType: Joi.string().valid('MONTHLY', 'DAILY', 'HOURLY').default('MONTHLY').label('Salary Type'),
        baseSalary: Joi.number().min(0).default(0).label('Base Salary'),
        salaryTemplateId: Joi.number().integer().positive().allow(null, '').optional().label('Salary Template ID'),

        bankName: Joi.string().trim().max(150).allow('', null).optional().label('Bank Name'),
        accountNumber: Joi.string().trim().max(50).allow('', null).optional().label('Account Number'),
        ifscCode: Joi.string().trim().max(30).allow('', null).optional().label('IFSC Code'),
        panNumber: Joi.string().trim().max(30).allow('', null).optional().label('PAN Number'),
        aadharNumber: Joi.string().trim().max(30).allow('', null).optional().label('Aadhar Number'),
        uanNumber: Joi.string().trim().max(30).allow('', null).optional().label('UAN Number'),
        esiNumber: Joi.string().trim().max(30).allow('', null).optional().label('ESI Number'),

        // Initial Shift Assignment (Optional)
        shiftId: Joi.number().integer().positive().allow(null, '').optional().label('Shift ID')
    }).unknown(true)
};

const updateEmployeeSchema = {
    params: Joi.object({
        id: Joi.number().integer().positive().required().label('Employee ID')
    }),
    body: Joi.object({
        branchId: Joi.number().integer().positive().allow(null).optional().label('Branch ID'),
        userId: Joi.number().integer().positive().allow(null).optional().label('ERP User ID'),

        empCode: Joi.string().trim().max(50).optional().label('Employee Code'),
        firstName: Joi.string().trim().max(100).optional().label('First Name'),
        lastName: Joi.string().trim().max(100).allow('', null).optional().label('Last Name'),
        email: Joi.string().email().allow('', null).optional().label('Email'),
        phone: Joi.string().trim().max(25).allow('', null).optional().label('Phone'),
        photoUrl: Joi.string().uri().allow('', null).optional().label('Photo URL'),
        photoPublicId: Joi.string().allow('', null).optional().label('Photo Public ID'),

        dateOfBirth: Joi.date().iso().allow(null, '').optional().label('Date of Birth'),
        gender: Joi.string().valid('MALE', 'FEMALE', 'OTHER', '').allow(null).optional().label('Gender'),
        bloodGroup: Joi.string().trim().max(10).allow('', null).optional().label('Blood Group'),
        address: Joi.string().allow('', null).optional().label('Address'),
        cityId: Joi.number().integer().positive().allow(null, '').optional().label('City ID'),
        stateId: Joi.number().integer().positive().allow(null, '').optional().label('State ID'),
        pincode: Joi.string().trim().max(15).allow('', null).optional().label('Pincode'),
        emergencyContactName: Joi.string().trim().max(100).allow('', null).optional().label('Emergency Contact Name'),
        emergencyContactPhone: Joi.string().trim().max(25).allow('', null).optional().label('Emergency Contact Phone'),

        dateOfJoining: Joi.date().iso().optional().label('Date of Joining'),
        dateOfExit: Joi.date().iso().allow(null, '').optional().label('Date of Exit'),
        department: Joi.string().trim().max(100).allow('', null).optional().label('Department'),
        designation: Joi.string().trim().max(100).allow('', null).optional().label('Designation'),
        employmentType: Joi.string().valid('PERMANENT', 'DAILY_WAGE', 'CONTRACT', 'PART_TIME').optional().label('Employment Type'),
        status: Joi.string().valid('ACTIVE', 'RESIGNED', 'TERMINATED', 'ABSCONDED').optional().label('Status'),

        salaryType: Joi.string().valid('MONTHLY', 'DAILY', 'HOURLY').optional().label('Salary Type'),
        baseSalary: Joi.number().min(0).optional().label('Base Salary'),
        salaryTemplateId: Joi.number().integer().positive().allow(null, '').optional().label('Salary Template ID'),

        bankName: Joi.string().trim().max(150).allow('', null).optional().label('Bank Name'),
        accountNumber: Joi.string().trim().max(50).allow('', null).optional().label('Account Number'),
        ifscCode: Joi.string().trim().max(30).allow('', null).optional().label('IFSC Code'),
        panNumber: Joi.string().trim().max(30).allow('', null).optional().label('PAN Number'),
        aadharNumber: Joi.string().trim().max(30).allow('', null).optional().label('Aadhar Number'),
        uanNumber: Joi.string().trim().max(30).allow('', null).optional().label('UAN Number'),
        esiNumber: Joi.string().trim().max(30).allow('', null).optional().label('ESI Number'),

        shiftId: Joi.number().integer().positive().allow(null, '').optional().label('Shift ID')
    }).unknown(true)
};

module.exports = {
    queryEmployeesSchema,
    employeeIdParamSchema,
    createEmployeeSchema,
    updateEmployeeSchema
};
