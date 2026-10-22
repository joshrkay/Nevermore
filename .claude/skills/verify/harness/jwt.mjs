import { createHmac } from "node:crypto";
const SECRET = "verify-harness-secret-0123456789abcdef";
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
export function sign(claims) {
  const head = b64({ alg: "HS256", typ: "JWT" });
  const body = b64({ aud: "authenticated", exp: 4102444800, ...claims });
  const sig = createHmac("sha256", SECRET).update(`${head}.${body}`).digest("base64url");
  return `${head}.${body}.${sig}`;
}
export function verify(token) {
  const [h, p, s] = token.split(".");
  if (!s) return null;
  const good = createHmac("sha256", SECRET).update(`${h}.${p}`).digest("base64url");
  if (good !== s) return null;
  const claims = JSON.parse(Buffer.from(p, "base64url").toString());
  return claims.exp * 1000 > Date.now() ? claims : null;
}
if (process.argv[1]?.endsWith("jwt.mjs")) {
  const [role, sub, email, anon] = process.argv.slice(2);
  process.stdout.write(sign({ role, ...(sub ? { sub } : {}), ...(email ? { email } : {}), is_anonymous: anon === "true" }));
}
