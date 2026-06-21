import type {
  KavioAudioCodec,
  KavioExportCodec,
  KavioExportFormat,
  KavioExportPreset
} from "@kitsra/kavio-schema";

export function withEffectiveCodecs(preset: KavioExportPreset): KavioExportPreset {
  return {
    ...preset,
    codec: preset.codec ?? defaultVideoCodec(preset.format),
    audioCodec: preset.audioCodec ?? defaultAudioCodec(preset.format)
  };
}

export function defaultVideoCodec(format: KavioExportFormat): KavioExportCodec {
  switch (format) {
    case "webm":
      return "vp9";
    case "mov":
      return "prores";
    case "mp4":
    case "gif":
    case "png-sequence":
      return "h264";
  }
}

export function defaultAudioCodec(format: KavioExportFormat): KavioAudioCodec {
  switch (format) {
    case "webm":
      return "opus";
    case "mp4":
    case "mov":
    case "gif":
    case "png-sequence":
      return "aac";
  }
}

export function videoEncoder(codec: KavioExportCodec): string {
  switch (codec) {
    case "hevc":
      return "libx265";
    case "vp9":
      return "libvpx-vp9";
    case "prores":
      return "prores_ks";
    case "h264":
      return "libx264";
  }
}

export function audioEncoder(codec: KavioAudioCodec): string {
  switch (codec) {
    case "opus":
      return "libopus";
    case "mp3":
      return "libmp3lame";
    case "pcm":
      return "pcm_s16le";
    case "aac":
      return "aac";
  }
}

export function pixelFormat(codec: KavioExportCodec): string {
  switch (codec) {
    case "prores":
      return "yuv422p10le";
    case "vp9":
    case "hevc":
    case "h264":
      return "yuv420p";
  }
}
