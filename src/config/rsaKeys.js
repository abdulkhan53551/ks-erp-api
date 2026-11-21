const crypto = require('crypto');

let cachedPublicKeyString = null;
let cachedPrivateKeyObject = null;

function initRSAKeys() {
    if (process.env.RSA_PUBLIC_KEY && process.env.RSA_PRIVATE_KEY) {
        const rawPub = process.env.RSA_PUBLIC_KEY.trim().replace(/["'\s]/g, '');
        const rawPriv = process.env.RSA_PRIVATE_KEY.trim().replace(/["'\s]/g, '');

        cachedPublicKeyString = rawPub;
        cachedPrivateKeyObject = crypto.createPrivateKey({
            key: Buffer.from(rawPriv, 'base64'),
            format: 'der',
            type: 'pkcs8'
        });

        return { publicKey: cachedPublicKeyString, privateKey: cachedPrivateKeyObject };
    }

    console.warn('[RSA] RSA keys not found in .env. Generating in-memory keys for current session...');
    const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
        modulusLength: 2048,
        publicKeyEncoding: { type: 'spki', format: 'der' },
        privateKeyEncoding: { type: 'pkcs8', format: 'der' }
    });

    cachedPublicKeyString = publicKey.toString('base64');
    cachedPrivateKeyObject = crypto.createPrivateKey({
        key: privateKey,
        format: 'der',
        type: 'pkcs8'
    });

    return { publicKey: cachedPublicKeyString, privateKey: cachedPrivateKeyObject };
}

function getPublicKey() {
    if (!cachedPublicKeyString) {
        initRSAKeys();
    }
    return cachedPublicKeyString;
}

function getPrivateKeyObject() {
    if (!cachedPrivateKeyObject) {
        initRSAKeys();
    }
    return cachedPrivateKeyObject;
}

function decryptPayload(encryptedBase64) {
    if (!encryptedBase64 || typeof encryptedBase64 !== 'string') {
        throw new Error('Encrypted data must be a valid base64 string.');
    }

    const privateKeyObject = getPrivateKeyObject();
    const buffer = Buffer.from(encryptedBase64, 'base64');

    const decryptedBuffer = crypto.privateDecrypt(
        {
            key: privateKeyObject,
            padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
            oaepHash: 'sha256'
        },
        buffer
    );

    return JSON.parse(decryptedBuffer.toString('utf8'));
}

module.exports = {
    initRSAKeys,
    getPublicKey,
    decryptPayload
};
