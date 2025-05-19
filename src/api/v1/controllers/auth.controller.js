const { asyncHandler } = require('../services/asyncHandler.js')
const { ApiResponse } = require('../services/ApiResponse.js');
const { ApiError } = require('../services/ApiError.js');
const { rotateRefreshToken, createRefreshToken } = require('../services/tokenService.js');
const { JWT } = require('../../../config/config.js');
const { isUserExist, getHashedPassword, isPasswordCorrect } = require('../models/user.model.js');
const { createUser, deleteRefreshTokenByUserIDAndToken, deleteRefreshTokenByUserID, removeAssignedRolePermissionById, getResourcePermissionById } = require('../models/auth.model.js');
const { hashToken, generateAccessToken } = require('../helpers/token.js');
const { clearAccessAndRefreshTokenCookie } = require('../../../utils/cookies.js');
const casbinDb = require('../models/auth.model.js');
const { getEnforcer } = require('../services/casbin.js');
const { isValidJsonLogic, parseExpressionToJsonLogic, jsonLogicToString, stringToJsonLogic } = require('../../../utils/utility.js');

// Convert to expiry days to number
const REFRESH_TOKEN_EXPIRY_DAYS = Number(JWT.REFRESH_TOKEN_EXPIRE?.match(/\d+/)?.[0]);
const REFRESH_TOKEN_EXPIRY_IN_MS = REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000

// Register user
const registerUser = asyncHandler(async (req, res) => {
    let response = {
        statusCode: 500,
        data: null,
        message: 'Something went wrong while registering user'
    }

    // Get user detail
    const { firstName, lastName, role, email, userName, password } = req.body

    // Validation - not empty
    if (
        [firstName, lastName, role, email, userName, password].some(field => !field?.trim())
    ) {
        throw new ApiError({ statusCode: 400, message: 'All fields are required' });
    }

    // Check if user already exist
    const existedUser = await isUserExist(userName, email)

    // Throw error if user exist
    if (existedUser?.id > 0) {
        throw new ApiError({ statusCode: 409, message: 'User with email or username already exist' });
    }

    // Hashed password
    const hashedPassword = await getHashedPassword(password)

    // Check for image upload them to server
    // const avatarLocalPath = req.files?.avatar?.[0]?.path
    // const coverImageLocalPath = req.files?.coverImage?.[0]?.path

    // if (!avatarLocalPath) {
    //     throw new ApiError({statusCode: 400, message: 'Avatar local file is required'})
    // }

    // // Upload them to cloudanary, image
    // const avatar = await uploadOnCloudinary(avatarLocalPath)
    // const coverImage = await uploadOnCloudinary(coverImageLocalPath)

    // if (!avatar) {
    //     throw new ApiError({statusCode: 400, message: 'Avatar file is required'})
    // }

    const userData = {
        email: email,
        password: hashedPassword,
        first_name: firstName,
        last_name: lastName,
        role_id: role,
        user_name: userName.toLowerCase()
    }

    // Remove password & refresh token field from response
    const newUser = await createUser(userData)

    // Check for user creation
    if (!newUser) {
        throw new ApiError({ statusCode: 500, message: 'Something went wrong while registering user' })
    }

    // Prepare response
    response = {
        statusCode: 201,
        data: newUser,
        message: 'User registered successfully.'
    }

    return res.status(response.statusCode).json(new ApiResponse(response))
})

