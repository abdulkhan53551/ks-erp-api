const { db } = require("../database");
const { ApiError } = require("../services/ApiError");


const demoDBCall = async () => {
    const states = await db('state').select('*');
    
    console.log('States:', states);
    
    return states;
}

const demoDBInsert = async () => {
    try {
        const user = {
            name: 'John Doe',
            email: 'john.doe@example.com',
            mobile: '9876543210',
            password: 'hashedpassword',
            is_active: true
        }
    
        const query =  db('tempUser').insert(user).returning('id');
        const result = await query;
        
        return result?.[0]?.id || 0;
    } catch (error) {
        return 0;
    }
}

const demoDbUpdate = async () => {
    try {
        const user = {
            name: 'Abdul Khan',
            updated_at: db.fn.now()
        }

        const [updatedUser] = await db('tempUser')
            .update(user)
            .where({ id: 17 })
            .returning('id');

        return updatedUser.id || 0;
    } catch (error) {
        throw new ApiError({statusCode: 500, message: 'Error updating user', errors: error});
    }
}

module.exports = {
    demoDBCall,
    demoDBInsert,
    demoDbUpdate
}