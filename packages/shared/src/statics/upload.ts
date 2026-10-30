export enum UploadHeaders {
  ORIGINAL_NAME = 'x-file-name',
  TYPE = 'x-file-type',
  CONTENT_LENGTH = 'content-length',
  TOKEN = 'x-token',
  PURPOSE = 'x-upload-purpose'
}

export enum UploadPurpose {
  MESSAGE = 'message',
  PROFILE_IMAGE = 'profile-image'
}