const loginUser = asyncHandler(async (req, res) => {
    const { userName, email, password } = req.body;
    const userAgent = req.get('User-Agent');
    const ipAddress = req.ip;
    let response = {
        statusCode: 500,
        data: null,
        message: 'Something went wrong while logging'
    }

    // Username or email
    if (!(userName || email)) {
        throw new ApiError({ statusCode: 400, message: 'username or  email is required' })
    }

    // Check if user already exist
    const user = await isUserExist(userName, email)

    // Check if user exist
    if (!user?.id) {
        throw new ApiError({ statusCode: 404, message: 'User not found' })
    }

    // Check password
    const isPasswordValid = await isPasswordCorrect(password, user?.password)
    if (!isPasswordValid) {
        throw new ApiError({ statusCode: 401, message: 'Invalid user credential' })
    }

    // throw new ApiError({ statusCode: 200, message: 'break point' })

    // Acess and refresh token generation
    const tokenData = { user: user, ip: ipAddress, userAgent, deviceId: null }
    const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(tokenData)

    // Generate new access and refresh token
    const optionsCookie = {
        httpOnly: true,
        secure: true,
        sameSite: 'Strict',
        maxAge: REFRESH_TOKEN_EXPIRY_IN_MS
    }

    response = {
        statusCode: 200,
        data: { accessToken, refreshToken },
        message: 'Successfully logged in'
    }

    // Set access & refresh token as HTTP-only cookie
    return res
        .status(response.statusCode)
        .cookie('refreshToken', refreshToken, optionsCookie)
        .json(new ApiResponse(response))
});

// Generate refresh token
const refreshUserToken = asyncHandler(async (req, res) => {
    const refreshToken = req.cookies.refreshToken || req.body.refreshToken
    const ip = req.ip;
    const userAgent = req.get('User-Agent');

    let response = {
        statusCode: 500,
        data: null,
        message: 'Something went wrong while generating refresh token'
    }

    // Check if refresh token is present
    if (!refreshToken) {
        throw new ApiError({ statusCode: 400, message: 'Refresh token is required' })
    }

    // Get new refresh token
    const { accessToken, newToken: newRefreshToken } = await rotateRefreshToken(refreshToken, ip, userAgent);

    // Get token data
    const tokens = { accessToken, refreshToken: newRefreshToken }

    // Generate new access and refresh token
    const optionsCookie = {
        httpOnly: true,
        secure: true,
        sameSite: 'Strict',
        maxAge: REFRESH_TOKEN_EXPIRY_IN_MS
    }

    response = {
        statusCode: 200,
        data: tokens,
        message: 'Successfully generated access and refreshed token'
    }

    // Set access & refresh token as HTTP-only cookie
    return res
        .status(response.statusCode)
        .cookie('refreshToken', newRefreshToken, optionsCookie)
        .json(new ApiResponse(response))
})

// Generate access and refresh token
const generateAccessAndRefreshTokens = async (tokenData) => {
    try {
        const { user, ip, userAgent, deviceId } = tokenData

        // Generate access token
        const tokenPayload = {
            id: user.id,
            email: user.email,
            userName: user.user_name,
            fullName: `${user.first_name} ${user.last_name}`
        }
        const accessToken = generateAccessToken(tokenPayload)

        // Generate refresh token
        const { token: refreshToken } = await createRefreshToken(user.id, ip, userAgent, deviceId);

        return { accessToken, refreshToken }
    } catch (error) {
        console.log('Error generating access and refresh token:', error);

        throw new ApiError({ statusCode: 500, message: 'Something went wrong while generating refresh and access token.' })
    }
}

// Check verify access token
const checkVerifyAccessToken = asyncHandler(async (req, res, next) => {
    return res
        .status(200)
        .json(new ApiResponse({ statusCode: 200, message: 'Access token is valid' }))
})

// Check verify access token
const checkIsAuthorizeAccess = asyncHandler(async (req, res, next) => {

    return res
        .status(200)
        .json(new ApiResponse({ statusCode: 200, data: { authorize: true }, message: 'User is authorized' }))
})

