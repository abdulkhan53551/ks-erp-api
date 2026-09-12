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

        // Fetch the token along with user and role details
        const query = db('refresh_tokens as rt')
            .join('users as u', 'u.id', 'rt.user_id')
            .leftJoin('roles as r', 'r.id', 'u.role_id')
            .where('rt.token_hash', tokenHash)
            .select(
                'rt.id as token_id',
                'rt.expires_at',
                'rt.revoked_at',
                'rt.replaced_by_token_id',
                'u.id as user_id',
                'u.first_name',
                'u.last_name',
                'u.user_name',
                'u.email',
                'u.role_id',
                'r.slug as role_slug',
                'r.name as role_name'
            )
            .first();

        const existing = await query;

        // Check if the token exists or is expired
        if (!existing || new Date(existing.expires_at) < new Date()) {
            throw new ApiError({ statusCode: 401, message: 'Invalid or expired refresh token' });
        }

        const role = existing.role_slug || 'admin';
        const firmId = 1;

        // Generate access token
        const tokenPayload = {
            id: existing.user_id,
            email: existing.email,
            userName: existing.user_name,
            fullName: `${existing.first_name} ${existing.last_name}`.trim(),
            role,
            roleId: existing.role_id,
            firmId
        };

        const accessToken = generateAccessToken(tokenPayload);

        // Check if token was already revoked
        if (existing.revoked_at) {
            const GRACE_PERIOD_MS = 15000; // 15 seconds grace window for concurrent requests
            const revokedAtTime = new Date(existing.revoked_at).getTime();
            const now = Date.now();

            if (now - revokedAtTime <= GRACE_PERIOD_MS && existing.replaced_by_token_id) {
                // Token was rotated moments ago by a parallel request.
                // Return the newly generated access token and null newToken to prevent session destruction.
                return { accessToken, newToken: null };
            }

            throw new ApiError({ statusCode: 401, message: 'Refresh token has been revoked' });
        }

        // Revoke old token
        await db('refresh_tokens').where({ id: existing.token_id }).update({ revoked_at: new Date() });

        const { token: newToken, id: newTokenId } = await createRefreshToken(existing.user_id, ip, userAgent, deviceId);

        await db('refresh_tokens').where({ id: existing.token_id }).update({ replaced_by_token_id: newTokenId });

        return { accessToken, newToken };
    } catch (error) {
        throw error instanceof ApiError ? error : new ApiError({ statusCode: 500, message: 'Something went wrong while rotating refresh token' });
    }
}

module.exports = { createRefreshToken, rotateRefreshToken };