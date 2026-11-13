export function cx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

export { authSites, getAuthPageMetadata, getPrivateAuthPageMetadata, metadataTags } from './authSeo';

export { API_BASE_URL, buildApiUrl } from './api';
export { faqs, type FaqAudience } from './faqs';

export { normalizeImageForUpload, validateUploadImageSource, isSupportedUploadImage, PHOTO_INPUT_ACCEPT, PhotoUploadError, MAX_UPLOAD_IMAGE_BYTES } from './imageUpload';