// Logout
const logout = asyncHandler(async (req, res, next) => {
    try {
        const refreshToken = req.cookies.refreshToken || req.body.refreshToken
        const userId = req.user.id;

        // Check if refresh token is present
        if (!refreshToken) {
            throw new ApiError({ statusCode: 400, message: 'Refresh token is required' })
        }

        const hashedToken = hashToken(refreshToken);

        const wasDeleted = await deleteRefreshTokenByUserIDAndToken(userId, hashedToken)

        if (!wasDeleted) {
            throw new ApiError({ statusCode: 400, message: 'Unable to logout: token not found or already logged out' })
        }

        // Clear the refresh token cookie
        clearAccessAndRefreshTokenCookie(res)

        return res
            .status(200)
            .json(new ApiResponse({ statusCode: 200, message: 'Logged out successfully' }))
    } catch (err) {
        console.log('Error during logout:', err);

        throw err instanceof ApiError ? err : new ApiError({ statusCode: 500, message: 'Logout error' })
    }
});

// Logout all sessions
const logoutAllSessions = asyncHandler(async (req, res, next) => {
    const userId = req.user.id;

    // Delete all refresh tokens for the user
    const wasDeleted = await deleteRefreshTokenByUserID(userId)

    // Check if any tokens were deleted
    if (!wasDeleted) {
        throw new ApiError({ statusCode: 400, message: 'Unable to logout from all sessions' })
    }

    // Clear the refresh token cookie
    clearAccessAndRefreshTokenCookie(res); // Clears cookie from browser

    return res.status(200).json(new ApiResponse({ statusCode: 200, message: 'Logged out from all sessions' }));
});

// Create Role
const createRole = asyncHandler(async (req, res) => {
    const { name, slug, description } = req.body;
    const roleData = {
        name: name,
        slug: slug,
        description: description || null
    }
    const id = await casbinDb.createRole(roleData);
    // res.json({ id, message: 'Role created' });
    return res
        .status(200)
        .json(new ApiResponse({ statusCode: 200, data: [], message: 'Role created' }))
})

// Create Permission
const createPermission = asyncHandler(async (req, res) => {
    const { object, action } = req.body;
    const id = await casbinDb.createPermission(object, action);
    // res.json({ id, message: 'Permission created' });
    return res
        .status(200)
        .json(new ApiResponse({ statusCode: 200, data: [], message: 'Permission created' }))
})

// Assign Role to User
const assignUserRole = asyncHandler(async (req, res) => {
    const { userId, roleId } = req.body;
    const userRoleId = await casbinDb.assignUserRole(userId, roleId);

    // res.json({ message: 'Role assigned to user' });
    return res
        .status(200)
        .json(new ApiResponse({ statusCode: 200, data: [], message: 'Role assigned to user' }))
})

// Assign Permission to Role
const assignRolePermission = asyncHandler(async (req, res) => {
    const { roleId, permissionId } = req.body;

    // Assign a role to a permission
    const rolePermissionId = await casbinDb.assignRolePermission(roleId, permissionId);

    // Get role permission details
    const { role, object, action } = await casbinDb.getRolePermissionById(rolePermissionId)

    if (role) {
        // Handle the case when the role permission is not found
        throw new ApiError({ statusCode: 404, message: 'Role permission not found' })
    }

    // Create new abac policy
    const policyId = await casbinDb.createAbacPolicy(role, object, action);

    // Get the policy details
    const { id, sub_rule, obj_rule, act } = await casbinDb.getAbacPolicyById(policyId);

    if (!id) {
        // Handle the case when the policy is not found
        throw new ApiError({ statusCode: 404, message: 'ABAC policy not found' })
    }

    // Add a policy to the enforcer
    await casbinDb.addPolicy(sub_rule, obj_rule, act);

    return res
        .status(200)
        .json(new ApiResponse({ statusCode: 200, data: [], message: 'Permission assigned to role' }))
})

