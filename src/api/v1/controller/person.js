const pool = require('../../../config/database.js');

exports.getPerson = (req, res) => {
    pool.query("SELECT * FROM persons", (error, result) => {
        if (error) throw error;
        res.status(200).json(result.rows);
    });
}

exports.getPersonByID = (req, res) => {
    const personID = parseInt(req.params.id);
    pool.query("SELECT * FROM persons WHERE personid = $1", [personID], (error, result) => {
        if (error) throw error;

        console.log(result);
        res.status(200).json(result.rows);
    });
}
exports.addPerson = async (req, res) => {
    console.log('body => ', req.body);
    const { personID, personName, emailID } = req.body;

    const result = await pool.query(`SELECT * FROM persons WHERE "emailID" = $1`, [emailID]);
    const { rows, rowCount } = result;

    if (rowCount) {
        const response = {
            msg: "Email already exists.",
            data: result
        }

        res.status(200).json(response);
    } else {
        const { personName, emailID } = req.body;
        const result = await pool.query(`INSERT INTO persons ("fullname", "emailID") VALUES ($1, $2)`, [personName, emailID]);
        const { rows, rowCount } = result;
        console.log('rows => ', rows);
        console.log('result => ', result);

        if (rowCount) {
            const response = {
                msg: "Person added successfully.",
                data: result
            }
    
            res.status(200).json(response);
        }

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


