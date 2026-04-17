import crypto from "crypto";

const secret = process.env.AUTH_SECRET || "cafelio-local-dev-secret";
const issuer = "cafelio";

const base64url = (value) => Buffer.from(value).toString("base64url");
const parseBase64url = (value) => Buffer.from(value, "base64url").toString("utf8");

export const hashPassword = async (password, salt = crypto.randomBytes(16).toString("hex")) => {
  const passwordHash = await new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, 64, (error, derivedKey) => {
      if (error) reject(error);
      else resolve(derivedKey.toString("hex"));
    });
  });

  return { passwordHash, passwordSalt: salt };
};

export const verifyPassword = async (password, user) => {
  const { passwordHash } = await hashPassword(password, user.passwordSalt);
  return crypto.timingSafeEqual(Buffer.from(passwordHash, "hex"), Buffer.from(user.passwordHash, "hex"));
};

export const signToken = (payload) => {
  const header = { alg: "HS256", typ: "JWT" };
  const body = {
    ...payload,
    iss: issuer,
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7
  };
  const encodedHeader = base64url(JSON.stringify(header));
  const encodedBody = base64url(JSON.stringify(body));
  const signature = crypto
    .createHmac("sha256", secret)
    .update(`${encodedHeader}.${encodedBody}`)
    .digest("base64url");

  return `${encodedHeader}.${encodedBody}.${signature}`;
};

export const verifyToken = (token) => {
  const [encodedHeader, encodedBody, signature] = String(token || "").split(".");

  if (!encodedHeader || !encodedBody || !signature) {
    return null;
  }

  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${encodedHeader}.${encodedBody}`)
    .digest("base64url");

  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
    return null;
  }

  const payload = JSON.parse(parseBase64url(encodedBody));

  if (payload.iss !== issuer || payload.exp < Math.floor(Date.now() / 1000)) {
    return null;
  }

  return payload;
};
