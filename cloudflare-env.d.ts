declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    MEDIA?: R2Bucket;
    FAL_KEY?: string;
    FAL_IMAGE_MODEL?: string;
    FAL_IMAGE_EDIT_MODEL?: string;
    FAL_VIDEO_MODEL?: string;
    FAL_VIDEO_IMAGE_MODEL?: string;
    FAL_LIPSYNC_MODEL?: string;
    ELEVENLABS_API_KEY?: string;
    ELEVENLABS_DEFAULT_VOICE_ID?: string;
  }
}
