const {asyncHandler} = require('../services/asyncHandler.js')
const {ApiError} = require('../services/ApiError.js');
const { isUserExist, isPasswordCorrect, generateToken, generateRefreshToken, updatePassword, demoDBCall } = require('../models/user.model.js');
const {uploadOnCloudinary} = require('../services/cloudinary.js');
const { delay } = require('../services/common.js');
const { ApiResponse } = require('../services/ApiResponse.js');
const jwt = require('jsonwebtoken');
const { JWT } = require('../../../config/config.js');
const { demoDBInsert, demoDbUpdate } = require('../models/demo.model.js');



const demoLoginUser = asyncHandler(async (req, res) => {
    const demoData = await demoDBCall();
    return res
      .status(200)
      .json(
          new ApiResponse({
              statusCode: 200,
              data: demoData,
              message: 'demo data fetched successfully'
          })
    )
    // const demoData = await demoDBCall();
    // return res
    //   .status(200)
    //   .json(
    //       new ApiResponse({
    //           statusCode: 200,
    //           data: demoData,
    //           message: 'demo data fetched successfully'
    //       })
    // )

    
})


const demoRegisterUser = asyncHandler(async (req, res) => {
    let response = {
        statusCode: 400,
        message: 'Something went wrong while inserting demo user data'
    }

    const insertID = await demoDBInsert();

    if (insertID > 0) {
        response = {
            statusCode: 201,
            message: 'demo user data inserted successfully'
        }
    }

    return res
      .status(response.statusCode)
      .json(
          new ApiResponse(response)
    )
})

// Demo update user
const demoUpdateUser = asyncHandler(async (req, res) => {
    let response = {
        statusCode: 400,
        message: 'No matching user found.'
    }

    const affectedRow = await demoDbUpdate();

    if (affectedRow > 0) {
        response = {
            statusCode: 200,
            message: 'User update successful:'
        }
    }

    return res
      .status(response.statusCode)
      .json(
          new ApiResponse(response)
    )
})

module.exports = {
    demoLoginUser,
    demoRegisterUser,
    demoUpdateUser
}