// Remove Permission to Role
const removeRolePermission = asyncHandler(async (req, res) => {
    // const { id } = req.params;
    // const { roleId, permissionId } = req.body;

    // Assign a role to a permission
    const isDeleted = await removeAssignedRolePermissionById(id);

    if (!isDeleted) {
        // Handle the case when the role permission is not found
        throw new ApiError({ statusCode: 404, message: 'Something went wrong while deleting role permission mapping' })

    }


    // Create new abac policy
    const policyId = await casbinDb.createAbacPolicy(role, object, action);

    // Get the policy details
    const { id, sub_rule, obj_rule, act } = await casbinDb.getAbacPolicyById(policyId);

    if (!id) {
        // Handle the case when the policy is not found
        throw new ApiError({ statusCode: 404, message: 'ABAC policy not found' })
    }

    // Add a policy to the enforcer
    await casbinDb.addPolicy(sub_rule, obj_rule, act);

    return res
        .status(200)
        .json(new ApiResponse({ statusCode: 200, data: [], message: 'Role & Permission are removed successfully' }))
})


// Create policy
const createPolicy = asyncHandler(async (req, res) => {
    const { subRuleStr, resourceId, condRuleStr } = req.body;

    // const enforcer = await getEnforcer();
    // await enforcer.clearPolicy();                        // clear memory
    // await enforcer.savePolicy();                         // enforce empty policy set

    // console.log('Enforcer policies:', await enforcer.getPolicy());


    // return

    // return res
    // .status(200)
    // .json(new ApiResponse({ statusCode: 200, data: [req.body], message: 'just for testing' }))

    if (!subRuleStr) {
        throw new ApiError({ statusCode: 400, message: 'Please provide subject rule' })
    }

    if (!resourceId) {
        throw new ApiError({ statusCode: 400, message: 'Please provide resource id' })
    }

    // Generate rule
    console.log('aaaaaaa');
    
    const subjectRuleJson = stringToJsonLogic(subRuleStr);
    console.log('bbbbb');
    const conditionRuleJson = condRuleStr && stringToJsonLogic(condRuleStr)

    console.log('subjectRuleJson: ', JSON.stringify(subjectRuleJson));
    

    // Get resource permission
    const { resourcePermissionId, resource, action } = (await getResourcePermissionById(resourceId)) || {}

    // Check policy added or not
    if (!resourcePermissionId) {
        throw new ApiError({ statusCode: 400, message: 'No resource found.' })
    }

    // Logical json to string
    const subjectConditionStr = jsonLogicToString(subjectRuleJson)
    const conditionStr = jsonLogicToString(conditionRuleJson)
    const act = action?.toLowerCase()
    const condNew = conditionStr?.trim() || String(true)

    // Add policy to casbin rule
    const isCasbinPolicyAdded = await casbinDb.addPolicyToCasbinRule(subjectConditionStr, resource, act, condNew)

    // Check casbin policy added successfully or not
    if (!isCasbinPolicyAdded) {
        throw new ApiError({ statusCode: 500, message: 'Something went wrong while adding policy to casbin rule.' })
    }

    // Create policy
    const policyId = await casbinDb.createAbacPolicy(subjectRuleJson, resource, action, conditionRuleJson);

    // Check policy added or not
    if (!policyId) {
        throw new ApiError({ statusCode: 400, message: 'Something went wrong while creating policy.' })
    }

    return res
        .status(200)
        .json(new ApiResponse({ statusCode: 200, data: [], message: 'Policy added successfully.' }))
})

// Sync Casbin Policies
const syncPolicies = asyncHandler(async (req, res) => {
    // Sync casbin policies to policy table created by casbin and also store in memory
    await casbinDb.syncCasbinPolicies();

    return res
        .status(200)
        .json(new ApiResponse({ statusCode: 200, data: [], message: 'Policies synced to Casbin enforcer' }))
})

module.exports = {
    registerUser,
    loginUser,
    refreshUserToken,
    checkVerifyAccessToken,
    checkIsAuthorizeAccess,
    logout,
    logoutAllSessions,
    createRole,
    createPermission,
    assignUserRole,
    assignRolePermission,
    syncPolicies,
    createPolicy
}