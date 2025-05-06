const { JWT } = require('../../../config/config');
const { db } = require('../database');
const { generateToken, hashToken, generateAccessToken } = require('../helpers/token');
const { ApiError } = require('./ApiError');

const REFRESH_TOKEN_EXPIRY_DAYS = Number(JWT.REFRESH_TOKEN_EXPIRE?.match(/\d+/)?.[0]);

async function createRefreshToken(userId, ip, userAgent, deviceId = null) {
    const token = generateToken();
    const tokenHash = hashToken(token);
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

    const [userTokenData] = await db('refresh_tokens').insert({
        user_id: userId,
        token_hash: tokenHash,
        expires_at: expiresAt,
        ip_address: ip,
        user_agent: userAgent,
        device_id: deviceId,
    }).returning('id');

    return { token, id: userTokenData?.id };
}

async function rotateRefreshToken(oldToken, ip, userAgent, deviceId = null) {
    try {
        const tokenHash = hashToken(oldToken);

        // Check if the token exists and is not revoked
        const query = db('refresh_tokens as rt')
            .join('users as u', 'u.id', 'rt.user_id')
            .where('rt.token_hash', tokenHash)
            .andWhere('rt.revoked_at', null)
            .select(
                'rt.id as token_id',
                'rt.expires_at',
                'u.id as user_id',
                'u.first_name',
                'u.last_name',
                'u.user_name',
                'u.email'
            )
            .first();

        const existing = await query;

        // Check if the token is expired
        if (!existing || new Date(existing.expires_at) < new Date()) {
            throw new ApiError({ statusCode: 401, message: 'Invalid or expired refresh token' })
        }

        // Generate access token
        const tokenPayload = {
            id: existing?.user_id,
            email: existing?.email,
            userName: existing.user_name,
            fullName: `${existing.first_name} ${existing.last_name}`
        }

        const accessToken = generateAccessToken(tokenPayload)

        // Revoke old token
        await db('refresh_tokens').where({ id: existing?.token_id }).update({ revoked_at: new Date() });

        const { token: newToken, id: newTokenId } = await createRefreshToken(existing?.user_id, ip, userAgent, deviceId);

        await db('refresh_tokens').where({ id: existing?.token_id }).update({ replaced_by_token_id: newTokenId });

        return { accessToken, newToken };
    } catch (error) {
        throw error instanceof ApiError ? error : new ApiError({ statusCode: 500, message: 'Something went wrong while rotating refresh token' })
    }
}

module.exports = { createRefreshToken, rotateRefreshToken };