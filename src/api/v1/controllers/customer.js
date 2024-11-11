const {pool} = require('./index');

exports.getCustomer = (req, res) => {
    pool.query("SELECT * FROM customer", (error, result) => {
        if (error) throw error;
        res.status(200).json(result.rows);
    });
}

exports.getCustomerByID = async (req, res) => {
    const customerID = parseInt(req.params.id);
    let response = {};

    const result = await pool.query(`SELECT * FROM customer WHERE "customerID" = $1`, [customerID]);
    const { rows, rowCount } = result;

    if (rowCount) {
        response = {
            status: 200,
            msg: "Email already exists.",
            data: rows
        }

    } else {
        response = {
            status: 404,
            msg: 'Record not found.'
        }
    }
    res.status(response.status).json(response);
}

exports.addCustomer = async (req, res) => {
    console.log('body => ', req.body);
    
    
    const { personName, emailID } = req.body;
    const result = await pool.query(`INSERT INTO persons ("fullname", "emailID") VALUES ($1, $2)`, [personName, emailID]);
    const { rows, rowCount } = result;
    console.log('rows => ', rows);
    console.log('result => ', result);

    if (rowCount) {
        const response = {
            staus: 200,
            msg: "Person added successfully.",
            data: result
        }

        res.status(response.staus).json(response);
    }

    // const { personID, personName, emailID } = req.body;
    // const sqlQry = pool.query("SELECT * FROM persons WHERE emailID = $1", [emailID], (error, result) => {
    //     console.log('error => ', error);
    //     // try {
    //     //     if (error) throw error;
    //     //     console.log('emailID => ', emailID);
    //     //     console.log('result => ', result);
    //     //     if (result.rows.length) {
    //     //         res.send('Email already exists.');
    //     //     } else {
    //     //         pool.query("INSERT INTO persons (personid, fullname, emailID) VALUES ($1, $2, $3, $4)", [personID, personName, emailID], (error, result) => {
    //     //             if (error) throw error;
    //     //             res.status(200).send("Person added successfully.");
    //     //         })
    //     //     }
    //     // } catch (error) {
    //     //     console.log('error => ', error);
    //     // }
    // });
}