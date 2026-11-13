import { publicUrls } from "./publicUrls";

// Verified against Usuario/App.tsx, Register.tsx and Negocios/App.tsx.
export const destinations = {
  explore: `${publicUrls.usuario}/home`,
  guestExplore: publicUrls.usuario,
  userRegister: `${publicUrls.usuario}/register`,
  userLogin: `${publicUrls.usuario}/register?mode=login`,
  businessRegister: `${publicUrls.business}/registro`,
  businessLogin: `${publicUrls.business}/login`,
  businessHelp: `${publicUrls.business}/ayuda`,
  businessSupport: `${publicUrls.business}/soporte`,
  terms: `${publicUrls.usuario}/legal/terms`,
  privacy: `${publicUrls.usuario}/legal/privacy`,
} as const;
