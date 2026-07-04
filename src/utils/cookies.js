// Clear the refresh token cookie
const clearAccessAndRefreshTokenCookie = (res) => {
    const cookieOptions = {
        httpOnly: true,
        secure: true,
        sameSite: 'None',
    }

    res.clearCookie('refreshToken', cookieOptions);
};

module.exports = {
    clearAccessAndRefreshTokenCookie
}