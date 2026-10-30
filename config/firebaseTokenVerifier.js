const { createRemoteJWKSet, jwtVerify } = require("jose");

const firebaseSigningKeys = createRemoteJWKSet(
  new URL("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com")
);

const verifyFirebaseIdToken = async (idToken) => {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  if (!projectId) {
    const error = new Error("Firebase project is not configured");
    error.code = "FIREBASE_PROJECT_NOT_CONFIGURED";
    throw error;
  }

  const { payload } = await jwtVerify(idToken, firebaseSigningKeys, {
    algorithms: ["RS256"],
    audience: projectId,
    issuer: `https://securetoken.google.com/${projectId}`,
    requiredClaims: ["sub", "iat", "exp", "auth_time"],
  });

  if (typeof payload.sub !== "string" || payload.sub.length === 0 || payload.sub.length > 128) {
    const error = new Error("Firebase token has an invalid user ID");
    error.code = "FIREBASE_INVALID_SUBJECT";
    throw error;
  }

  return payload;
};

module.exports = verifyFirebaseIdToken;