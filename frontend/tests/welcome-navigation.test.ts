import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

test("the visible Welcome logo navigates internally to home", () => {
  const source = readFileSync(new URL("../apps/usuario/src/pages/Welcome.tsx", import.meta.url), "utf8");
  assert.match(source, /<Link className="welcome-brand" to="\/home" aria-label="(?:WIT|XAMUKO), inicio">/);
  assert.doesNotMatch(source, /welcome-brand[^>]+href=/);
});

test("location screen logos also navigate to home", () => {
  const location = readFileSync(new URL("../apps/usuario/src/pages/Location.tsx", import.meta.url), "utf8");
  const manual = readFileSync(new URL("../apps/usuario/src/pages/ManualLocation.tsx", import.meta.url), "utf8");
  const header = readFileSync(new URL("../apps/usuario/src/components/SiteHeader.tsx", import.meta.url), "utf8");
  assert.match(location, /<SiteHeader\s[^>]*\/>/);
  assert.match(header, /<Link className="brand" to="\/home" aria-label="XAMUKO, inicio">/);
  assert.match(manual, /<SiteHeader\s*\/>/);
});

test("verified Usuario and Business sessions navigate to their home routes without another login", () => {
  const usuario = readFileSync(new URL("../apps/usuario/src/pages/VerifyEmail.tsx", import.meta.url), "utf8");
  const business = readFileSync(new URL("../apps/negocios/src/pages/VerifyEmailPage.tsx", import.meta.url), "utf8");
  assert.match(usuario, /if \(result\.autoLogin\) \{[\s\S]*?completeVerification\(result\.user\);\s*navigate\("\/home", \{ replace: true \}\);/);
  assert.match(business, /if \(result\.autoLogin\) \{[\s\S]*?completeVerification\(result\.user\);\s*navigate\("\/inicio", \{ replace: true \}\);/);
  assert.doesNotMatch(usuario, /navigate\("\/profile"/);
  assert.doesNotMatch(business, /navigate\("\/login"/);
});
